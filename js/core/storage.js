// Wrapper IndexedDB minimaliste pour analyses + writingStyles
// + helpers localStorage pour settings non-sensibles

const DB_NAME = 'alpha-terminal';
const DB_VERSION = 10;

let _dbPromise = null;
let _dbAvailable = null; // null = unknown, true = OK, false = unavailable (private mode etc.)
const _dbAvailListeners = new Set();

// Permet aux UIs (banner) d'écouter le statut IndexedDB
export function onDbAvailabilityChange(fn) {
  _dbAvailListeners.add(fn);
  if (_dbAvailable !== null) fn(_dbAvailable);
  return () => _dbAvailListeners.delete(fn);
}
export function isDbAvailable() { return _dbAvailable !== false; }

function setDbAvailable(v) {
  _dbAvailable = v;
  _dbAvailListeners.forEach(fn => { try { fn(v); } catch {} });
}

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    // Peek d'abord la version existante pour éviter VersionError si la DB locale est plus
    // récente que DB_VERSION (cas réel : backup.js a déjà bumpé via ensureStoresExist).
    let peek;
    try {
      peek = indexedDB.open(DB_NAME);
    } catch (e) {
      console.warn('[storage] indexedDB.open threw synchronously:', e);
      setDbAvailable(false);
      return reject(new Error('IndexedDB indisponible (navigation privée ?)'));
    }
    peek.onerror = () => {
      console.warn('[storage] IndexedDB peek failed:', peek.error);
      setDbAvailable(false);
      reject(peek.error || new Error('IndexedDB unavailable'));
    };
    peek.onsuccess = () => {
      const existingVersion = peek.result.version;
      peek.result.close();
      const targetVersion = Math.max(existingVersion, DB_VERSION);
      const req = indexedDB.open(DB_NAME, targetVersion);
      attachHandlers(req);
    };
    function attachHandlers(req) {
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('analyses')) {
        const s = db.createObjectStore('analyses', { keyPath: 'id' });
        s.createIndex('module', 'module', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('writingStyles')) {
        db.createObjectStore('writingStyles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('knowledge')) {
        db.createObjectStore('knowledge', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wealth')) {
        db.createObjectStore('wealth', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wealth_snapshots')) {
        const ws = db.createObjectStore('wealth_snapshots', { keyPath: 'id' });
        ws.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('transcripts')) {
        const ts = db.createObjectStore('transcripts', { keyPath: 'id' });
        ts.createIndex('createdAt', 'createdAt', { unique: false });
        ts.createIndex('ticker', 'ticker', { unique: false });
      }
      // v7 — Finances perso (3 nouveaux stores)
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
      // v8 — Price alerts (extraites des transcripts YouTube ou créées manuellement)
      if (!db.objectStoreNames.contains('price_alerts')) {
        const pa = db.createObjectStore('price_alerts', { keyPath: 'id' });
        pa.createIndex('ticker', 'ticker', { unique: false });
        pa.createIndex('status', 'status', { unique: false });
      }
      // v9 — Goals (objectifs financiers : retraite, achat, FIRE, etc.)
      if (!db.objectStoreNames.contains('goals')) {
        const g = db.createObjectStore('goals', { keyPath: 'id' });
        g.createIndex('status', 'status', { unique: false });
        g.createIndex('targetDate', 'targetDate', { unique: false });
      }
      // v10 — Watchpoints (notes de surveillance : prix d'entrée/sortie, IPO, niveaux à scanner)
      if (!db.objectStoreNames.contains('watchpoints')) {
        const w = db.createObjectStore('watchpoints', { keyPath: 'id' });
        w.createIndex('ticker', 'ticker', { unique: false });
        w.createIndex('type', 'type', { unique: false });
        w.createIndex('status', 'status', { unique: false });
        w.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => { setDbAvailable(true); resolve(req.result); };
    req.onerror = () => {
      console.warn('[storage] IndexedDB open failed:', req.error);
      setDbAvailable(false);
      reject(req.error || new Error('IndexedDB unavailable'));
    };
    req.onblocked = () => {
      console.warn('[storage] IndexedDB blocked — autre onglet ouvre une version différente');
      // On laisse la promise pending, l'utilisateur doit fermer les autres onglets
    };
    }
    // NOTE : pas de timeout artificiel ici. Le précédent setTimeout 5s déclenchait
    // un FAUX POSITIF "navigation privée" sur les devices lents (mobile, Capacitor) où
    // l'open IndexedDB peut prendre plusieurs secondes. On laisse onerror/onsuccess
    // décider — si le navigateur n'envoie aucun des deux, c'est qu'IndexedDB est bloqué
    // par un autre onglet (req.onblocked gère ce cas).
  });
  return _dbPromise.catch(err => {
    // Reset le promise pour permettre un retry futur si l'environnement change
    _dbPromise = null;
    throw err;
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ===== Analyses =====
export async function saveAnalysis(record) {
  const store = await tx('analyses', 'readwrite');
  return reqAsPromise(store.put(record));
}

export async function getAnalysis(id) {
  const store = await tx('analyses');
  return reqAsPromise(store.get(id));
}

export async function listAnalyses({ module = null, limit = 200 } = {}) {
  const store = await tx('analyses');
  const out = [];
  return new Promise((resolve, reject) => {
    const cursor = store.index('createdAt').openCursor(null, 'prev');
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c || out.length >= limit) return resolve(out);
      if (!module || c.value.module === module) out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function deleteAnalysis(id) {
  const store = await tx('analyses', 'readwrite');
  return reqAsPromise(store.delete(id));
}

export async function clearAnalyses() {
  const store = await tx('analyses', 'readwrite');
  return reqAsPromise(store.clear());
}

// ===== Writing styles =====
export async function saveStyle(record) {
  const store = await tx('writingStyles', 'readwrite');
  return reqAsPromise(store.put(record));
}

export async function getStyle(id = 'default') {
  const store = await tx('writingStyles');
  return reqAsPromise(store.get(id));
}

// ===== Settings (localStorage) =====
const SETTINGS_KEY = 'alpha-terminal:settings';
const DEFAULT_SETTINGS = {
  defaultModel: 'claude-opus-4-5',
  fallbackModel: 'claude-sonnet-4-5',
  maxTokens: 4096,
  temperature: 1.0,
  autoFallback: true,
  // Override des noms de modèles par provider (pour suivre l'évolution sans toucher au code)
  modelOverrides: {
    claude:      { flagship: 'claude-opus-4-7',   balanced: 'claude-sonnet-4-6',           fast: 'claude-haiku-4-5' },
    openai:      { flagship: 'gpt-5',             balanced: 'gpt-5-mini',                  fast: 'gpt-5-nano' },
    gemini:      { flagship: 'gemini-2.5-pro',    balanced: 'gemini-2.5-flash',            fast: 'gemini-2.5-flash-lite' },
    grok:        { flagship: 'grok-4',            balanced: 'grok-3',                      fast: 'grok-4-fast' },
    openrouter:  { flagship: 'anthropic/claude-opus-4', balanced: 'openai/gpt-5-mini',     fast: 'meta-llama/llama-3.3-70b-instruct' },
    perplexity:  { flagship: 'sonar-pro',         balanced: 'sonar',                       fast: 'sonar' },
    mistral:     { flagship: 'mistral-large-latest', balanced: 'mistral-medium-latest',    fast: 'mistral-small-latest' },
    cerebras:    { flagship: 'llama-3.3-70b',     balanced: 'llama-3.1-70b',               fast: 'llama-3.1-8b' },
    github:      { flagship: 'openai/gpt-4o',     balanced: 'openai/gpt-4o-mini',          fast: 'meta/Llama-3.2-11B-Vision-Instruct' },
    nvidia:      { flagship: 'nvidia/llama-3.1-nemotron-70b-instruct', balanced: 'meta/llama-3.3-70b-instruct', fast: 'meta/llama-3.1-8b-instruct' },
    huggingface: { flagship: 'meta-llama/Llama-3.3-70B-Instruct', balanced: 'Qwen/Qwen2.5-72B-Instruct', fast: 'meta-llama/Llama-3.1-8B-Instruct' },
    cloudflare:  { flagship: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', balanced: '@cf/meta/llama-3.1-70b-instruct', fast: '@cf/meta/llama-3.1-8b-instruct' },
    together:    { flagship: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', balanced: 'Qwen/Qwen2.5-72B-Instruct-Turbo', fast: 'meta-llama/Llama-3.1-8B-Instruct-Turbo' },
    cohere:      { flagship: 'command-r-plus-08-2024', balanced: 'command-r-08-2024',      fast: 'command-r7b-12-2024' }
  },
  // Override par module (forçage manuel d'un provider/tier)
  moduleOverrides: {}, // { 'decoder-10k': { provider: 'claude', tier: 'flagship' }, ... }
  hasSeenLanding: false // pour skip la landing après premier visit
};

// Deep-merge limité aux objets simples — nécessaire pour `modelOverrides` et
// `moduleOverrides` afin que les nouveaux providers (ajoutés dans DEFAULT_SETTINGS)
// soient hérités par les utilisateurs existants au lieu d'être écrasés par leur snapshot.
function _mergeSettings(defaults, saved) {
  const out = { ...defaults };
  for (const k of Object.keys(saved || {})) {
    const dv = defaults[k];
    const sv = saved[k];
    if (dv && typeof dv === 'object' && !Array.isArray(dv) && sv && typeof sv === 'object' && !Array.isArray(sv)) {
      out[k] = { ...dv, ...sv };
    } else if (sv !== undefined) {
      out[k] = sv;
    }
  }
  return out;
}

// Fallback mémoire : si localStorage est indisponible (vrai mode privé ou quota=0),
// on garde les settings en RAM pour que l'app continue de fonctionner pendant la session.
const _memorySettingsStore = new Map();

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const mem = _memorySettingsStore.get(SETTINGS_KEY);
      return mem ? _mergeSettings(DEFAULT_SETTINGS, mem) : { ...DEFAULT_SETTINGS };
    }
    return _mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw));
  } catch {
    const mem = _memorySettingsStore.get(SETTINGS_KEY);
    return mem ? _mergeSettings(DEFAULT_SETTINGS, mem) : { ...DEFAULT_SETTINGS };
  }
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (e) {
    // Quota dépassé ou stockage bloqué → fallback RAM (ne crash pas l'app)
    console.warn('[storage] setSettings localStorage failed, using memory fallback:', e?.message);
    _memorySettingsStore.set(SETTINGS_KEY, next);
  }
  return next;
}

// Probe explicite et NON-INVASIVE de la santé du stockage.
// Retourne { localStorage, indexedDB, isLikelyPrivate } sans assumer la cause.
// L'app peut afficher une bannière informative basée sur ces faits réels.
export async function probeStorage() {
  const result = { localStorage: false, indexedDB: false, isLikelyPrivate: false };
  // Test localStorage (write/read/remove)
  try {
    const k = '__alpha_probe_' + Math.random().toString(36).slice(2);
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    result.localStorage = ok;
  } catch { result.localStorage = false; }
  // Test IndexedDB (open + close + delete d'une DB jetable)
  try {
    await new Promise((resolve, reject) => {
      const probeName = '__alpha_probe_' + Math.random().toString(36).slice(2);
      const req = indexedDB.open(probeName, 1);
      req.onsuccess = () => {
        try { req.result.close(); } catch {}
        try { indexedDB.deleteDatabase(probeName); } catch {}
        result.indexedDB = true;
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
      // Timeout court juste pour ce probe (pas pour l'app)
      setTimeout(() => reject(new Error('probe-timeout')), 3000);
    });
  } catch { result.indexedDB = false; }
  // Heuristique privée : seulement si BOTH sont KO (Safari private bloque les deux).
  // Un seul KO peut venir d'une corruption locale, pas du mode privé.
  result.isLikelyPrivate = !result.localStorage && !result.indexedDB;
  return result;
}
