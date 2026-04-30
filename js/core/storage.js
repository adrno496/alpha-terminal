// Wrapper IndexedDB minimaliste pour analyses + writingStyles
// + helpers localStorage pour settings non-sensibles

const DB_NAME = 'alpha-terminal';
const DB_VERSION = 7;

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
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      // Certains navigateurs jettent synchroniously en navigation privée
      console.warn('[storage] indexedDB.open threw synchronously:', e);
      setDbAvailable(false);
      return reject(new Error('IndexedDB indisponible (navigation privée ?)'));
    }
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
    // Timeout : si onsuccess/onerror ne se déclenchent jamais (rare bug Safari private)
    setTimeout(() => {
      if (_dbAvailable === null) {
        setDbAvailable(false);
        reject(new Error('IndexedDB timeout — navigation privée ?'));
      }
    }, 5000);
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

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
