// NewsAPI — actualités financières & macro (https://newsapi.org/docs)
// Free tier (Developer plan) : ~100 req/jour, browser direct calls BLOQUÉS.
// → Routé via /api/llm-proxy.
import { getDataKey } from '../data-keys.js';
import { bumpQuota } from '../data-quota.js';

const BASE = 'https://newsapi.org/v2';

function viaProxy(url) {
  const base = (typeof window !== 'undefined' && window.ALPHA_CONFIG?.LLM_PROXY_URL) || '/api/llm-proxy';
  return `${base}?url=${encodeURIComponent(url)}`;
}

async function call(path, params = {}) {
  const key = getDataKey('newsapi');
  if (!key) throw new Error('NewsAPI key not configured');
  const target = BASE + path + '?' + new URLSearchParams({ ...params, apiKey: key });
  const res = await fetch(viaProxy(target));
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`NewsAPI ${res.status}: ${t.slice(0, 120)}`);
  }
  bumpQuota('newsapi');
  return res.json();
}

// Sentiment lexical simple : compte mots-clés bull/bear → BULLISH/BEARISH/NEUTRAL.
// Précision ~70% sur titres financiers — suffisant pour MVP, pas LLM-grade.
const BULL_WORDS = ['surge','rally','soar','boom','jump','gain','rise','climb','bull','buy','strong','beat','record','high','breakout','moon','pump','upside','outperform','upgrade'];
const BEAR_WORDS = ['crash','plunge','plummet','sink','slump','fall','drop','decline','bear','sell','weak','miss','low','breakdown','dump','downside','underperform','downgrade','recession','crisis','risk','warning','fears'];

export function analyzeSentiment(text) {
  const t = String(text || '').toLowerCase();
  let bull = 0, bear = 0;
  for (const w of BULL_WORDS) if (t.includes(w)) bull++;
  for (const w of BEAR_WORDS) if (t.includes(w)) bear++;
  if (bull > bear + 1) return 'BULLISH';
  if (bear > bull + 1) return 'BEARISH';
  return 'NEUTRAL';
}

function shapeArticle(a) {
  const sentiment = analyzeSentiment((a.title || '') + ' ' + (a.description || ''));
  return {
    title: a.title,
    source: a.source?.name || 'Unknown',
    publishedAt: a.publishedAt,
    url: a.url,
    description: a.description,
    image: a.urlToImage,
    sentiment
  };
}

// Recherche full-text (endpoint /everything)
export async function newsSearch(query, { limit = 10, days = 7, lang = 'en' } = {}) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await call('/everything', {
    q: query,
    from,
    sortBy: 'publishedAt',
    language: lang,
    pageSize: String(limit)
  });
  const articles = (data.articles || []).map(shapeArticle);
  return {
    query,
    total: data.totalResults || articles.length,
    articles,
    overallSentiment: dominantSentiment(articles)
  };
}

// Top headlines (endpoint /top-headlines)
export async function newsTopHeadlines({ category = 'business', country = 'us', limit = 10 } = {}) {
  const data = await call('/top-headlines', {
    category, country, pageSize: String(limit)
  });
  const articles = (data.articles || []).map(shapeArticle);
  return { articles, overallSentiment: dominantSentiment(articles) };
}

function dominantSentiment(articles) {
  const counts = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
  for (const a of articles) counts[a.sentiment]++;
  if (counts.BULLISH > counts.BEARISH) return 'BULLISH';
  if (counts.BEARISH > counts.BULLISH) return 'BEARISH';
  return 'NEUTRAL';
}
