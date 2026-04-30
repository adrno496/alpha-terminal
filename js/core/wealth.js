// Wealth tracker — mémoire centralisée du patrimoine de l'utilisateur
// Stockage IndexedDB. Sert de contexte pour toutes les analyses (toggle "📊 Use my wealth").

import { uuid } from './utils.js';

const DB_NAME = 'alpha-terminal';
const STORE = 'wealth';

const SNAPSHOT_STORE = 'wealth_snapshots';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 9);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('analyses')) {
        const s = db.createObjectStore('analyses', { keyPath: 'id' });
        s.createIndex('module', 'module', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('writingStyles')) db.createObjectStore('writingStyles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('knowledge'))      db.createObjectStore('knowledge',     { keyPath: 'id' });
      if (!db.objectStoreNames.contains('wealth'))         db.createObjectStore('wealth',        { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const ws = db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode = 'readonly', store = STORE) {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}
function p(req) { return new Promise((r, rj) => { req.onsuccess = () => r(req.result); req.onerror = () => rj(req.error); }); }

// === Schema ===
// {
//   id, name, ticker, category, account, quantity, unit, value, currency, costBasis, notes,
//   priceLastUpdated, autoValue (boolean: si true, value = quantity × current price),
//   createdAt, updatedAt
// }

export const WEALTH_CATEGORIES = [
  { id: 'stocks',      label: 'Stocks / Actions',     icon: '📈' },
  { id: 'etf',         label: 'ETF',                  icon: '📊' },
  { id: 'crypto',      label: 'Crypto',               icon: '🪙' },
  { id: 'cash',        label: 'Cash / Liquidités',    icon: '💵' },
  { id: 'bonds',       label: 'Obligations',          icon: '📜' },
  { id: 'retirement',  label: 'Retraite (PEA/PER…)',  icon: '🏦' },
  { id: 'real_estate', label: 'Immobilier',           icon: '🏠' },
  { id: 'commodities', label: 'Commodities (or…)',    icon: '🥇' },
  { id: 'private',     label: 'Private equity / VC',  icon: '💼' },
  { id: 'other',       label: 'Autre',                icon: '·' }
];

export async function listWealth() {
  const store = await tx();
  return new Promise((resolve, reject) => {
    const out = [];
    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function getHolding(id) {
  const store = await tx();
  return p(store.get(id));
}

export async function saveHolding(h) {
  const store = await tx('readwrite');
  const now = new Date().toISOString();
  if (!h.id) h.id = uuid();
  if (!h.createdAt) h.createdAt = now;
  h.updatedAt = now;
  await p(store.put(h));
  return h;
}

export async function deleteHolding(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

export async function clearWealth() {
  const store = await tx('readwrite');
  return p(store.clear());
}

export async function bulkImport(records) {
  const store = await tx('readwrite');
  for (const r of records) {
    if (!r.id) r.id = uuid();
    await p(store.put(r));
  }
}

// === Live price refresh ===
// Refresh the value of holdings that have ticker + autoValue = true
export async function refreshPrices(progressCb = null) {
  const list = await listWealth();
  const refreshable = list.filter(h => h.ticker && h.autoValue);
  if (!refreshable.length) return { updated: 0, total: list.length };

  // Lazy import to avoid circular
  const { fetchCoinData } = await import('./coingecko.js');
  const { fmpQuote } = await import('./data-providers/fmp.js');
  const { finnhubQuote } = await import('./data-providers/finnhub.js');
  const { tdQuote } = await import('./data-providers/twelvedata.js');
  const { polygonPrevClose } = await import('./data-providers/polygon.js');
  const { tiingoIex } = await import('./data-providers/tiingo.js');
  const { avQuote } = await import('./data-providers/alphavantage.js');
  const { getDataKey } = await import('./data-keys.js');

  let updated = 0;
  for (let i = 0; i < refreshable.length; i++) {
    const h = refreshable[i];
    if (progressCb) progressCb({ i: i + 1, total: refreshable.length, ticker: h.ticker });
    let price = null;
    try {
      if (h.category === 'crypto') {
        const cg = await fetchCoinData(h.ticker);
        if (cg) price = cg.price_usd;
      } else {
        // Stocks / ETF — chain de fallback
        if (!price && getDataKey('fmp'))          { try { const q = await fmpQuote(h.ticker);          if (q) price = q.price; } catch {} }
        if (!price && getDataKey('finnhub'))      { try { const q = await finnhubQuote(h.ticker);      if (q) price = q.price; } catch {} }
        if (!price && getDataKey('polygon'))      { try { const q = await polygonPrevClose(h.ticker); if (q) price = q.close; } catch {} }
        if (!price && getDataKey('twelvedata'))   { try { const q = await tdQuote(h.ticker);           if (q) price = q.price; } catch {} }
        if (!price && getDataKey('tiingo'))       { try { const q = await tiingoIex(h.ticker);         if (q) price = q.price; } catch {} }
        if (!price && getDataKey('alphavantage')) { try { const q = await avQuote(h.ticker);           if (q) price = q.price; } catch {} }
      }
    } catch {}
    if (price && price > 0) {
      h.value = +(price * (h.quantity || 0)).toFixed(2);
      h.priceLastUpdated = new Date().toISOString();
      h.lastPrice = price;
      h.unitPrice = price; // synchronise unit price avec live
      await saveHolding(h);
      updated++;
    }
  }
  return { updated, total: refreshable.length };
}

// === Aggregation helpers ===
// Convertit toutes les valeurs vers une devise commune via Frankfurter (EUR par défaut)
export async function getTotals(targetCurrency = 'EUR') {
  const list = await listWealth();
  const { fxLatest } = await import('./data-providers/frankfurter.js');

  // Récupère taux pour toutes les devises présentes
  const currencies = [...new Set(list.map(h => h.currency || 'EUR'))];
  const ratesByPair = {};
  // Frankfurter : on demande latest base = target → rates pour autres
  try {
    const r = await fxLatest(targetCurrency, currencies.filter(c => c !== targetCurrency));
    // Note : r.rates[X] = combien de X pour 1 target. Pour convertir X → target : value / rate
    for (const c of currencies) {
      if (c === targetCurrency) ratesByPair[c] = 1;
      else if (r.rates && r.rates[c]) ratesByPair[c] = 1 / r.rates[c]; // X → target
      else ratesByPair[c] = 1; // fallback : pas de conversion
    }
  } catch {
    for (const c of currencies) ratesByPair[c] = 1;
  }

  let total = 0;
  const byCategory = {};
  for (const h of list) {
    const v = (h.value || 0) * (ratesByPair[h.currency || 'EUR'] || 1);
    total += v;
    const cat = h.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + v;
  }
  return { total, byCategory, currency: targetCurrency, count: list.length };
}

// === Format wealth as context block for LLM injection ===
export async function buildWealthContext(targetCurrency = 'EUR') {
  const list = await listWealth();
  if (!list.length) return '';
  const totals = await getTotals(targetCurrency);
  const sym = ({ USD: '$', EUR: '€', GBP: '£', CHF: 'CHF', JPY: '¥' })[targetCurrency] || targetCurrency;

  const lines = ['', `[USER WEALTH CONTEXT — total: ${sym}${fmtNum(totals.total)} across ${totals.count} holdings]`, ''];

  // Group by category
  for (const cat of WEALTH_CATEGORIES) {
    const items = list.filter(h => (h.category || 'other') === cat.id);
    if (!items.length) continue;
    const catTotal = totals.byCategory[cat.id] || 0;
    const pct = totals.total > 0 ? (catTotal / totals.total * 100).toFixed(1) : '0';
    lines.push(`${cat.icon} ${cat.label} (${pct}% — ${sym}${fmtNum(catTotal)}):`);
    // On envoie TOUTES les lignes au LLM (max 200 par catégorie pour rester sous quota tokens
    // sur des portfolios massifs). Le coût d'1 ligne ~ 30-50 tokens, marge confortable.
    const HOLDINGS_PER_CAT_HARD_CAP = 200;
    for (const h of items.slice(0, HOLDINGS_PER_CAT_HARD_CAP)) {
      const v = h.value || 0;
      const ccy = h.currency || 'EUR';
      const ccySym = ({ USD: '$', EUR: '€', GBP: '£' })[ccy] || ccy;
      const tk = h.ticker ? ` [${h.ticker}]` : '';
      const acc = h.account ? ` · ${h.account}` : '';
      // Pour l'immobilier : ajouter loanRemaining + propertyType + cashflow si dispo
      let immoSuffix = '';
      if (h.category === 'real_estate') {
        const parts = [];
        if (h.propertyType) parts.push(h.propertyType === 'locatif' ? 'locatif' : h.propertyType === 'secondary_residence' ? 'résidence secondaire' : 'résidence principale');
        if (Array.isArray(h.loans) && h.loans.length) {
          const totalRemaining = h.loans.reduce((s, l) => s + (Number(l.remaining) || Number(l.amount) || 0), 0);
          if (totalRemaining > 0) parts.push(`reste à payer ${ccySym}${fmtNum(totalRemaining)}`);
        } else if (h.loanAmount) {
          parts.push(`prêt ${ccySym}${fmtNum(h.loanAmount)}`);
        }
        if (h.monthlyRent) parts.push(`loyer ${ccySym}${fmtNum(h.monthlyRent)}/mois`);
        if (parts.length) immoSuffix = ' · ' + parts.join(' · ');
      }
      lines.push(`  - ${h.name}${tk}: ${ccySym}${fmtNum(v)}${h.quantity ? ' (qty ' + h.quantity + ')' : ''}${acc}${immoSuffix}`);
    }
    if (items.length > HOLDINGS_PER_CAT_HARD_CAP) lines.push(`  - … +${items.length - HOLDINGS_PER_CAT_HARD_CAP} more (truncated)`);
  }
  lines.push('');
  lines.push('Use this context to tailor your analysis: consider existing exposure, diversification, concentration risk, currency mix. Avoid recommending what the user already heavily owns unless thesis is exceptionally strong.');
  lines.push('');
  return lines.join('\n');
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

// === SNAPSHOTS — historique du patrimoine pour la courbe d'évolution ===

// Sauve un snapshot du patrimoine actuel (totals + holdings figés à cette date)
export async function takeSnapshot(currency = 'EUR', label = null) {
  const list = await listWealth();
  if (!list.length) return null;
  const totals = await getTotals(currency);
  const snap = {
    id: uuid(),
    date: new Date().toISOString(),
    label: label || null,
    currency,
    total: totals.total,
    byCategory: totals.byCategory,
    holdingsCount: list.length,
    // Snapshot léger des holdings (sans embeddings/lourds champs)
    holdings: list.map(h => ({
      id: h.id, name: h.name, ticker: h.ticker, category: h.category,
      currency: h.currency, value: h.value, quantity: h.quantity,
      lastPrice: h.lastPrice
    }))
  };
  const store = await tx('readwrite', SNAPSHOT_STORE);
  await p(store.put(snap));
  return snap;
}

// Liste les snapshots triés par date (du plus ancien au plus récent)
export async function listSnapshots() {
  const store = await tx('readonly', SNAPSHOT_STORE);
  return new Promise((resolve, reject) => {
    const out = [];
    const cursor = store.index('date').openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function deleteSnapshot(id) {
  const store = await tx('readwrite', SNAPSHOT_STORE);
  return p(store.delete(id));
}

export async function clearSnapshots() {
  const store = await tx('readwrite', SNAPSHOT_STORE);
  return p(store.clear());
}

// Auto-snapshot : si pas de snapshot dans les 24 dernières heures, en prendre un
export async function maybeAutoSnapshot(currency = 'EUR') {
  const list = await listWealth();
  if (!list.length) return null;
  const snaps = await listSnapshots();
  const last = snaps[snaps.length - 1];
  if (last) {
    const ageHours = (Date.now() - new Date(last.date).getTime()) / (3600 * 1000);
    if (ageHours < 20) return null; // déjà snapshot récent
  }
  return await takeSnapshot(currency, 'auto');
}

// Backfill historique : pour chaque holding avec ticker + autoValue,
// fetch les prix historiques sur N jours et reconstruit la courbe par jour.
// Nécessite FMP key (endpoint /historical-price-full) ou fallback Twelve Data.
export async function backfillHistory({ days = 90, currency = 'EUR', onProgress = null } = {}) {
  const list = await listWealth();
  const tickered = list.filter(h => h.ticker && h.autoValue);
  if (!tickered.length) throw new Error('Aucune holding avec ticker + auto-fetch activé');

  const { getDataKey } = await import('./data-keys.js');
  const hasFmp = !!getDataKey('fmp');
  const hasTd  = !!getDataKey('twelvedata');
  const { fxLatest } = await import('./data-providers/frankfurter.js');

  // 1. Fetch historique pour chaque ticker
  const histByTicker = {};
  for (let i = 0; i < tickered.length; i++) {
    const h = tickered[i];
    if (onProgress) onProgress({ i: i + 1, total: tickered.length, ticker: h.ticker });
    let series = [];
    try {
      if (h.category === 'crypto') {
        // CoinGecko market_chart pour crypto historique
        const id = await resolveCgId(h.ticker);
        if (id) series = await cgHistorical(id, days);
      } else if (hasFmp) {
        series = await fmpHistorical(h.ticker, days);
      } else if (hasTd) {
        series = await tdHistorical(h.ticker, days);
      }
    } catch (e) { console.warn('History fetch failed for', h.ticker, e.message); }
    if (series.length) histByTicker[h.id] = { series, holding: h };
  }

  // 2. Construis une série temporelle de la valeur totale par jour
  // Pour chaque date, somme (qty × price) pour tous les holdings
  // Pour les holdings sans historique (real estate, cash) = valeur constante
  const constants = list.filter(h => !histByTicker[h.id]).reduce((sum, h) => sum + (h.value || 0) * 1, 0);

  // Toutes les dates uniques
  const allDates = new Set();
  for (const v of Object.values(histByTicker)) v.series.forEach(p => allDates.add(p.date));
  const dates = Array.from(allDates).sort();

  // FX rates pour conversion (simplifié : on assume USD pour les histories)
  const fxRates = {};
  try {
    const r = await fxLatest(currency, ['USD']);
    fxRates['USD'] = r.rates?.USD ? 1 / r.rates.USD : 1;
    fxRates[currency] = 1;
  } catch { fxRates['USD'] = 1; fxRates[currency] = 1; }

  // 3. Pour chaque date, agrège
  const snapshots = dates.map(date => {
    let total = constants;
    const byCategory = { ...{} };
    for (const v of Object.values(histByTicker)) {
      const point = v.series.find(p => p.date === date);
      if (point) {
        const v_ = point.price * (v.holding.quantity || 0) * (fxRates[v.holding.currency] || 1);
        total += v_;
        const cat = v.holding.category || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + v_;
      }
    }
    return {
      id: 'backfill-' + date,
      date: new Date(date).toISOString(),
      label: 'backfill',
      currency,
      total,
      byCategory,
      holdingsCount: list.length
    };
  });

  // 4. Sauvegarde tous ces snapshots
  const store = await tx('readwrite', SNAPSHOT_STORE);
  for (const s of snapshots) await p(store.put(s));
  return { count: snapshots.length, days };
}

// FMP historical-price-full
async function fmpHistorical(ticker, days) {
  const { getDataKey } = await import('./data-keys.js');
  const key = getDataKey('fmp');
  if (!key) return [];
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?serietype=line&apikey=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.historical)) return [];
  // Limit to last N days, oldest first
  const points = data.historical.slice(0, days).reverse().map(p => ({ date: p.date, price: p.close }));
  return points;
}

// Twelve Data time_series
async function tdHistorical(ticker, days) {
  const { getDataKey } = await import('./data-keys.js');
  const key = getDataKey('twelvedata');
  if (!key) return [];
  const url = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=${days}&apikey=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.values)) return [];
  return data.values.reverse().map(p => ({ date: p.datetime, price: parseFloat(p.close) }));
}

// CoinGecko : resolve symbol → id, then fetch market_chart
async function resolveCgId(symbol) {
  const { resolveCoinId } = await import('./coingecko.js');
  return resolveCoinId(symbol);
}
async function cgHistorical(id, days) {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.prices)) return [];
  return data.prices.map(([ts, price]) => ({
    date: new Date(ts).toISOString().slice(0, 10),
    price
  }));
}

// === Toggle helpers (per-module preference) ===
const TOGGLE_KEY = 'alpha-terminal:wealth-context';
export function isWealthContextEnabledFor(moduleId) {
  try { return JSON.parse(localStorage.getItem(TOGGLE_KEY) || '[]').includes(moduleId); }
  catch { return false; }
}
export function setWealthContextEnabled(moduleId, on) {
  let arr;
  try { arr = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '[]'); } catch { arr = []; }
  const set = new Set(arr);
  if (on) set.add(moduleId); else set.delete(moduleId);
  localStorage.setItem(TOGGLE_KEY, JSON.stringify([...set]));
}
