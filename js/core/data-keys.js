// Stockage des clés "données financières" (en clair pour l'instant — usage local seulement)
// Future : intégrer dans le vault chiffré comme les LLM keys

const KEY = 'alpha-terminal:data-keys';

// Providers de DONNÉES (key requise — intégration active dans data-context)
export const DATA_PROVIDERS = [
  { id: 'fmp',            label: 'Financial Modeling Prep',    desc: 'Statements, ratios, structured 10-K · ★ recommended',  link: 'https://site.financialmodelingprep.com/developer/docs' },
  { id: 'alphavantage',   label: 'Alpha Vantage',              desc: 'Stock prices, fundamentals · 25 req/day free',         link: 'https://www.alphavantage.co/support/#api-key' },
  { id: 'finnhub',        label: 'Finnhub',                    desc: 'Quote, news, earnings · 60 req/min free',              link: 'https://finnhub.io/register' },
  { id: 'polygon',        label: 'Polygon.io',                 desc: 'EOD quotes, news, ticker details · 5 req/min free',    link: 'https://polygon.io/dashboard/api-keys' },
  { id: 'tiingo',         label: 'Tiingo',                     desc: 'IEX quotes, news, crypto · 500 req/hour free',         link: 'https://api.tiingo.com/account/api/token' },
  { id: 'twelvedata',     label: 'Twelve Data',                desc: 'Real-time prices, forex, ETF (★ best for European ETF) · 800 req/day free', link: 'https://twelvedata.com/pricing' },
  { id: 'fred',           label: 'FRED API',                   desc: 'US macro indicators · unlimited free',                 link: 'https://fred.stlouisfed.org/docs/api/api_key.html' },
  { id: 'etherscan',      label: 'Etherscan',                  desc: 'On-chain ETH (balance, contracts) · 100k req/day',     link: 'https://etherscan.io/myapikey' },
  { id: 'metals_api',     label: 'Metals-API',                 desc: 'Spot Or/Argent/Platine/Palladium · 50 req/mois free',  link: 'https://metals-api.com/register' }
];

// Sources gratuites SANS clé requise (intégrées automatiquement dans data-context)
export const KEYLESS_DATA_SOURCES = [
  { id: 'coingecko_free', label: 'CoinGecko',  desc: 'Crypto prices/market data (free, no key)' },
  { id: 'defillama',      label: 'DefiLlama',  desc: 'DeFi TVL, fees, yields (free, no key)' },
  { id: 'edgar',          label: 'SEC EDGAR',  desc: '10-K/10-Q/8-K filings (free, no key)' },
  { id: 'frankfurter',    label: 'Frankfurter',desc: 'ECB FX rates (free, no key)' }
];

export function getDataKeys() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

export function setDataKey(id, value) {
  const keys = getDataKeys();
  if (value) keys[id] = value;
  else delete keys[id];
  localStorage.setItem(KEY, JSON.stringify(keys));
}

export function getDataKey(id) {
  return getDataKeys()[id] || null;
}

// Statut : 'set' / 'empty'. Validation réelle = future quand les intégrations seront actives.
export function getDataKeyStatus(id) {
  return getDataKey(id) ? 'set' : 'empty';
}

// === Validation réelle des clés data via appel minimal ===
// Chaque provider est testé via son endpoint le moins coûteux.
// Retour : { ok: bool, error?: string }
export async function validateDataKey(id, key) {
  if (!key || !String(key).trim()) return { ok: false, error: 'Clé vide' };
  const k = String(key).trim();
  try {
    let url, parser;
    switch (id) {
      case 'fmp':
        url = `https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide (401/403)' };
          const j = await r.json();
          if (j && j['Error Message']) return { ok: false, error: j['Error Message'] };
          if (Array.isArray(j) && j.length > 0) return { ok: true };
          return { ok: false, error: 'Réponse vide' };
        };
        break;
      case 'alphavantage':
        url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          const j = await r.json();
          if (j['Error Message']) return { ok: false, error: j['Error Message'] };
          if (j['Note'] && /invalid api key/i.test(j['Note'])) return { ok: false, error: 'Clé invalide' };
          if (j['Information'] && /api key/i.test(j['Information'])) return { ok: false, error: j['Information'].slice(0, 80) };
          if (j['Global Quote']) return { ok: true };
          return { ok: false, error: 'Format réponse inconnu' };
        };
        break;
      case 'finnhub':
        url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide' };
          const j = await r.json();
          if (j.error) return { ok: false, error: j.error };
          if (typeof j.c === 'number') return { ok: true };
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      case 'polygon':
        url = `https://api.polygon.io/v3/reference/tickers/AAPL?apiKey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide (401/403)' };
          const j = await r.json();
          if (j.status === 'ERROR' || j.error) return { ok: false, error: j.error || j.message || 'Erreur API' };
          if (j.results) return { ok: true };
          return { ok: false, error: 'Format inattendu' };
        };
        break;
      case 'tiingo':
        // Endpoint officiel de test : /api/test
        url = `https://api.tiingo.com/api/test?token=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401) return { ok: false, error: 'Token invalide' };
          if (r.ok) return { ok: true };
          return { ok: false, error: `HTTP ${r.status}` };
        };
        break;
      case 'twelvedata':
        url = `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          const j = await r.json();
          if (j.code === 401 || j.code === 400) return { ok: false, error: j.message || 'Clé invalide' };
          if (j.status === 'error') return { ok: false, error: j.message || 'Erreur API' };
          if (j.symbol) return { ok: true };
          return { ok: false, error: 'Format inattendu' };
        };
        break;
      case 'fred':
        url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&limit=1&api_key=${encodeURIComponent(k)}&file_type=json`;
        parser = async (r) => {
          if (r.status === 400) {
            const j = await r.json().catch(() => ({}));
            return { ok: false, error: j.error_message || 'Clé invalide (400)' };
          }
          if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
          const j = await r.json();
          if (j.observations && j.observations.length > 0) return { ok: true };
          return { ok: false, error: 'Pas d\'observations' };
        };
        break;
      case 'etherscan':
        url = `https://api.etherscan.io/api?module=stats&action=ethsupply&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          const j = await r.json();
          if (j.status === '1') return { ok: true };
          if (j.message) return { ok: false, error: j.message };
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      case 'metals_api':
        url = `https://metals-api.com/api/latest?access_key=${encodeURIComponent(k)}&base=USD&symbols=XAU`;
        parser = async (r) => {
          const j = await r.json();
          if (j.success === true) return { ok: true };
          if (j.error) return { ok: false, error: j.error.info || j.error.type || 'Erreur API' };
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      default:
        return { ok: false, error: 'Provider inconnu' };
    }
    const res = await fetch(url, { cache: 'no-store' });
    return await parser(res);
  } catch (e) {
    return { ok: false, error: e?.message || 'Erreur réseau' };
  }
}
