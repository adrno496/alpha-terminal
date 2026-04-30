// Full backup / restore : tout le state local (IndexedDB + localStorage)
// Permet de migrer entre appareils (PC ↔ smartphone, ancien ↔ nouveau, etc.)

const DB_NAME = 'alpha-terminal';
const DB_VERSION = 5;

const STORES = ['analyses', 'writingStyles', 'knowledge', 'wealth', 'wealth_snapshots', 'transcripts'];

// localStorage keys gérées par l'app (filtre pour ne pas exporter les clés du navigateur d'autres sites)
const LS_PREFIXES = ['alpha-terminal:', 'alphavantage:', 'fmp:', 'polygon:', 'finnhub:', 'tiingo:', 'twelvedata:', 'fred:', 'etherscan:', 'data-keys:'];
const LS_EXACT = ['alpha-terminal:vault']; // vault exact

function isAppKey(k) {
  if (!k) return false;
  if (LS_EXACT.includes(k)) return true;
  return LS_PREFIXES.some(p => k.startsWith(p));
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // upgrade ne fait rien : si la version actuelle de l'app est < 5, l'app a déjà bumpé.
    req.onupgradeneeded = () => {};
  });
}

function dumpStore(db, name) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(name)) return resolve([]);
    const out = [];
    const tx = db.transaction(name, 'readonly');
    const cursor = tx.objectStore(name).openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => resolve(out);
  });
}

function loadStore(db, name, records, { mode = 'merge' } = {}) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(name)) return resolve(0);
    if (!Array.isArray(records) || !records.length) return resolve(0);
    const tx = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    let added = 0;
    const after = () => {
      tx.oncomplete = () => resolve(added);
      tx.onerror = () => reject(tx.error);
    };
    if (mode === 'replace') {
      const clr = store.clear();
      clr.onsuccess = () => {
        for (const r of records) { try { store.put(r); added++; } catch {} }
        after();
      };
      clr.onerror = () => after();
    } else {
      for (const r of records) { try { store.put(r); added++; } catch {} }
      after();
    }
  });
}

// === EXPORT ===

export async function exportFullBackup() {
  const db = await openDB();

  const indexedDBDump = {};
  for (const s of STORES) indexedDBDump[s] = await dumpStore(db, s);

  const localStorageDump = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isAppKey(k)) {
      try { localStorageDump[k] = localStorage.getItem(k); } catch {}
    }
  }

  const payload = {
    app: 'alpha-terminal',
    version: '2.1.0',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    device: {
      userAgent: (navigator.userAgent || '').slice(0, 200),
      platform: navigator.platform || '',
      language: navigator.language || ''
    },
    counts: {
      analyses: indexedDBDump.analyses?.length || 0,
      writingStyles: indexedDBDump.writingStyles?.length || 0,
      knowledge: indexedDBDump.knowledge?.length || 0,
      wealth: indexedDBDump.wealth?.length || 0,
      wealth_snapshots: indexedDBDump.wealth_snapshots?.length || 0,
      transcripts: indexedDBDump.transcripts?.length || 0,
      localStorageKeys: Object.keys(localStorageDump).length
    },
    indexedDB: indexedDBDump,
    localStorage: localStorageDump
  };
  return payload;
}

export function backupFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  // Extension .atb (Alpha Terminal Backup) au lieu de .json :
  //   - .json est parfois flaggé par Chrome/Edge SafeBrowsing comme "type rare/dangereux"
  //   - les antivirus (Norton, McAfee) bloquent les .json sortants par défaut
  //   - la WebView Android n'ouvre pas toujours les .json comme téléchargement
  //   - une extension custom contourne tous ces blocages tout en restant du JSON pur
  return `alpha-terminal-backup-${stamp}.atb`;
}

// Tente plusieurs stratégies dans l'ordre :
//   1. Capacitor Filesystem + Share          (Android / iOS)
//   2. File System Access API (showSaveFilePicker)  (Chromium récents)
//   3. <a download> via Blob URL             (Web, Electron, fallback universel)
//   4. data: URL ouvert dans une nouvelle fenêtre (dernier recours)
//   5. Sinon, l'appelant peut tomber sur le copy-to-clipboard
export async function downloadFullBackup() {
  const payload = await exportFullBackup();
  const json = JSON.stringify(payload, null, 2);
  const filename = backupFilename();

  // 1. Capacitor (Android / iOS)
  const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isCapacitor) {
    try {
      const ok = await saveViaCapacitor(json, filename);
      if (ok) return { payload, json, filename, method: 'capacitor' };
    } catch (e) { console.warn('Capacitor save failed:', e); }
    // Plugins Capacitor absents/échec : le fallback <a download> ne marche pas dans
    // la WebView Android/iOS → on bascule directement sur la modale JSON pour copy-paste,
    // au lieu de simuler un succès de téléchargement qui n'arrivera jamais.
    return { payload, json, filename, method: 'failed' };
  }

  // 2. File System Access API — Chromium récent, plus fiable que <a download>
  //    (boîte de dialogue native, pas de blocage par adblocker / PWA standalone)
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'ALPHA TERMINAL backup',
          accept: { 'application/octet-stream': ['.atb', '.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return { payload, json, filename, method: 'fs-access' };
    } catch (e) {
      // AbortError = utilisateur a annulé, on remonte ça comme "cancelled" sans fallback
      if (e && e.name === 'AbortError') {
        return { payload, json, filename, method: 'cancelled' };
      }
      // Sinon on bascule sur le fallback <a download>
      console.warn('showSaveFilePicker failed:', e);
    }
  }

  // 3. Web / Electron — <a download> via Blob URL
  //    MIME application/octet-stream force le download (au lieu d'ouvrir dans l'onglet),
  //    et on évite display:none qui bloque le click programmatique sur certains navigateurs.
  try {
    const blob = new Blob([json], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    a.style.top = '0';
    document.body.appendChild(a);
    // Click via MouseEvent : plus robuste que a.click() dans certains contextes (popup blockers, PWA standalone)
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    a.dispatchEvent(evt);
    // Délai plus long avant revoke : certains navigateurs lents (Safari) ont besoin de temps
    setTimeout(() => {
      try { a.remove(); } catch {}
      try { URL.revokeObjectURL(url); } catch {}
    }, 5000);
    return { payload, json, filename, method: 'download' };
  } catch (e) { console.warn('Download fallback:', e); }

  // 4. data: URL — fallback si <a download> bloqué (vieux navigateurs / WebView restrictifs)
  try {
    const data = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(json);
    const w = window.open(data, '_blank');
    if (w) return { payload, json, filename, method: 'window' };
  } catch (e) { console.warn('data: URL failed:', e); }

  // 5. Tout a échoué — l'appelant doit afficher le JSON pour copy-paste
  return { payload, json, filename, method: 'failed' };
}

