// Cloud sync E2EE — backup chiffré côté client uploadé vers Supabase.
// Le serveur ne peut PAS lire le contenu (AES-GCM avec passphrase user).
// Activation OPT-IN via Settings → ☁️ Sync Cloud.
//
// Flow :
//   pushCloudBackup(passphrase) :
//     1. exportFullBackup()                    → payload JSON v3
//     2. AES-GCM encrypt avec passphrase       → blob opaque
//     3. INSERT cloud_backups (RLS user_id=auth.uid)
//
//   restoreCloudBackup(id, passphrase, mode) :
//     1. SELECT encrypted_payload, iv, salt FROM cloud_backups WHERE id=?
//     2. AES-GCM decrypt avec passphrase       → payload JSON v3
//     3. importFullBackup(payload, {mode})

import { exportFullBackup, importFullBackup } from './backup.js';
import { deriveKey, encryptValue, decryptValue } from './crypto.js';
import { bufToB64, b64ToBuf } from './utils.js';

const ENABLED_KEY = 'alpha-terminal:cloud-sync-enabled';
const DEVICE_LABEL_KEY = 'alpha-terminal:cloud-sync-device-label';
const ONBOARDED_KEY = 'alpha-terminal:cloud-sync-onboarded';

// === État (localStorage) ===
export function isCloudSyncEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}

export function setCloudSyncEnabled(on) {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alpha:cloudSyncToggled', { detail: { enabled: !!on } }));
  }
}

export function isCloudSyncOnboarded() {
  try { return localStorage.getItem(ONBOARDED_KEY) === '1'; } catch { return false; }
}

export function markCloudSyncOnboarded() {
  try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch {}
}

export function getDeviceLabel() {
  try {
    const saved = localStorage.getItem(DEVICE_LABEL_KEY);
    if (saved) return saved;
  } catch {}
  // Auto-deduce depuis user agent
  const ua = navigator.userAgent || '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Device';
}

export function setDeviceLabel(label) {
  try { localStorage.setItem(DEVICE_LABEL_KEY, String(label || '').slice(0, 60)); } catch {}
}

// === Auth helper — réutilise window.alphaAuth (legacy magic link) ===
async function getSupabaseClient() {
  if (typeof window === 'undefined' || !window.alphaAuth) throw new Error('Auth non initialisée');
  await window.alphaAuth.ready();
  if (!window.alphaAuth.client) throw new Error('Supabase non configuré');
  return window.alphaAuth.client;
}

export async function getCloudSyncUser() {
  if (typeof window === 'undefined' || !window.alphaAuth) return null;
  return await window.alphaAuth.getUser();
}

export async function sendCloudSyncMagicLink(email) {
  if (typeof window === 'undefined' || !window.alphaAuth) throw new Error('Auth non initialisée');
  return await window.alphaAuth.sendMagicLink(email);
}

export async function cloudSignOut() {
  if (typeof window === 'undefined' || !window.alphaAuth) return;
  await window.alphaAuth.logout();
}

// === Push (encrypt + upload) ===
// Encode un ArrayBuffer en hex pour l'envoyer en BYTEA Postgres (Supabase REST gère bytea via base64
// par défaut, mais on utilise la convention `\x` hex string qui passe directement).
function bufToHex(buf) {
  const bytes = new Uint8Array(buf);
  let s = '\\x';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function hexToBuf(hex) {
  // Strip leading "\x" si présent
  const clean = String(hex || '').replace(/^\\x/, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out.buffer;
}

export async function pushCloudBackup(passphrase) {
  if (!passphrase) throw new Error('Passphrase requise');
  const client = await getSupabaseClient();
  const user = await getCloudSyncUser();
  if (!user) throw new Error('Non connecté à la sync cloud');

  // 1. Export du payload complet (JSON v3)
  const payload = await exportFullBackup();
  const json = JSON.stringify(payload);

  // 2. Dérive la clé + chiffre
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt.buffer);
  const enc = await encryptValue(key, json); // { ct: b64, iv: b64 }

  // 3. Insert (BYTEA via hex)
  const ctBuf = b64ToBuf(enc.ct);
  const ivBuf = b64ToBuf(enc.iv);
  const { data, error } = await client
    .from('cloud_backups')
    .insert({
      user_id: user.id,
      encrypted_payload: bufToHex(ctBuf),
      iv: bufToHex(ivBuf),
      salt: bufToHex(salt.buffer),
      schema_version: payload.schemaVersion || 3,
      payload_size: ctBuf.byteLength,
      device_label: getDeviceLabel()
    })
    .select('id, created_at, payload_size')
    .single();

  if (error) throw error;
  return { id: data.id, sizeBytes: data.payload_size, createdAt: data.created_at };
}

// === List (sans le payload — léger) ===
export async function listCloudBackups() {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('cloud_backups')
    .select('id, created_at, payload_size, device_label, schema_version')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

// === Restore (download + decrypt + import) ===
export async function restoreCloudBackup(id, passphrase, { mode = 'merge' } = {}) {
  if (!id) throw new Error('ID backup manquant');
  if (!passphrase) throw new Error('Passphrase requise');
  const client = await getSupabaseClient();

  // 1. Download le blob chiffré
  const { data, error } = await client
    .from('cloud_backups')
    .select('encrypted_payload, iv, salt, schema_version')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Backup introuvable');

  // 2. Décrypte
  // Supabase retourne BYTEA en string base64 (par défaut PostgREST). Si format \x hex, on convertit.
  // Détection : si commence par "\x", c'est hex ; sinon base64.
  function bytesField(field) {
    if (typeof field === 'string') {
      if (field.startsWith('\\x')) return hexToBuf(field);
      // Base64 standard
      return b64ToBuf(field);
    }
    // Si c'est déjà un ArrayBuffer/Uint8Array
    if (field instanceof ArrayBuffer) return field;
    if (field?.buffer) return field.buffer;
    throw new Error('Format BYTEA inattendu');
  }

  const ctBuf = bytesField(data.encrypted_payload);
  const ivBuf = bytesField(data.iv);
  const saltBuf = bytesField(data.salt);

  const key = await deriveKey(passphrase, saltBuf);
  let json;
  try {
    json = await decryptValue(key, { ct: bufToB64(ctBuf), iv: bufToB64(ivBuf) });
  } catch {
    throw new Error('Passphrase incorrecte (déchiffrement impossible)');
  }

  let payload;
  try { payload = JSON.parse(json); }
  catch { throw new Error('Backup corrompu (JSON invalide)'); }

  // 3. Import local
  const result = await importFullBackup(payload, { mode });
  return result;
}

// === Delete (un backup spécifique) ===
export async function deleteCloudBackup(id) {
  if (!id) throw new Error('ID backup manquant');
  const client = await getSupabaseClient();
  const { error } = await client.from('cloud_backups').delete().eq('id', id);
  if (error) throw error;
}

// === Push avec une CryptoKey déjà dérivée (utilisé par auto-push depuis vault unlocked) ===
// Permet d'éviter de redemander la passphrase au user pour chaque snapshot 24h.
// La clé doit avoir été dérivée avec un salt connu — sinon push manuel obligatoire.
// V1 : on REQUIERT toujours la passphrase pour sync cloud. Cette fonction est un placeholder
// pour V2 (auto-push silent si vault unlocked). Désactivée pour l'instant.
export async function pushCloudBackupSilent() {
  // V1 : pas implémenté — l'auto-push silent nécessite de stocker le salt sync séparément.
  // Le user doit cliquer "Push maintenant" + saisir la passphrase pour la sync cloud.
  return null;
}
