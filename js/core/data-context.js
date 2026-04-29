// Orchestrator data-context : récupère les données les plus pertinentes selon le contexte
// du module et construit un bloc à injecter dans le user message LLM.
// Économise les web_search ($) en utilisant les APIs structurées que l'user a configurées.

import { fmpQuote, fmpProfile, fmpRatios, fmpIncomeStatement } from './data-providers/fmp.js';
import { avQuote, avOverview } from './data-providers/alphavantage.js';
import { tdQuote } from './data-providers/twelvedata.js';
import { fredMacroSnapshot } from './data-providers/fred.js';
import { fetchCoinData } from './coingecko.js';
import { polygonPrevClose, polygonTickerDetails, polygonNews } from './data-providers/polygon.js';
import { finnhubQuote, finnhubProfile, finnhubNews, finnhubEarnings } from './data-providers/finnhub.js';
import { tiingoIex, tiingoMeta, tiingoNews, tiingoCryptoQuote } from './data-providers/tiingo.js';
import { etherscanBalance, etherscanGas } from './data-providers/etherscan.js';
import { llamaProtocol, llamaTopProtocols, llamaTopYields } from './data-providers/defillama.js';
import { edgarRecentFilings, edgarCompanyFacts } from './data-providers/edgar.js';
import { fxLatest } from './data-providers/frankfurter.js';
import { getDataKey } from './data-keys.js';

const cache = new Map();
function memo(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.v;
  const v = fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return 'n/a';
  if (Math.abs(n) >= 1e12) return (n/1e12).toFixed(2) + 'T';
  if (Math.abs(n) >= 1e9)  return (n/1e9).toFixed(2)  + 'B';
  if (Math.abs(n) >= 1e6)  return (n/1e6).toFixed(2)  + 'M';
  if (Math.abs(n) >= 1e3)  return (n/1e3).toFixed(2)  + 'K';
  if (Math.abs(n) < 0.01)  return n.toFixed(4);
  return n.toFixed(2);
}
function fmtPct(n) { if (n == null || isNaN(n)) return 'n/a'; return (n * 100).toFixed(2) + '%'; }

// Helpers — try multiple providers in order, return first success
async function tryFirst(...fns) {
  for (const fn of fns) {
    try { const r = await fn(); if (r) return r; } catch (e) {}
  }
  return null;
}

// --- Stock context (avec fallback chain : FMP → Polygon → AV → Finnhub → Twelve Data → Tiingo) ---
async function stockContext(ticker) {
  const tk = ticker.trim().toUpperCase();
  return memo('stock:' + tk, async () => {
    const out = { ticker: tk, _sources: [] };

    // QUOTE — chain de fallback
    if (!out.quote && getDataKey('fmp'))          { try { out.quote = await fmpQuote(tk);          if (out.quote) out._sources.push('FMP'); } catch {} }
    if (!out.quote && getDataKey('polygon'))      { try { out.quote = await polygonPrevClose(tk); if (out.quote) out._sources.push('Polygon'); } catch {} }
    if (!out.quote && getDataKey('finnhub'))      { try { out.quote = await finnhubQuote(tk);      if (out.quote) out._sources.push('Finnhub'); } catch {} }
    if (!out.quote && getDataKey('alphavantage')) { try { out.quote = await avQuote(tk);           if (out.quote) out._sources.push('AlphaVantage'); } catch {} }
    if (!out.quote && getDataKey('twelvedata'))   { try { out.quote = await tdQuote(tk);           if (out.quote) out._sources.push('TwelveData'); } catch {} }
    if (!out.quote && getDataKey('tiingo'))       { try { out.quote = await tiingoIex(tk);         if (out.quote) out._sources.push('Tiingo'); } catch {} }

    // PROFILE
    if (!out.profile && getDataKey('fmp'))     { try { out.profile = await fmpProfile(tk); } catch {} }
    if (!out.profile && getDataKey('polygon')) { try { out.profile = await polygonTickerDetails(tk); } catch {} }
    if (!out.profile && getDataKey('finnhub')) { try { out.profile = await finnhubProfile(tk); } catch {} }
    if (!out.profile && getDataKey('alphavantage')) { try { out.profile = await avOverview(tk); } catch {} }
    if (!out.profile && getDataKey('tiingo'))  { try { out.profile = await tiingoMeta(tk); } catch {} }

    // RATIOS (FMP only, le plus complet)
    if (getDataKey('fmp')) { try { out.ratios = await fmpRatios(tk); } catch {} }

    // LATEST INCOME STATEMENT (FMP)
    if (getDataKey('fmp')) {
      try {
        const inc = await fmpIncomeStatement(tk, 1);
        if (inc?.[0]) out.last_income = inc[0];
      } catch {}
    }

    // NEWS récents (Finnhub > Polygon > Tiingo)
    if (!out.news && getDataKey('finnhub')) { try { const n = await finnhubNews(tk, 7); if (n?.length) { out.news = n; out._sources.push('Finnhub news'); } } catch {} }
    if (!out.news && getDataKey('polygon')) { try { const n = await polygonNews(tk, 5); if (n?.length) { out.news = n; out._sources.push('Polygon news'); } } catch {} }
    if (!out.news && getDataKey('tiingo'))  { try { const n = await tiingoNews(tk, 5);  if (n?.length) { out.news = n; out._sources.push('Tiingo news'); } } catch {} }

    // EARNINGS récents (Finnhub)
    if (getDataKey('finnhub')) { try { out.earnings = await finnhubEarnings(tk); } catch {} }

    // SEC FILINGS (EDGAR — keyless)
    try {
      const filings = await edgarRecentFilings(tk, ['10-K', '10-Q', '8-K']);
      if (filings) { out.sec_filings = filings; out._sources.push('SEC EDGAR'); }
    } catch {}

    return out;
  });
}

