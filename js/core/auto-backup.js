// Auto-backup local : crée une snapshot complète chaque 24h, garde les 7 dernières
// dans une IndexedDB séparée (n'interfère pas avec la DB principale 'alpha-terminal').
// 100% local, aucun upload. L'utilisateur peut restaurer depuis Settings → Avancé.

import { exportFullBackup, importFullBackup } from './backup.js';
import { openWithMinVersion } from './db-open.js';

const DB_NAME = 'alpha-autobackup';
const STORE = 'snapshots';
// v2 (2026-05) : bump pour forcer la création du store sur les DBs créées en v1
// sans store (cas d'un upgrade interrompu ou d'un browser qui a sauté l'upgrade).
const DB_VERSION = 2;
const KEEP_LAST_N = 7;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const LAST_RUN_KEY = 'alpha-terminal:auto-backup-last-run';

function openAutoDb() {
  return openWithMinVersion(DB_NAME, DB_VERSION, (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE)) {
      const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      s.createIndex('createdAt', 'createdAt', { unique: false });
    }
  });
}

async function putSnapshot(payload) {
  const db = await openAutoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.add({
      createdAt: new Date().toISOString(),
      payload
    });
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
  });
}

export async function listAutoBackups() {
  try {
    const db = await openAutoDb();
    const out = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const cursor = store.index('createdAt').openCursor(null, 'prev');
      const list = [];
      cursor.onsuccess = (e) => {
        const c = e.target.result;
        if (!c) return resolve(list);
        // Métadonnées légères seulement (pas le payload entier dans la liste)
        list.push({
          id: c.value.id,
          createdAt: c.value.createdAt,
          sizeBytes: estimateSize(c.value.payload),
          counts: c.value.payload?.manifest?.counts || null
        });
        c.continue();
      };
      cursor.onerror = () => reject(cursor.error);
      tx.oncomplete = () => db.close();
    });
    return out;
  } catch (e) {
    console.warn('[auto-backup] list failed:', e);
    return [];
  }
}

export async function restoreAutoBackup(id, { mode = 'merge' } = {}) {
  const db = await openAutoDb();
  const payload = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result?.payload || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
  if (!payload) throw new Error('Snapshot introuvable');
  return importFullBackup(payload, { mode });
}

export async function deleteAutoBackup(id) {
  const db = await openAutoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function pruneOld() {
  const db = await openAutoDb();
  const ids = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const cursor = tx.objectStore(STORE).index('createdAt').openCursor(null, 'prev');
    const list = [];
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(list);
      list.push(c.value.id);
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
  db.close();
  const toDelete = ids.slice(KEEP_LAST_N);
  for (const id of toDelete) {
    try { await deleteAutoBackup(id); } catch {}
  }
}

function estimateSize(obj) {
  try { return new Blob([JSON.stringify(obj)]).size; } catch { return 0; }
}

// Crée un snapshot maintenant (force, ignore l'intervalle)
export async function triggerAutoBackupNow() {
  const payload = await exportFullBackup();
  const id = await putSnapshot(payload);
  await pruneOld();
  try { localStorage.setItem(LAST_RUN_KEY, String(Date.now())); } catch {}
  return { id, sizeBytes: estimateSize(payload) };
}

// À appeler au boot. Crée un snapshot si > 24h depuis le dernier (best-effort, silencieux).
export async function maybeRunAutoBackup() {
  try {
    const last = parseInt(localStorage.getItem(LAST_RUN_KEY) || '0', 10);
    if (Date.now() - last < INTERVAL_MS) return null;
    const r = await triggerAutoBackupNow();
    console.log('[auto-backup] snapshot créé:', r);
    return r;
  } catch (e) {
    console.warn('[auto-backup] échoué:', e?.message);
    return null;
  }
}
