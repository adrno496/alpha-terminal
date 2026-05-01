// Full backup / restore : tout le state local (IndexedDB + localStorage)
// Permet de migrer entre appareils (PC ↔ smartphone, ancien ↔ nouveau, etc.)

const DB_NAME = 'alpha-terminal';
const DB_VERSION = 10;

const STORES = ['analyses', 'writingStyles', 'knowledge', 'wealth', 'wealth_snapshots', 'transcripts', 'budget_entries', 'dividends_history', 'insights_state', 'price_alerts', 'goals', 'watchpoints'];

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
    // CRITIQUE : si backup.js est le premier à ouvrir la DB (avant storage.js / wealth.js),
    // il faut créer TOUS les stores ici, sinon ils n'existeront jamais et les données seront
    // perdues / non exportées. Doit rester aligné avec storage.js#openDB.
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('analyses')) {
        const s = db.createObjectStore('analyses', { keyPath: 'id' });
        s.createIndex('module', 'module', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('writingStyles')) db.createObjectStore('writingStyles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('knowledge'))     db.createObjectStore('knowledge',     { keyPath: 'id' });
      if (!db.objectStoreNames.contains('wealth'))        db.createObjectStore('wealth',        { keyPath: 'id' });
      if (!db.objectStoreNames.contains('wealth_snapshots')) {
        const ws = db.createObjectStore('wealth_snapshots', { keyPath: 'id' });
        ws.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('transcripts')) {
        const ts = db.createObjectStore('transcripts', { keyPath: 'id' });
        ts.createIndex('createdAt', 'createdAt', { unique: false });
        ts.createIndex('ticker', 'ticker', { unique: false });
      }
      if (!db.objectStoreNames.contains('budget_entries')) {
        const be = db.createObjectStore('budget_entries', { keyPath: 'id' });
        be.createIndex('month', 'month', { unique: false });
        be.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains('dividends_history')) {
        const dh = db.createObjectStore('dividends_history', { keyPath: 'id' });
        dh.createIndex('date', 'date', { unique: false });
        dh.createIndex('ticker', 'ticker', { unique: false });
      }
      if (!db.objectStoreNames.contains('insights_state')) {
        const is = db.createObjectStore('insights_state', { keyPath: 'id' });
        is.createIndex('generatedAt', 'generatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('price_alerts')) {
        const pa = db.createObjectStore('price_alerts', { keyPath: 'id' });
        pa.createIndex('ticker', 'ticker', { unique: false });
        pa.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('goals')) {
        const g = db.createObjectStore('goals', { keyPath: 'id' });
        g.createIndex('status', 'status', { unique: false });
        g.createIndex('targetDate', 'targetDate', { unique: false });
      }
    };
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

// CRITIQUE : si la DB existe déjà à la version courante mais avec des stores manquants
// (cas où une version antérieure de backup.js a créé une DB v5 vide), `onupgradeneeded`
// ne fire jamais et les stores manquants restent introuvables. On force ici un version
// bump pour déclencher la création des stores absents avant l'import.
async function ensureStoresExist(db) {
  const missing = STORES.filter(s => !db.objectStoreNames.contains(s));
  if (missing.length === 0) return db;

  console.warn('[backup] Stores manquants détectés, version bump pour création :', missing);
  // On vise au minimum DB_VERSION ; si la DB est déjà au-delà (autre onglet a déjà bumpé),
  // on bump encore d'un cran. Évite l'erreur "requested version (X) less than existing (Y)".
  const newVersion = Math.max(db.version + 1, DB_VERSION);
  try { db.close(); } catch {}

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, newVersion);
    req.onupgradeneeded = (e) => {
      const newDb = e.target.result;
      if (!newDb.objectStoreNames.contains('analyses')) {
        const s = newDb.createObjectStore('analyses', { keyPath: 'id' });
        s.createIndex('module', 'module', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!newDb.objectStoreNames.contains('writingStyles')) newDb.createObjectStore('writingStyles', { keyPath: 'id' });
      if (!newDb.objectStoreNames.contains('knowledge'))     newDb.createObjectStore('knowledge',     { keyPath: 'id' });
      if (!newDb.objectStoreNames.contains('wealth'))        newDb.createObjectStore('wealth',        { keyPath: 'id' });
      if (!newDb.objectStoreNames.contains('wealth_snapshots')) {
        const ws = newDb.createObjectStore('wealth_snapshots', { keyPath: 'id' });
        ws.createIndex('date', 'date', { unique: false });
      }
      if (!newDb.objectStoreNames.contains('transcripts')) {
        const ts = newDb.createObjectStore('transcripts', { keyPath: 'id' });
        ts.createIndex('createdAt', 'createdAt', { unique: false });
        ts.createIndex('ticker', 'ticker', { unique: false });
      }
      if (!newDb.objectStoreNames.contains('budget_entries')) {
        const be = newDb.createObjectStore('budget_entries', { keyPath: 'id' });
        be.createIndex('month', 'month', { unique: false });
        be.createIndex('type', 'type', { unique: false });
      }
      if (!newDb.objectStoreNames.contains('dividends_history')) {
        const dh = newDb.createObjectStore('dividends_history', { keyPath: 'id' });
        dh.createIndex('date', 'date', { unique: false });
        dh.createIndex('ticker', 'ticker', { unique: false });
      }
      if (!newDb.objectStoreNames.contains('insights_state')) {
        const is = newDb.createObjectStore('insights_state', { keyPath: 'id' });
        is.createIndex('generatedAt', 'generatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('DB bloquée par un autre onglet — ferme les autres onglets puis réessaie'));
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
      budget_entries: indexedDBDump.budget_entries?.length || 0,
      dividends_history: indexedDBDump.dividends_history?.length || 0,
      insights_state: indexedDBDump.insights_state?.length || 0,
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
          description: 'Alpha backup',
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
  if (!window.Capacitor) {
    console.warn('[backup] window.Capacitor not present');
    return false;
  }
  const plugins = window.Capacitor.Plugins || {};
  const Filesystem = plugins.Filesystem;
  const Share      = plugins.Share;

  // Diagnostic explicite : si plugins absents, on log ce qu'on a
  if (!Filesystem) {
    console.error('[backup] @capacitor/filesystem plugin NOT installed. Available plugins:', Object.keys(plugins));
    console.error('[backup] Run: npm install @capacitor/filesystem @capacitor/share && npx cap sync android');
    return false;
  }

  try {
    // Écrit dans Documents (visible dans le file manager Android)
    const directory = 'DOCUMENTS';
    console.log('[backup] Writing via Capacitor Filesystem to', directory + '/' + filename);
    await Filesystem.writeFile({
      path: filename,
      data: json,
      directory,
      encoding: 'utf8',
      recursive: true
    });
    console.log('[backup] File written successfully');

    // Si Share dispo, ouvre la dialog de partage
    if (Share) {
      try {
        const uri = await Filesystem.getUri({ path: filename, directory });
        console.log('[backup] Sharing URI:', uri.uri);
        await Share.share({
          title: 'Alpha Backup',
          text: 'Backup ' + filename,
          url: uri.uri,
          dialogTitle: 'Sauvegarder le backup'
        });
      } catch (shareErr) {
        // User cancel = OK ; autre erreur = log mais le fichier est déjà écrit
        if (shareErr?.message && !/cancel/i.test(shareErr.message)) {
          console.warn('[backup] Share failed (file still saved):', shareErr);
        }
      }
    } else {
      console.warn('[backup] @capacitor/share plugin missing — file saved but no share dialog. Look in /Documents.');
    }
    return true;
  } catch (e) {
    console.error('[backup] Capacitor writeFile failed:', e);
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
  const counts = { added: {}, skipped: 0, missingStores: [] };
  let db = await openDB();

  // CRITIQUE : si la DB de destination est à la version courante mais avec des stores
  // manquants (cas réel : précédente version de backup.js qui créait une DB v5 vide),
  // onupgradeneeded n'a pas fire et les stores absents resteront introuvables. On force
  // un version bump pour les créer avant l'import, sinon loadStore retourne 0 silencieusement.
  db = await ensureStoresExist(db);

  // 1. IndexedDB stores
  if (payload.indexedDB && typeof payload.indexedDB === 'object') {
    for (const name of STORES) {
      const records = payload.indexedDB[name];
      if (!Array.isArray(records)) continue;
      // Garde-fou explicite : si malgré tout le store n'existe toujours pas, on log
      if (!db.objectStoreNames.contains(name)) {
        counts.missingStores.push(name);
        continue;
      }
      const n = await loadStore(db, name, records, { mode });
      counts.added[name] = n;
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

// Diagnostic complet : ouvre la DB sans imposer de version, liste TOUS les stores
// réellement présents (pas juste ceux dans STORES), avec compte + échantillon.
// Permet de détecter les data perdues à cause d'un mismatch de version ou d'un nom de store.
export async function diagnosticBackup() {
  const result = {
    dbName: DB_NAME,
    requestedVersion: DB_VERSION,
    actualVersion: null,
    storesInDb: [],
    storesExpected: STORES,
    storesMissing: [],
    storesUnexpected: [],
    perStore: {},
    localStorage: {
      total: 0,
      kept: 0,
      sampleKeys: []
    },
    error: null
  };

  // 1. Ouvre la DB sans forcer de version pour ne PAS déclencher d'upgrade
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    result.error = 'Open DB failed: ' + (e?.message || e);
    return result;
  }

  result.actualVersion = db.version;
  result.storesInDb = Array.from(db.objectStoreNames);
  result.storesMissing = STORES.filter(s => !result.storesInDb.includes(s));
  result.storesUnexpected = result.storesInDb.filter(s => !STORES.includes(s));

  // 2. Dump chaque store réellement présent + échantillon
  for (const name of result.storesInDb) {
    try {
      const records = await new Promise((resolve) => {
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
      result.perStore[name] = {
        count: records.length,
        sample: records.slice(0, 2).map(r => {
          // Tronque les valeurs longues pour rester lisible
          const trim = (v) => typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v;
          if (typeof r !== 'object' || r === null) return r;
          const out = {};
          for (const k of Object.keys(r).slice(0, 8)) out[k] = trim(r[k]);
          return out;
        })
      };
    } catch (e) {
      result.perStore[name] = { count: 0, error: e?.message || String(e) };
    }
  }
  try { db.close(); } catch {}

  // 3. localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    result.localStorage.total++;
    if (isAppKey(k)) {
      result.localStorage.kept++;
      if (result.localStorage.sampleKeys.length < 12) result.localStorage.sampleKeys.push(k);
    }
  }

  return result;
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