// --- Crypto context (CoinGecko + DefiLlama protocole + on-chain Etherscan) ---
async function cryptoContext(symbol) {
  return memo('crypto:' + symbol, async () => {
    const out = { symbol, _sources: [] };
    try {
      const cg = await fetchCoinData(symbol);
      if (cg) { out.coingecko = cg; out._sources.push('CoinGecko'); }
    } catch {}
    // DefiLlama : tente de matcher le slug protocole (BTC/ETH ne matchent pas, mais AAVE/UNI/LDO/CRV oui)
    try {
      const proto = await llamaProtocol(symbol.toLowerCase());
      if (proto) { out.defillama = proto; out._sources.push('DefiLlama'); }
    } catch {}
    return out;
  });
}

// --- Macro context (FRED + Frankfurter forex + DefiLlama TVL global) ---
async function macroContext() {
  return memo('macro:snapshot', async () => {
    const out = { _sources: [] };
    if (getDataKey('fred')) {
      try { out.fred = await fredMacroSnapshot(); out._sources.push('FRED'); } catch {}
    }
    try { out.fx = await fxLatest('EUR', ['USD','GBP','CHF','JPY','CNY']); out._sources.push('Frankfurter'); } catch {}
    try {
      const top = await llamaTopProtocols(5);
      const yields = await llamaTopYields(5);
      out.defi = { top_protocols: top, top_yields: yields };
      out._sources.push('DefiLlama');
    } catch {}
    return out;
  });
}

// --- Détection automatique du type d'input ---
function detectAssetType(input) {
  const s = input.trim().toUpperCase();
  const CRYPTO = /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|DOT|AVAX|LINK|MATIC|UNI|ATOM|NEAR|SUI|APT|TON|TRX|SHIB|PEPE|TIA|SEI|INJ|AAVE|LDO|EIGEN|ENA|ONDO|RNDR|FET|TAO|CRV|MKR|COMP|SNX|SUSHI|YFI|BAL|GMX|DYDX|JUP|RAY|JTO|WBTC|STETH|RETH|FRAX|DAI|USDC|USDT|TUSD)$/i;
  if (CRYPTO.test(s)) return 'crypto';
  if (/^[A-Z]{1,5}(\.[A-Z]{1,3})?$/.test(s)) return 'stock';
  if (input.includes('%') || input.includes(',')) return 'portfolio';
  // Eth address
  if (/^0x[a-fA-F0-9]{40}$/.test(input.trim())) return 'eth_address';
  return 'unknown';
}

// --- Eth address context (Etherscan) ---
async function ethAddressContext(address) {
  if (!getDataKey('etherscan')) return null;
  return memo('eth:' + address, async () => {
    const out = { address, _sources: ['Etherscan'] };
    try { out.balance = await etherscanBalance(address); } catch {}
    try { out.gas = await etherscanGas(); } catch {}
    return out;
  });
}

