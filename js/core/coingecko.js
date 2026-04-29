// Wrapper CoinGecko (API publique gratuite, no key)
// Endpoint : https://api.coingecko.com/api/v3
// Note : peut être rate-limited (~10-30 req/min). Aucune clé requise.

const BASE = 'https://api.coingecko.com/api/v3';

// Cache simple en mémoire (60s)
const cache = new Map();
function memo(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

// Recherche un token par symbole ou nom
export async function searchToken(query) {
  return memo(`search:${query}`, 60000, () => get('/search', { query }));
}

// Récupère l'ID CoinGecko depuis un symbole
export async function resolveCoinId(symbol) {
  if (!symbol) return null;
  const sLow = symbol.toLowerCase().trim();
  // Mapping rapide pour les principaux
  const QUICK = {
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin',
    xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', dot: 'polkadot',
    avax: 'avalanche-2', link: 'chainlink', matic: 'matic-network',
    ltc: 'litecoin', uni: 'uniswap', atom: 'cosmos', near: 'near',
    apt: 'aptos', arb: 'arbitrum', op: 'optimism', sui: 'sui',
    ton: 'the-open-network', trx: 'tron', shib: 'shiba-inu', pepe: 'pepe',
    inj: 'injective-protocol', tia: 'celestia', sei: 'sei-network',
    aave: 'aave', mkr: 'maker', crv: 'curve-dao-token', ldo: 'lido-dao',
    eigen: 'eigenlayer', ena: 'ethena', ondo: 'ondo-finance', rndr: 'render-token',
    fet: 'fetch-ai', tao: 'bittensor', vet: 'vechain', algo: 'algorand'
  };
  if (QUICK[sLow]) return QUICK[sLow];
  // Sinon cherche
  const r = await searchToken(symbol);
  const coin = r.coins?.find(c => c.symbol?.toLowerCase() === sLow) || r.coins?.[0];
  return coin?.id || null;
}

// Données complètes d'un token
export async function fetchCoinData(symbol) {
  const id = await resolveCoinId(symbol);
  if (!id) throw new Error(`Token "${symbol}" introuvable sur CoinGecko`);
  const data = await get(`/coins/${id}`, {
    localization: false,
    tickers: false,
    market_data: true,
    community_data: false,
    developer_data: false,
    sparkline: false
  });

  const md = data.market_data || {};
  return {
    id,
    symbol: data.symbol?.toUpperCase(),
    name: data.name,
    categories: data.categories || [],
    description: (data.description?.en || '').slice(0, 600),
    homepage: data.links?.homepage?.[0] || '',
    whitepaper: data.links?.whitepaper || '',
    github: data.links?.repos_url?.github || [],
    price_usd: md.current_price?.usd,
    market_cap_usd: md.market_cap?.usd,
    fdv_usd: md.fully_diluted_valuation?.usd,
    total_volume_usd: md.total_volume?.usd,
    circulating_supply: md.circulating_supply,
    total_supply: md.total_supply,
    max_supply: md.max_supply,
    ath_usd: md.ath?.usd,
    ath_change_pct: md.ath_change_percentage?.usd,
    ath_date: md.ath_date?.usd,
    price_change_24h_pct: md.price_change_percentage_24h,
    price_change_7d_pct: md.price_change_percentage_7d,
    price_change_30d_pct: md.price_change_percentage_30d,
    price_change_1y_pct: md.price_change_percentage_1y,
    last_updated: md.last_updated
  };
}
