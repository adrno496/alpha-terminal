// DefiLlama — TVL, fees, revenues, yields des protocoles DeFi
// 100% gratuit, no key, CORS-enabled.
// Doc : https://defillama.com/docs/api

const BASE = 'https://api.llama.fi';
const STABLES_BASE = 'https://stablecoins.llama.fi';
const YIELDS_BASE = 'https://yields.llama.fi';

const cache = new Map();
function memo(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
  return res.json();
}

// TVL global tout DeFi
export async function llamaTotalTVL() {
  return memo('tvl-total', 5 * 60 * 1000, async () => {
    const d = await get(BASE + '/v2/historicalChainTvl');
    if (!Array.isArray(d) || !d.length) return null;
    const last = d[d.length - 1];
    return { date: last.date, tvl_usd: last.tvl };
  });
}

// Détails d'un protocole (Aave, Uniswap, Lido…)
export async function llamaProtocol(slug) {
  return memo('proto:' + slug, 5 * 60 * 1000, async () => {
    const d = await get(BASE + '/protocol/' + encodeURIComponent(slug.toLowerCase()));
    if (!d.name) return null;
    return {
      name: d.name,
      symbol: d.symbol,
      url: d.url,
      description: (d.description || '').slice(0, 400),
      chains: d.chains,
      category: d.category,
      tvl: d.currentChainTvls,
      total_tvl: d.tvl?.[d.tvl.length - 1]?.totalLiquidityUSD
    };
  });
}

// Top protocoles par TVL
export async function llamaTopProtocols(limit = 10) {
  return memo('top-protos:' + limit, 10 * 60 * 1000, async () => {
    const d = await get(BASE + '/protocols');
    if (!Array.isArray(d)) return [];
    return d.slice(0, limit).map(p => ({
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      tvl: p.tvl,
      change_1d: p.change_1d,
      change_7d: p.change_7d,
      chains: p.chains?.slice(0, 3)
    }));
  });
}

// TVL d'une chain (ethereum, solana, base…)
export async function llamaChainTvl(chain) {
  return memo('chain:' + chain, 5 * 60 * 1000, async () => {
    const d = await get(BASE + '/v2/historicalChainTvl/' + encodeURIComponent(chain));
    if (!Array.isArray(d) || !d.length) return null;
    const last = d[d.length - 1];
    return { chain, date: last.date, tvl_usd: last.tvl };
  });
}

// Yields actuels (top APY)
export async function llamaTopYields(limit = 10, minTvl = 1e7) {
  return memo('yields:' + limit, 10 * 60 * 1000, async () => {
    const d = await get(YIELDS_BASE + '/pools');
    if (!Array.isArray(d.data)) return [];
    return d.data
      .filter(p => p.tvlUsd >= minTvl && !p.outlier)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, limit)
      .map(p => ({
        project: p.project,
        symbol: p.symbol,
        chain: p.chain,
        tvl_usd: p.tvlUsd,
        apy: p.apy,
        apy_base: p.apyBase,
        apy_reward: p.apyReward,
        stablecoin: p.stablecoin
      }));
  });
}

// Stablecoins market cap
export async function llamaStablecoins() {
  return memo('stables', 30 * 60 * 1000, async () => {
    const d = await get(STABLES_BASE + '/stablecoins?includePrices=true');
    if (!Array.isArray(d.peggedAssets)) return [];
    return d.peggedAssets.slice(0, 10).map(s => ({
      symbol: s.symbol,
      name: s.name,
      circulating_usd: s.circulating?.peggedUSD,
      pegMechanism: s.pegMechanism,
      chains: s.chains?.slice(0, 3)
    }));
  });
}