// --- API publique : fetch the right context based on module + input ---
export async function fetchDataContext({ moduleId, input, type = 'auto' }) {
  if (!input) return null;
  const detected = type === 'auto' ? detectAssetType(input) : type;

  if (moduleId === 'macro-dashboard' || moduleId === 'stress-test') return macroContext();

  if (moduleId === 'crypto-fundamental' || detected === 'crypto') {
    return cryptoContext(input);
  }

  if (detected === 'eth_address') return ethAddressContext(input);

  // Stock-related modules
  const STOCK_MODULES = new Set([
    'quick-analysis', 'research-agent', 'decoder-10k', 'dcf', 'earnings-call',
    'investment-memo', 'pre-mortem', 'sentiment-tracker', 'battle-mode', 'watchlist',
    'stock-screener', 'trade-journal', 'portfolio-rebalancer'
  ]);

  if (STOCK_MODULES.has(moduleId)) {
    if (detected === 'stock') return stockContext(input);
    if (detected === 'portfolio') {
      const tickers = input.split(/[,\s]+/).map(t => t.replace(/[^A-Z0-9.]/gi, '')).filter(Boolean).slice(0, 6);
      const out = { portfolio: [], _sources: [] };
      for (const tk of tickers) {
        const t = detectAssetType(tk);
        try {
          if (t === 'crypto') out.portfolio.push(await cryptoContext(tk));
          else if (t === 'stock') out.portfolio.push(await stockContext(tk));
        } catch {}
      }
      return out;
    }
  }

  return null;
}

