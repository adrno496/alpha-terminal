// Embeddings via OpenAI API — utilisé pour le RAG client-side
// Si pas de clé OpenAI, fallback à un hash-based mock (recherche par mots-clés via JS uniquement)

import { getOrchestrator } from './api.js';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';

// Petit cache mémoire pour ne pas réembedder le même texte
const memCache = new Map();

export const EMBED_DIM = 1536; // text-embedding-3-small

export async function embed(text) {
  if (!text) return null;
  const key = text.slice(0, 200);
  if (memCache.has(key)) return memCache.get(key);

  // Cherche la clé OpenAI en mémoire via l'orchestrateur
  let openaiKey = null;
  try {
    const orch = getOrchestrator();
    const provider = orch.providers?.openai;
    if (provider) openaiKey = provider.apiKey;
  } catch {}

  if (!openaiKey) {
    // Fallback : embedding "fake" basé sur hash des mots — utile uniquement pour exact-match keyword retrieval
    const v = fakeEmbedding(text);
    memCache.set(key, v);
    return v;
  }

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000) // safety
      })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Embeddings ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const v = data.data?.[0]?.embedding;
    if (v) memCache.set(key, v);
    return v;
  } catch (e) {
    console.warn('Embedding failed, fallback to hash:', e.message);
    const v = fakeEmbedding(text);
    memCache.set(key, v);
    return v;
  }
}

// Batch embedding (jusqu'à 100 textes par appel)
export async function embedBatch(texts) {
  if (!texts || !texts.length) return [];
  let openaiKey = null;
  try {
    const orch = getOrchestrator();
    const provider = orch.providers?.openai;
    if (provider) openaiKey = provider.apiKey;
  } catch {}

  if (!openaiKey) return texts.map(t => fakeEmbedding(t));

  const out = [];
  // Batch en chunks de 96 (limite raisonnable)
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96).map(t => (t || '').slice(0, 8000));
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: batch })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Embeddings batch ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const item of (data.data || [])) out.push(item.embedding);
  }
  return out;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Embedding factice basé sur hash de mots — pour keyword-search fallback
function fakeEmbedding(text) {
  const words = (text || '').toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const v = new Array(EMBED_DIM).fill(0);
  for (const w of words) {
    let h = 0;
    for (let i = 0; i < w.length; i++) h = ((h << 5) - h + w.charCodeAt(i)) | 0;
    v[Math.abs(h) % EMBED_DIM] += 1;
  }
  // Normalize
  let n = 0;
  for (const x of v) n += x * x;
  if (n === 0) return v;
  const inv = 1 / Math.sqrt(n);
  return v.map(x => x * inv);
}

export function hasEmbeddingProvider() {
  try {
    return !!getOrchestrator().providers?.openai;
  } catch { return false; }
}
