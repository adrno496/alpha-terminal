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
