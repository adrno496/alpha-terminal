// Transcripts store — YouTube / earnings call / podcasts transcripts
// + memory snapshots cross-injectable into other modules

import { uuid } from './utils.js';
import { openWithMinVersion } from './db-open.js';

const DB_NAME = 'alpha-terminal';
const STORE = 'transcripts';

function openDB() {
  return openWithMinVersion(DB_NAME, 10, (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('analyses')) {
      const s = db.createObjectStore('analyses', { keyPath: 'id' });
      s.createIndex('module', 'module', { unique: false });
      s.createIndex('createdAt', 'createdAt', { unique: false });
    }
    if (!db.objectStoreNames.contains('writingStyles')) db.createObjectStore('writingStyles', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('knowledge'))      db.createObjectStore('knowledge',     { keyPath: 'id' });
    if (!db.objectStoreNames.contains('wealth'))         db.createObjectStore('wealth',        { keyPath: 'id' });
    if (!db.objectStoreNames.contains('wealth_snapshots')) {
      const ws = db.createObjectStore('wealth_snapshots', { keyPath: 'id' });
      ws.createIndex('date', 'date', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE)) {
      const ts = db.createObjectStore(STORE, { keyPath: 'id' });
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
    if (!db.objectStoreNames.contains('watchpoints')) {
      const w = db.createObjectStore('watchpoints', { keyPath: 'id' });
      w.createIndex('ticker', 'ticker', { unique: false });
      w.createIndex('type', 'type', { unique: false });
      w.createIndex('status', 'status', { unique: false });
      w.createIndex('createdAt', 'createdAt', { unique: false });
    }
  });
}

function tx(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}
function p(req) { return new Promise((r, rj) => { req.onsuccess = () => r(req.result); req.onerror = () => rj(req.error); }); }

// === CRUD ===

export async function saveTranscript(rec) {
  const store = await tx('readwrite');
  if (!rec.id) rec.id = uuid();
  if (!rec.createdAt) rec.createdAt = new Date().toISOString();
  await p(store.put(rec));
  return rec;
}

export async function getTranscript(id) {
  const store = await tx();
  return p(store.get(id));
}

