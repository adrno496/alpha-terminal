// RAG client-side : chunking, embedding, retrieval, storage
// Stockage IndexedDB → store 'knowledge' avec { id, type, title, tags, chunks: [{text, embedding}], createdAt }

import { embedBatch, embed, cosine } from './embeddings.js';
import { uuid } from './utils.js';
import { openWithMinVersion } from './db-open.js';

const DB_NAME = 'alpha-terminal';
const STORE = 'knowledge';

function openDB() {
  return openWithMinVersion(DB_NAME, 2, (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('analyses')) {
      const s = db.createObjectStore('analyses', { keyPath: 'id' });
      s.createIndex('module', 'module', { unique: false });
      s.createIndex('createdAt', 'createdAt', { unique: false });
    }
    if (!db.objectStoreNames.contains('writingStyles')) {
      db.createObjectStore('writingStyles', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: 'id' });
    }
  });
}

function tx(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}
function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// === Chunking ===
// Découpe un texte en chunks ~500 mots avec overlap 100 mots
export function chunkText(text, { chunkSize = 500, overlap = 100 } = {}) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
    i += chunkSize - overlap;
    if (chunks.length > 200) break; // safety
  }
  return chunks;
}

// === Storage ===
export async function listKnowledge() {
  const store = await tx();
  return new Promise((resolve, reject) => {
    const out = [];
    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      const v = c.value;
      // Strip embeddings pour économiser la RAM dans les listings
      out.push({ id: v.id, type: v.type, title: v.title, tags: v.tags, chunkCount: (v.chunks || []).length, createdAt: v.createdAt });
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function getKnowledge(id) {
  const store = await tx();
  return reqAsPromise(store.get(id));
}

export async function deleteKnowledge(id) {
  const store = await tx('readwrite');
  return reqAsPromise(store.delete(id));
}

export async function clearKnowledge() {
  const store = await tx('readwrite');
  return reqAsPromise(store.clear());
}

// Indexe un texte (note ou PDF extrait) → chunke + embed + save
export async function indexDocument({ type, title, content, tags = [] }) {
  const chunks = chunkText(content);
  if (!chunks.length) throw new Error('Document vide');
  const embeddings = await embedBatch(chunks);
  const record = {
    id: uuid(),
    type, // 'note' | 'pdf'
    title,
    tags,
    chunks: chunks.map((text, i) => ({ text, embedding: embeddings[i] })),
    createdAt: new Date().toISOString()
  };
  const store = await tx('readwrite');
  await reqAsPromise(store.put(record));
  return record;
}

// === Retrieval ===
// Cherche les top-K chunks les plus similaires à la query, dans toute la KB
export async function retrieve(query, { topK = 6, minScore = 0.15 } = {}) {
  const queryVec = await embed(query);
  if (!queryVec) return [];
  const store = await tx();
  return new Promise((resolve, reject) => {
    const candidates = [];
    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) {
        candidates.sort((a, b) => b.score - a.score);
        const top = candidates.slice(0, topK).filter(c => c.score >= minScore);
        return resolve(top);
      }
      const doc = c.value;
      for (const ch of (doc.chunks || [])) {
        const score = cosine(queryVec, ch.embedding);
        candidates.push({ score, text: ch.text, docId: doc.id, docTitle: doc.title, docType: doc.type });
      }
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

// Construit le bloc de contexte à injecter dans un prompt user
export function buildRagContext(retrieved) {
  if (!retrieved || !retrieved.length) return '';
  const blocks = retrieved.map((r, i) =>
    `[Source ${i+1}] ${r.docTitle} (similarité ${(r.score*100).toFixed(0)}%)\n${r.text}`
  ).join('\n\n---\n\n');
  return `\n\n[CONTEXTE DEPUIS TA KNOWLEDGE BASE PERSONNELLE — passages les plus pertinents]\n\n${blocks}\n\n[FIN DU CONTEXTE — utilise ces passages pour ancrer ton analyse dans la connaissance personnelle de l'utilisateur]\n\n`;
}
