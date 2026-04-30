// Price alerts : extraction depuis transcripts YouTube + monitoring contre prix live.
// Schéma d'une alerte :
//   { id, ticker, name, direction: 'above'|'below', targetPrice, currency, kind: 'entry'|'exit'|'stop',
//     source: { type: 'youtube'|'manual', transcriptId?, videoTitle?, quote? },
//     notes, status: 'active'|'triggered'|'dismissed',
//     createdAt, triggeredAt?, lastCheckedAt?, lastObservedPrice? }

import { uuid } from './utils.js';

const DB_NAME = 'alpha-terminal';
const STORE = 'price_alerts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 8);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}
function p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

export async function listPriceAlerts({ status = null, ticker = null } = {}) {
  const store = await tx();
  return new Promise((resolve) => {
    const out = [];
    const cursor = ticker ? store.index('ticker').openCursor(IDBKeyRange.only(ticker)) : store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      if (!status || c.value.status === status) out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => resolve(out);
  });
}

export async function savePriceAlert(alert) {
  const store = await tx('readwrite');
  if (!alert.id) alert.id = uuid();
  if (!alert.createdAt) alert.createdAt = new Date().toISOString();
  if (!alert.status) alert.status = 'active';
  await p(store.put(alert));
  return alert;
}

export async function deletePriceAlert(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

export async function bulkSaveAlerts(alerts) {
  const store = await tx('readwrite');
  let saved = 0;
  for (const a of alerts) {
    if (!a.id) a.id = uuid();
    if (!a.createdAt) a.createdAt = new Date().toISOString();
    if (!a.status) a.status = 'active';
    try { await p(store.put(a)); saved++; } catch {}
  }
  return saved;
}

// === EXTRACTION depuis le markdown d'un transcript YouTube ===
//
// Heuristique pure regex (pas de LLM second-pass) : on cherche les patterns courants
// que l'IA produit dans une analyse vidéo (sections "Niveaux à surveiller", "Entrée à $X").
//
// Patterns supportés :
//   - "TICKER above/under/à $123.45" / "≥ 100€"
//   - Lignes du type "AAPL : entrée 180$, stop 165$, objectif 220$"
//   - Tables markdown avec colonnes Ticker / Niveau / Action
export function extractAlertsFromTranscript({ transcriptId, videoTitle, ticker, markdownOutput }) {
  if (!markdownOutput || typeof markdownOutput !== 'string') return [];
  const text = markdownOutput;
  const alerts = [];
  const seen = new Set();

  // Pattern 0 : format structuré "- TICKER · type · prix" (forcé par notre prompt)
  const structuredPattern = /[\-\*•]\s*([A-Z][A-Z0-9.\-]{0,9})\s*[·•|]\s*(entrée|entree|entry|sortie|exit|stop|stop-loss|objectif|target|cible|résistance|resistance|support)\s*[·•|]\s*([\$€£]?\s?[0-9]+(?:[.,][0-9]+)?\s?[\$€£]?)/gi;
  let smatch;
  while ((smatch = structuredPattern.exec(text)) !== null) {
    const tk = smatch[1].toUpperCase();
    const typeRaw = smatch[2].toLowerCase();
    const priceRaw = smatch[3];
    const price = parseFloat(priceRaw.replace(/[\$€£\s]/g, '').replace(',', '.'));
    if (isNaN(price) || price <= 0 || price > 1e7) continue;
    if (/^(EUR|USD|GBP|CHF|JPY|AUD|CAD)$/.test(tk)) continue;

    let kind = 'entry', direction = 'above';
    if (/(sortie|exit|objectif|target|cible|résistance|resistance)/.test(typeRaw)) { kind = /resistance|résistance/.test(typeRaw) ? 'entry' : 'exit'; direction = 'above'; }
    if (/(stop|support)/.test(typeRaw)) { kind = 'stop'; direction = 'below'; }
    if (/(entr[ée]e|entry)/.test(typeRaw)) { kind = 'entry'; direction = 'above'; }

    let currency = 'USD';
    if (/€/.test(priceRaw)) currency = 'EUR';
    else if (/£/.test(priceRaw)) currency = 'GBP';

    const key = `${tk}|${direction}|${price.toFixed(2)}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    alerts.push({
      id: uuid(),
      ticker: tk,
      name: tk,
      direction, targetPrice: price, currency, kind,
      source: { type: 'youtube', transcriptId, videoTitle: videoTitle || null, quote: smatch[0].trim() },
      status: 'active',
      createdAt: new Date().toISOString()
    });
  }

  // Pattern 1 (fallback) : ligne avec mots-clés "entrée|achat|buy|long" / "sortie|vente|sell|stop|short" + prix
  const linePattern = /(?:^|\n)[^\n]*?(?:\b(?:entrée|entree|achat|buy|long|target|objectif|cible|sortie|vente|sell|stop|short|alerte|niveau|seuil|cassure|breakout|support|résistance|resistance)\b)[^\n]*?([\$€£]?\s?[0-9]+(?:[.,][0-9]+)?\s?[\$€£]?)/gi;
  let match;
  while ((match = linePattern.exec(text)) !== null) {
    const line = match[0].replace(/^\n/, '');
    const priceRaw = match[1];
    const price = parseFloat(priceRaw.replace(/[\$€£\s]/g, '').replace(',', '.'));
    if (isNaN(price) || price <= 0 || price > 1e7) continue;

    const lower = line.toLowerCase();
    let kind = 'entry';
    let direction = 'above';
    if (/\b(sortie|vente|sell|stop|short)\b/.test(lower)) {
      kind = lower.includes('stop') ? 'stop' : 'exit';
    }
    if (/\b(stop|support|cassure)\b/.test(lower) && !/\b(résistance|resistance|breakout|cassure haussiere)\b/.test(lower)) {
      direction = 'below';
    }
    if (/\b(objectif|target|cible|résistance|resistance|breakout)\b/.test(lower)) {
      direction = 'above';
    }
    // Currency detection
    let currency = 'USD';
    if (/€/.test(priceRaw) || /\beur\b|\beuros?\b/i.test(line)) currency = 'EUR';
    else if (/£/.test(priceRaw) || /\bgbp\b|\blivres?\b/i.test(line)) currency = 'GBP';

    // Ticker detection : on prend le ticker du transcript si fourni, sinon on cherche un pattern A-Z 1-5 chars
    let alertTicker = ticker || '';
    if (!alertTicker) {
      const tkMatch = line.match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,3})?\b/);
      if (tkMatch && !/^(EUR|USD|GBP|CHF|JPY|THE|AND|FOR|YOU|THIS|THAT)$/.test(tkMatch[0])) {
        alertTicker = tkMatch[0];
      }
    }
    if (!alertTicker) continue;

    const key = `${alertTicker}|${direction}|${price.toFixed(2)}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    alerts.push({
      id: uuid(),
      ticker: alertTicker.toUpperCase(),
      name: alertTicker.toUpperCase(),
      direction,
      targetPrice: price,
      currency,
      kind,
      source: {
        type: 'youtube',
        transcriptId,
        videoTitle: videoTitle || null,
        quote: line.trim().slice(0, 240)
      },
      status: 'active',
      createdAt: new Date().toISOString()
    });
  }

  return alerts;
}

// === CHECK vs prix actuel ===
// Pour chaque alerte active, on vérifie si le prix actuel a franchi le seuil.
// Utilise les data-providers existants (FMP, Finnhub, CoinGecko) si configurés.
//
// Retourne : { triggered: [...], stillWaiting: [...], errors: [...] }
export async function checkPriceAlerts({ progressCb = null } = {}) {
  const active = await listPriceAlerts({ status: 'active' });
  if (active.length === 0) return { triggered: [], stillWaiting: [], errors: [] };

  const result = { triggered: [], stillWaiting: [], errors: [] };

  // Lazy-load des providers (pas tous installés forcément)
  let fmpQuote, finnhubQuote, fetchCoinData, getDataKey;
  try { ({ fmpQuote }     = await import('./data-providers/fmp.js')); } catch {}
  try { ({ finnhubQuote } = await import('./data-providers/finnhub.js')); } catch {}
  try { ({ fetchCoinData }= await import('./coingecko.js')); } catch {}
  try { ({ getDataKey }   = await import('./data-keys.js')); } catch {}

  // Group by ticker pour faire un fetch par ticker
  const byTicker = {};
  for (const a of active) (byTicker[a.ticker] = byTicker[a.ticker] || []).push(a);

  let i = 0;
  for (const [ticker, alerts] of Object.entries(byTicker)) {
    i++;
    if (progressCb) progressCb({ ticker, i, total: Object.keys(byTicker).length });
    let price = null;

    // Crypto first (heuristic : BTC/ETH/SOL etc. tickers courts)
    try {
      if (fetchCoinData && /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|LINK|DOT|MATIC|ATOM|UNI|LTC)$/i.test(ticker)) {
        const cg = await fetchCoinData(ticker);
        if (cg && cg.price_usd) price = cg.price_usd;
      }
    } catch {}

    // Stocks
    if (price == null && fmpQuote && getDataKey && getDataKey('fmp')) {
      try { const q = await fmpQuote(ticker); if (q?.price) price = q.price; } catch {}
    }
    if (price == null && finnhubQuote && getDataKey && getDataKey('finnhub')) {
      try { const q = await finnhubQuote(ticker); if (q?.price) price = q.price; } catch {}
    }

    if (price == null) {
      result.errors.push({ ticker, reason: 'no-price-source' });
      continue;
    }

    for (const alert of alerts) {
      const isTriggered = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
      alert.lastObservedPrice = price;
      alert.lastCheckedAt = new Date().toISOString();
      if (isTriggered) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date().toISOString();
        await savePriceAlert(alert);
        result.triggered.push(alert);
        // Push notification système (Web ou Capacitor) — silencieux si refusé
        try {
          const { notifyPriceAlert } = await import('./notifications.js');
          await notifyPriceAlert(alert);
        } catch (e) { /* silent */ }
      } else {
        await savePriceAlert(alert);
        result.stillWaiting.push(alert);
      }
    }
  }
  return result;
}

export async function dismissAlert(id) {
  const all = await listPriceAlerts();
  const a = all.find(x => x.id === id);
  if (!a) return;
  a.status = 'dismissed';
  await savePriceAlert(a);
}

export async function reactivateAlert(id) {
  const all = await listPriceAlerts();
  const a = all.find(x => x.id === id);
  if (!a) return;
  a.status = 'active';
  delete a.triggeredAt;
  await savePriceAlert(a);
}