// --- Format context as text block to inject into user prompt ---
export function formatContextAsText(ctx) {
  if (!ctx) return '';
  const lines = ['', '[STRUCTURED DATA — fetched from APIs, use this instead of web search where possible]', ''];

  if (ctx.quote) {
    const q = ctx.quote;
    lines.push(`📊 ${q.symbol || ctx.ticker}: $${fmtNum(q.price || q.close)} (${q.change_pct?.toFixed(2)}% change). Volume ${fmtNum(q.volume)}. 52w range: $${fmtNum(q.low_52w || q.week_52_low)}–$${fmtNum(q.high_52w || q.week_52_high)}`);
  }
  if (ctx.profile) {
    const p = ctx.profile;
    lines.push(`🏢 ${p.name} · ${p.sector || p.industry || '?'} · MCap $${fmtNum(p.market_cap)}${p.country ? ' · ' + p.country : ''}${p.employees ? ' · ' + fmtNum(p.employees) + ' empl' : ''}`);
    if (p.description) lines.push(`   ${p.description}`);
  }
  if (ctx.ratios) {
    const r = ctx.ratios;
    lines.push(`📈 Ratios TTM: P/E ${fmtNum(r.pe)} · P/B ${fmtNum(r.pb)} · P/S ${fmtNum(r.ps)} · EV/EBITDA ${fmtNum(r.ev_ebitda)} · ROE ${fmtPct(r.roe)} · ROIC ${fmtPct(r.roic)} · Net margin ${fmtPct(r.net_margin)} · FCF yield ${fmtPct(r.fcf_yield)} · Debt/Eq ${fmtNum(r.debt_equity)}`);
  }
  if (ctx.last_income) {
    const i = ctx.last_income;
    lines.push(`💰 FY ${i.date}: Revenue $${fmtNum(i.revenue)} · Op Income $${fmtNum(i.operating_income)} · Net $${fmtNum(i.net_income)} · EPS ${fmtNum(i.eps)} · Margins gross ${fmtPct(i.gross_margin)}/op ${fmtPct(i.operating_margin)}/net ${fmtPct(i.net_margin)}`);
  }
  if (ctx.earnings && ctx.earnings.length) {
    lines.push(`📅 Recent earnings: ${ctx.earnings.slice(0, 4).map(e => `${e.period} act ${fmtNum(e.actual)} vs est ${fmtNum(e.estimate)} (${e.surprise_pct >= 0 ? '+' : ''}${e.surprise_pct?.toFixed(1)}%)`).join(' · ')}`);
  }
  if (ctx.news && ctx.news.length) {
    lines.push(`📰 Recent news (${ctx.news.length}):`);
    ctx.news.slice(0, 5).forEach(n => lines.push(`   - "${n.title}" (${n.source || n.publisher || 'src'}, ${(n.published_at || n.datetime || n.published_utc || '').slice(0, 10)})`));
  }
  if (ctx.sec_filings) {
    const f = ctx.sec_filings.filings || [];
    if (f.length) {
      lines.push(`📂 SEC EDGAR filings (${ctx.sec_filings.company_name}): ${f.slice(0, 5).map(x => `${x.form} ${x.report_date}`).join(' · ')}`);
    }
  }
  if (ctx.coingecko) {
    const c = ctx.coingecko;
    lines.push(`🪙 ${c.name} (${c.symbol}): $${fmtNum(c.price_usd)} · MCap $${fmtNum(c.market_cap_usd)} · FDV $${fmtNum(c.fdv_usd)} · 24h ${c.price_change_24h_pct?.toFixed(2)}% · 7d ${c.price_change_7d_pct?.toFixed(2)}% · ATH $${fmtNum(c.ath_usd)} (${c.ath_change_pct?.toFixed(1)}% vs ATH)`);
  }
  if (ctx.defillama) {
    const d = ctx.defillama;
    lines.push(`🌊 DefiLlama (${d.name}): TVL $${fmtNum(d.total_tvl)} · Category ${d.category} · Chains ${d.chains?.slice(0, 4).join(', ')}`);
  }
  if (ctx.fred) {
    const f = ctx.fred;
    const parts = [];
    if (f.fed_funds) parts.push(`Fed Funds ${f.fed_funds.value}%`);
    if (f.cpi_yoy) parts.push(`CPI ${f.cpi_yoy.value}`);
    if (f.unemployment) parts.push(`Unemp ${f.unemployment.value}%`);
    if (f.us10y) parts.push(`10y ${f.us10y.value}%`);
    if (f.us2y) parts.push(`2y ${f.us2y.value}%`);
    if (f.yield_curve_spread) parts.push(`10y-2y ${f.yield_curve_spread.value.toFixed(2)}%`);
    if (f.usd_index) parts.push(`DXY ${f.usd_index.value}`);
    if (f.vix) parts.push(`VIX ${f.vix.value}`);
    if (f.high_yield_spread) parts.push(`HY OAS ${f.high_yield_spread.value}bps`);
    if (f.wti_oil) parts.push(`WTI $${f.wti_oil.value}`);
    lines.push(`🌍 Macro US (FRED): ${parts.join(' · ')}`);
  }
  if (ctx.fx) {
    const r = ctx.fx.rates;
    lines.push(`💱 FX (${ctx.fx.base} → ${Object.keys(r).join(', ')}, ${ctx.fx.date}): ${Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(' · ')}`);
  }
  if (ctx.defi) {
    if (ctx.defi.top_protocols?.length) {
      lines.push(`🏦 Top DeFi protocols: ${ctx.defi.top_protocols.slice(0, 5).map(p => `${p.name} ($${fmtNum(p.tvl)} ${p.change_7d ? p.change_7d.toFixed(1) + '%/7d' : ''})`).join(' · ')}`);
    }
    if (ctx.defi.top_yields?.length) {
      lines.push(`💹 Top yields: ${ctx.defi.top_yields.slice(0, 5).map(y => `${y.symbol} ${y.apy?.toFixed(1)}% (${y.project})`).join(' · ')}`);
    }
  }
  if (ctx.balance) {
    lines.push(`⛓ Address ${ctx.address}: ${ctx.balance.balance_eth?.toFixed(4)} ETH`);
  }
  if (ctx.gas) {
    lines.push(`⛽ Gas: safe ${ctx.gas.safe_low} · standard ${ctx.gas.standard} · fast ${ctx.gas.fast} gwei (base ${ctx.gas.base_fee?.toFixed(2)})`);
  }
  if (ctx.portfolio) {
    lines.push(`💼 Portfolio breakdown:`);
    for (const p of ctx.portfolio) {
      if (p.quote) lines.push(`  - ${p.ticker}: $${fmtNum(p.quote.price || p.quote.close)} (${p.quote.change_pct?.toFixed(2)}%)`);
      else if (p.coingecko) lines.push(`  - ${p.symbol}: $${fmtNum(p.coingecko.price_usd)} (24h ${p.coingecko.price_change_24h_pct?.toFixed(2)}%)`);
    }
  }

  if (ctx._sources?.length) lines.push(`\n_Sources: ${ctx._sources.join(', ')} (cached 5min)_`);
  lines.push('');
  return lines.join('\n');
}

// Helper : check if user has at least one data key OR keyless source available
export function hasAnyDataKey() {
  // Toujours true car on a maintenant des sources keyless (CoinGecko, DefiLlama, EDGAR, Frankfurter)
  return true;
}

export function hasAnyKeyedDataProvider() {
  return ['fmp', 'alphavantage', 'twelvedata', 'fred', 'finnhub', 'polygon', 'tiingo', 'etherscan', 'newsapi'].some(k => !!getDataKey(k));
}