async function saveViaCapacitor(json, filename) {
  if (!window.Capacitor) return false;
  try {
    // Lazy import des plugins (peuvent ne pas être installés)
    const Filesystem = window.Capacitor.Plugins?.Filesystem;
    const Share      = window.Capacitor.Plugins?.Share;
    if (!Filesystem) return false;

    // Écrit le fichier dans Documents (visible dans le file manager)
    const directory = 'DOCUMENTS'; // mappé par Capacitor sur le bon dossier par OS
    await Filesystem.writeFile({
      path: filename,
      data: json,
      directory,
      encoding: 'utf8'
    });

    // Si le plugin Share est dispo, propose le partage (utilisateur peut envoyer vers Drive, mail, etc.)
    if (Share) {
      const uri = await Filesystem.getUri({ path: filename, directory });
      try {
        await Share.share({
          title: 'ALPHA TERMINAL Backup',
          text: 'Backup ' + filename,
          url: uri.uri,
          dialogTitle: 'Sauvegarder le backup'
        });
      } catch { /* user cancel ok */ }
    }
    return true;
  } catch (e) {
    console.warn('Capacitor write failed:', e);
    return false;
  }
}

export async function copyBackupToClipboard() {
  const payload = await exportFullBackup();
  const json = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    return { ok: true, json, payload };
  } catch (e) {
    // fallback textarea
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); }
    catch { document.body.removeChild(ta); return { ok: false, json, payload, error: e.message }; }
    document.body.removeChild(ta);
    return { ok: true, json, payload };
  }
}

// === IMPORT ===

export async function importFullBackup(payload, { mode = 'merge' } = {}) {
  if (!payload || payload.app !== 'alpha-terminal') {
    throw new Error('Format de sauvegarde invalide (app != alpha-terminal)');
  }
  const counts = { added: {}, skipped: 0 };
  const db = await openDB();

  // 1. IndexedDB stores
  if (payload.indexedDB && typeof payload.indexedDB === 'object') {
    for (const name of STORES) {
      const records = payload.indexedDB[name];
      if (Array.isArray(records)) {
        const n = await loadStore(db, name, records, { mode });
        counts.added[name] = n;
      }
    }
  }
  // Compat ancien format (uniquement analyses array)
  else if (Array.isArray(payload.analyses)) {
    const n = await loadStore(db, 'analyses', payload.analyses, { mode });
    counts.added.analyses = n;
  }

  // 2. localStorage
  if (payload.localStorage && typeof payload.localStorage === 'object') {
    for (const [k, v] of Object.entries(payload.localStorage)) {
      if (!isAppKey(k)) { counts.skipped++; continue; }
      if (typeof v !== 'string') { counts.skipped++; continue; }
      try { localStorage.setItem(k, v); } catch { counts.skipped++; }
    }
    counts.localStorageKeys = Object.keys(payload.localStorage).length - counts.skipped;
  }

  return counts;
}

export async function importBackupFromFile(file, opts = {}) {
  const text = await file.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch (e) { throw new Error('JSON invalide : ' + e.message); }
  return importFullBackup(payload, opts);
}

// === PURGE TOTALE (option destructive) ===

export async function wipeAllLocalData() {
  // 1. localStorage
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isAppKey(k)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);

  // 2. IndexedDB stores (clear, ne supprime pas la DB)
  const db = await openDB();
  for (const s of STORES) {
    if (!db.objectStoreNames.contains(s)) continue;
    await new Promise((resolve) => {
      const tx = db.transaction(s, 'readwrite');
      tx.objectStore(s).clear();
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }
}

// Stats pour l'UI (combien de chaque chose tu as)
export async function getLocalDataStats() {
  const db = await openDB();
  const stats = {};
  for (const s of STORES) {
    const records = await dumpStore(db, s);
    stats[s] = records.length;
  }
  let lsKeys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (isAppKey(localStorage.key(i))) lsKeys++;
  }
  stats.localStorageKeys = lsKeys;
  stats.hasVault = !!localStorage.getItem('alpha-terminal:vault');
  return stats;
}
