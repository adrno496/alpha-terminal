// Spot prices commodities (or, argent, platine, palladium, pétrole) via 2 sources :
//   1. metals-api.com (gratuit 50 req/mois) — clé optionnelle
//   2. FRED (Federal Reserve) — gratuit, oz historique
// Fallback : conversion USD/EUR via Frankfurter (gratuit, sans clé)

const SPOT_CACHE_KEY = 'alpha-terminal:spot-prices:cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const COMMODITY_TICKERS = {
  GOLD:      { name: 'Or (oz)',       unit: 'oz_t', symbol: 'XAU' },
  SILVER:    { name: 'Argent (oz)',   unit: 'oz_t', symbol: 'XAG' },
  PLATINUM:  { name: 'Platine (oz)',  unit: 'oz_t', symbol: 'XPT' },
  PALLADIUM: { name: 'Palladium (oz)',unit: 'oz_t', symbol: 'XPD' },
  OIL_WTI:   { name: 'Pétrole WTI ($/baril)', unit: 'barrel', symbol: 'CL' }
};

function getCache() {
  try { return JSON.parse(localStorage.getItem(SPOT_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function setCache(data) {
  localStorage.setItem(SPOT_CACHE_KEY, JSON.stringify(data));
}

// Récupère le spot price USD pour un commodity ticker.
// Stratégie :
//   1. Cache 1h
//   2. metals-api si clé configurée (dataKey 'metals_api')
//   3. FRED si clé configurée (gold = "GOLDAMGBD228NLBM")
//   4. Sinon : retourne null (UI affiche "configurer source")
export async function getSpotPrice(ticker, { force = false } = {}) {
  if (!COMMODITY_TICKERS[ticker]) return null;
  const cache = getCache();
  const now = Date.now();
  if (!force && cache[ticker] && (now - cache[ticker].fetchedAt) < CACHE_TTL_MS) {
    return cache[ticker];
  }

  let getDataKey;
  try { ({ getDataKey } = await import('./data-keys.js')); } catch {}
  const metalsKey = getDataKey ? getDataKey('metals_api') : null;
  const fredKey = getDataKey ? getDataKey('fred') : null;

  // Source 1 : metals-api
  if (metalsKey && /^(GOLD|SILVER|PLATINUM|PALLADIUM)$/.test(ticker)) {
    try {
      const sym = COMMODITY_TICKERS[ticker].symbol;
      const r = await fetch(`https://metals-api.com/api/latest?access_key=${metalsKey}&base=USD&symbols=${sym}`);
      const j = await r.json();
      if (j.success && j.rates && j.rates[sym]) {
        // metals-api retourne le rate en USD per troy ounce → mais c'est l'inverse selon la doc
        // rates[XAU] = 1 USD = X oz, donc price USD/oz = 1/rates[XAU]
        const priceUsdPerOz = 1 / j.rates[sym];
        const result = { ticker, priceUSD: priceUsdPerOz, source: 'metals-api', fetchedAt: now };
        cache[ticker] = result; setCache(cache);
        return result;
      }
    } catch (e) { console.warn('[spot] metals-api failed:', e); }
  }

  // Source 2 : FRED (or seulement, série GOLDAMGBD228NLBM = London PM Fix)
  if (fredKey && ticker === 'GOLD') {
    try {
      const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=GOLDAMGBD228NLBM&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`);
      const j = await r.json();
      if (j.observations && j.observations.length) {
        const v = parseFloat(j.observations[0].value);
        if (!isNaN(v)) {
          const result = { ticker, priceUSD: v, source: 'fred', fetchedAt: now, observationDate: j.observations[0].date };
          cache[ticker] = result; setCache(cache);
          return result;
        }
      }
    } catch (e) { console.warn('[spot] FRED failed:', e); }
  }

  // Pas de source configurée
  return null;
}

// Convertit USD → EUR via Frankfurter (free, no key)
let _eurUsdCache = { rate: null, fetchedAt: 0 };
export async function getEurUsdRate() {
  if (_eurUsdCache.rate && Date.now() - _eurUsdCache.fetchedAt < CACHE_TTL_MS) {
    return _eurUsdCache.rate;
  }
  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR');
    const j = await r.json();
    if (j.rates && j.rates.EUR) {
      _eurUsdCache = { rate: j.rates.EUR, fetchedAt: Date.now() };
      return j.rates.EUR;
    }
  } catch (e) { console.warn('[spot] Frankfurter failed:', e); }
  return 0.92; // fallback statique raisonnable
}

export async function getSpotPriceEUR(ticker) {
  const usd = await getSpotPrice(ticker);
  if (!usd) return null;
  const eurRate = await getEurUsdRate();
  return { ...usd, priceEUR: usd.priceUSD * eurRate, eurRate };
}

export function listCommodities() {
  return Object.entries(COMMODITY_TICKERS).map(([id, def]) => ({ id, ...def }));
}
