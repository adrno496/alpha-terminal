// Multi-key vault : chiffre indépendamment chaque clé provider avec le même mot de passe (PBKDF2 + AES-GCM).
// Format vault v2 :
//   { version: 2, salt: <b64>, keys: { claude:{ct,iv}, openai:{ct,iv}, gemini:{ct,iv}, grok:{ct,iv} }, createdAt }
// Migration v1 → v2 : si le vault local est { ct, iv, salt, ... }, on assume une clé Claude.

import { bufToB64, b64ToBuf } from './utils.js';

const STORAGE_KEY = 'alpha-terminal:vault';
const PBKDF2_ITER = 100000;

// === Session auto-unlock (1h idle timeout) ===
// La clé AES dérivée est stockée comme CryptoKey non-extractable en IndexedDB.
// Permet de zapper le re-prompt passphrase tant que l'app est utilisée régulièrement.
// Niveau de sécurité : équivalent "stay logged in" Bitwarden — vulnérable à JS hostile
// dans le contexte de l'app, mais protégé contre extraction simple de localStorage.
const SESSION_DB = 'alpha-vault-session';
const SESSION_STORE = 'session';
const SESSION_KEY_ID = 'derived-key';
const ACTIVITY_KEY = 'alpha-terminal:vault-last-activity';
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 heure

function openSessionDB() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(SESSION_DB, 1); }
    catch (e) { return reject(e); }
    req.onupgradeneeded = () => {
      try { req.result.createObjectStore(SESSION_STORE); } catch {}
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeDerivedKey(key) {
  try {
    const db = await openSessionDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      tx.objectStore(SESSION_STORE).put(key, SESSION_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) { console.warn('[crypto] storeDerivedKey failed:', e); }
}

async function loadDerivedKey() {
  try {
    const db = await openSessionDB();
    const key = await new Promise((resolve) => {
      const tx = db.transaction(SESSION_STORE, 'readonly');
      const req = tx.objectStore(SESSION_STORE).get(SESSION_KEY_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return key;
  } catch { return null; }
}

export async function clearDerivedKey() {
  localStorage.removeItem(ACTIVITY_KEY);
  try {
    const db = await openSessionDB();
    await new Promise((resolve) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      tx.objectStore(SESSION_STORE).delete(SESSION_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {}
}

export function markActivity() {
  try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch {}
}

function isSessionFresh() {
  const ts = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
  if (!ts) return false;
  return (Date.now() - ts) < IDLE_TIMEOUT_MS;
}

// Tente de déverrouiller le vault sans passphrase si la session est fraîche (< 1h).
// Retourne les clés en clair, ou null si auto-unlock impossible.
export async function tryAutoUnlock() {
  if (!hasVault()) return null;
  if (!isSessionFresh()) { await clearDerivedKey(); return null; }
  const key = await loadDerivedKey();
  if (!key) return null;
  const v = loadVault();
  if (!v || v.version !== 2 || !v.keys) return null;
  const out = {};
  try {
    for (const [name, enc] of Object.entries(v.keys)) {
      out[name] = await decryptValue(key, enc);
    }
  } catch {
    await clearDerivedKey();
    return null;
  }
  markActivity();
  return out;
}

async function deriveKey(password, saltBuf) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptValue(key, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)
  );
  return { ct: bufToB64(ct), iv: bufToB64(iv.buffer) };
}

async function decryptValue(key, { ct, iv }) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(iv)) },
    key,
    b64ToBuf(ct)
  );
  return new TextDecoder().decode(plain);
}

function loadVault() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveVault(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }

export function hasVault() { return !!localStorage.getItem(STORAGE_KEY); }

export function isLegacyVault() {
  const v = loadVault();
  return v && !v.version && v.ct && v.iv && v.salt;
}

export function vaultProviderNames() {
  const v = loadVault();
  if (!v) return [];
  if (v.version === 2 && v.keys) return Object.keys(v.keys);
  if (isLegacyVault()) return ['claude'];
  return [];
}

// Création / mise à jour du vault avec un set complet ou partiel de clés.
// Si un vault existe déjà, on FUSIONNE (append/replace) — il faut le password.
export async function setApiKeys(keys, password) {
  const existing = loadVault();
  let salt;
  if (existing && existing.version === 2 && existing.salt) {
    salt = b64ToBuf(existing.salt);
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  }
  const derivedKey = await deriveKey(password, salt);

  // Si le vault existait, on doit valider que le password est correct
  // (en tentant de déchiffrer une clé existante)
  if (existing && existing.version === 2 && existing.keys) {
    const firstName = Object.keys(existing.keys)[0];
    if (firstName) {
      try {
        await decryptValue(derivedKey, existing.keys[firstName]);
      } catch (_) {
        throw new Error('Mot de passe incorrect (incohérent avec le vault existant)');
      }
    }
  }

  // Fusion
  const newKeys = (existing && existing.version === 2 && existing.keys) ? { ...existing.keys } : {};
  for (const [name, value] of Object.entries(keys || {})) {
    if (value === null || value === '') {
      delete newKeys[name];
    } else if (value) {
      newKeys[name] = await encryptValue(derivedKey, value);
    }
  }

  saveVault({
    version: 2,
    salt: bufToB64(salt),
    keys: newKeys,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

// Déverrouille le vault → renvoie { claude, openai, gemini, grok } (clés en clair, en mémoire)
export async function unlockVault(password) {
  const v = loadVault();
  if (!v) throw new Error('Aucun vault');
  // Migration v1 → v2 si nécessaire
  if (!v.version && v.ct && v.iv && v.salt) {
    const salt = b64ToBuf(v.salt);
    const derived = await deriveKey(password, salt);
    let plain;
    try {
      plain = await decryptValue(derived, { ct: v.ct, iv: v.iv });
    } catch (_) {
      throw new Error('Mot de passe incorrect');
    }
    // Re-écrire en v2 avec la clé Claude
    const newKeys = { claude: await encryptValue(derived, plain) };
    saveVault({
      version: 2,
      salt: bufToB64(salt),
      keys: newKeys,
      createdAt: v.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      migratedFrom: 'v1'
    });
    return { claude: plain };
  }
  // v2 standard
  if (v.version !== 2) throw new Error('Format vault invalide');
  const salt = b64ToBuf(v.salt);
  const derived = await deriveKey(password, salt);
  const out = {};
  for (const [name, enc] of Object.entries(v.keys || {})) {
    try {
      out[name] = await decryptValue(derived, enc);
    } catch (_) {
      throw new Error('Mot de passe incorrect');
    }
  }
  // Mémorise la clé dérivée (non-extractable) pour auto-unlock pendant 1h d'inactivité
  await storeDerivedKey(derived);
  markActivity();
  return out;
}

// Suppression d'une clé (nécessite password pour reformer le vault — ou on supprime juste l'entrée)
// Approche simple : supprimer l'entrée chiffrée du JSON. Pas besoin du password.
export function removeProviderKey(providerName) {
  const v = loadVault();
  if (!v || v.version !== 2 || !v.keys) return;
  delete v.keys[providerName];
  v.updatedAt = new Date().toISOString();
  saveVault(v);
}

export function forgetVault() {
  localStorage.removeItem(STORAGE_KEY);
  // Best-effort : on efface aussi la session auto-unlock (fire-and-forget)
  clearDerivedKey().catch(() => {});
}