export async function listTranscripts() {
  const store = await tx();
  return new Promise((resolve, reject) => {
    const out = [];
    const cursor = store.index('createdAt').openCursor(null, 'prev');
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function deleteTranscript(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

// === Active context ===
// Pattern aligné sur wealth : 1 transcript "actif" par module.

const ACTIVE_KEY = 'alpha-terminal:active-transcript';

export function getActiveTranscriptId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}
export function setActiveTranscriptId(id) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

const CTX_PREFIX = 'alpha-terminal:transcript-context-enabled:';
export function isTranscriptContextEnabledFor(moduleId) {
  return localStorage.getItem(CTX_PREFIX + moduleId) === '1';
}
export function setTranscriptContextEnabledFor(moduleId, on) {
  if (on) localStorage.setItem(CTX_PREFIX + moduleId, '1');
  else localStorage.removeItem(CTX_PREFIX + moduleId);
}

// === Context block injection ===

export async function buildTranscriptContext() {
  const id = getActiveTranscriptId();
  if (!id) return '';
  const t = await getTranscript(id);
  if (!t) return '';
  const m = t.memorySnapshot || {};
  const lines = [];
  lines.push('--- TRANSCRIPT MEMORY (active context) ---');
  if (t.title) lines.push(`Source : ${t.title}${t.ticker ? ' [' + t.ticker + ']' : ''}${t.publishedAt ? ' (' + t.publishedAt + ')' : ''}`);
  if (m.sentiment) lines.push(`Sentiment global : ${m.sentiment}`);
  if (m.ceoTone) lines.push(`Ton CEO : ${m.ceoTone}`);
  if (Array.isArray(m.keyHighlights) && m.keyHighlights.length) {
    lines.push('Key highlights :');
    m.keyHighlights.slice(0, 8).forEach(h => lines.push(`  - ${h}`));
  }
  if (m.importantNumbers && typeof m.importantNumbers === 'object') {
    const keys = Object.keys(m.importantNumbers).slice(0, 8);
    if (keys.length) {
      lines.push('Chiffres clés :');
      keys.forEach(k => lines.push(`  - ${k}: ${m.importantNumbers[k]}`));
    }
  }
  if (Array.isArray(m.redFlags) && m.redFlags.length) {
    lines.push('Red flags :');
    m.redFlags.slice(0, 5).forEach(f => lines.push(`  - ${f}`));
  }
  lines.push('--- END TRANSCRIPT MEMORY ---\n\n');
  return lines.join('\n');
}

// === Local CEO Forensics (no LLM) ===
// Pre-computed before sending to the LLM, gives both deterministic stats and a head start.

const CONFIDENCE_WORDS = [
  'incredible', 'tremendous', 'excited', 'strong', 'record', 'best', 'outstanding',
  'momentum', 'accelerating', 'robust', 'healthy', 'confident', 'exceeding',
  'exceptional', 'compelling', 'breakthrough', 'leadership',
  'incroyable', 'formidable', 'excité', 'fort', 'record', 'meilleur',
  'momentum', 'accélér', 'solide', 'sain', 'confiant'
];

const CAUTION_WORDS = [
  'challenging', 'difficult', 'headwinds', 'pressure', 'uncertainty', 'cautious',
  'softness', 'weakness', 'slowdown', 'declining', 'decreased', 'concerns',
  'tough', 'mixed', 'volatile', 'risk',
  'difficile', 'défi', 'vent contraire', 'pression', 'incertitude', 'prudent',
  'mou', 'faiblesse', 'ralentissement', 'décli', 'baiss', 'préoccup', 'volatil', 'risque'
];

export function computeForensicsLocal(fullText) {
  if (!fullText || typeof fullText !== 'string') return null;
  const lower = fullText.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  function countAll(list) {
    let n = 0;
    for (const w of list) {
      const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const m = lower.match(re);
      if (m) n += m.length;
    }
    return n;
  }
  const confidence = countAll(CONFIDENCE_WORDS);
  const caution = countAll(CAUTION_WORDS);
  const total = confidence + caution;
  const confidenceRatio = total > 0 ? Math.round((confidence / total) * 100) : null;

  // Top repeated phrases (simple bigram counting)
  const bigrams = {};
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].replace(/[^a-zà-ÿ']/gi, '');
    const w2 = words[i + 1].replace(/[^a-zà-ÿ']/gi, '');
    if (w1.length < 4 || w2.length < 4) continue;
    const bg = w1 + ' ' + w2;
    bigrams[bg] = (bigrams[bg] || 0) + 1;
  }
  const topBigrams = Object.entries(bigrams)
    .filter(([_, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase, n]) => ({ phrase, count: n }));

  // Hedging language
  const hedges = (lower.match(/\b(we will not|we won't|we cannot|we can't|not planning|we don't|we are not)\b/g) || []).length;
  const positives = (lower.match(/\b(we will|we are planning|we are investing|we plan to|we expect)\b/g) || []).length;

  return {
    totalWords,
    confidenceCount: confidence,
    cautionCount: caution,
    confidenceRatio,
    topBigrams,
    hedgesCount: hedges,
    positivesCount: positives
  };
}

// === Memory snapshot extraction from LLM response ===
// The prompt asks the LLM to emit a fenced JSON block. Parse it.

export function extractMemorySnapshot(markdown) {
  if (!markdown) return null;
  // Look for ```json blocks containing keyHighlights or sentiment
  const fenceRe = /```json\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRe.exec(markdown)) !== null) {
    const inner = match[1].trim();
    try {
      const obj = JSON.parse(inner);
      if (obj && (obj.keyHighlights || obj.sentiment || obj.ceoTone || obj.importantNumbers)) {
        return obj;
      }
    } catch {}
  }
  return null;
}

// === Transcript parsers ===

export function parseSRT(srt) {
  // SRT block: index\nHH:MM:SS,mmm --> HH:MM:SS,mmm\ntext\n\n
  const blocks = srt.split(/\r?\n\r?\n/).map(b => b.trim()).filter(Boolean);
  const segments = [];
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    if (lines.length < 2) continue;
    const tsLine = lines.find(l => l.includes('-->'));
    if (!tsLine) continue;
    const [start, end] = tsLine.split('-->').map(s => s.trim());
    const textLines = lines.slice(lines.indexOf(tsLine) + 1);
    segments.push({ timeStart: start, timeEnd: end, text: textLines.join(' ').trim() });
  }
  return segments;
}

export function parseVTT(vtt) {
  // VTT is similar but uses dots for ms separator and may have headers
  const cleaned = vtt.replace(/^WEBVTT[^\n]*\n/, '').replace(/^NOTE[^\n]*\n/gm, '');
  const blocks = cleaned.split(/\r?\n\r?\n/).map(b => b.trim()).filter(Boolean);
  const segments = [];
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const tsLine = lines.find(l => l.includes('-->'));
    if (!tsLine) continue;
    const [start, end] = tsLine.split('-->').map(s => s.trim());
    const textLines = lines.slice(lines.indexOf(tsLine) + 1);
    segments.push({ timeStart: start, timeEnd: end, text: textLines.join(' ').trim() });
  }
  return segments;
}

export function segmentsToText(segments) {
  return segments.map(s => s.text).filter(Boolean).join(' ');
}

export function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
