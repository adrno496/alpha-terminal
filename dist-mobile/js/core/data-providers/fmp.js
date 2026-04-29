// Financial Modeling Prep — bilans, ratios, statements 10-K structurés
// Free tier : 250 req/jour. CORS-enabled.
// Doc : https://site.financialmodelingprep.com/developer/docs
import { getDataKey } from '../data-keys.js';

const BASE = 'https://financialmodelingprep.com/api/v3';

async function call(path, params = {}) {
  const key = getDataKey('fmp');
  if (!key) throw new Error('FMP key not configured');
  const url = BASE + path + '?' + new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP ${res.status}`);
  return res.json();
}

export async function fmpQuote(ticker) {
  const d = await call(`/quote/${ticker}`);
  if (!Array.isArray(d) || !d[0]) return null;
  const q = d[0];
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    change: q.change,
    change_pct: q.changesPercentage,
    volume: q.volume,
    avg_volume: q.avgVolume,
    market_cap: q.marketCap,
    pe: q.pe,
    eps: q.eps,
    high_52w: q.yearHigh,
    low_52w: q.yearLow,
    open: q.open,
    previous_close: q.previousClose
  };
}

export async function fmpProfile(ticker) {
  const d = await call(`/profile/${ticker}`);
  if (!Array.isArray(d) || !d[0]) return null;
  const p = d[0];
  return {
    symbol: p.symbol,
    name: p.companyName,
    description: (p.description || '').slice(0, 400),
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    ipo_date: p.ipoDate,
    employees: p.fullTimeEmployees,
    website: p.website,
    market_cap: p.mktCap,
    beta: p.beta,
    range_52w: p.range
  };
}

// Latest annual income statement (P&L)
export async function fmpIncomeStatement(ticker, limit = 1) {
  const d = await call(`/income-statement/${ticker}`, { limit });
  if (!Array.isArray(d) || !d[0]) return null;
  return d.map(s => ({
    date: s.date,
    revenue: s.revenue,
    gross_profit: s.grossProfit,
    operating_income: s.operatingIncome,
    net_income: s.netIncome,
    eps: s.eps,
    gross_margin: s.grossProfitRatio,
    operating_margin: s.operatingIncomeRatio,
    net_margin: s.netIncomeRatio,
    rd_expense: s.researchAndDevelopmentExpenses,
    sga_expense: s.sellingGeneralAndAdministrativeExpenses
  }));
}

// Stock screener — vrai screener FMP avec filtres
// https://site.financialmodelingprep.com/developer/docs#stock-screener
export async function fmpScreener(filters = {}) {
  // Filters supportés : marketCapMoreThan, marketCapLowerThan, betaMoreThan, betaLowerThan,
  // dividendMoreThan, dividendLowerThan, volumeMoreThan, volumeLowerThan,
  // sector, industry, country, exchange, isEtf, isActivelyTrading, limit
  const params = { limit: 50 };
  for (const [k, v] of Object.entries(filters)) {
    if (v !== '' && v != null) params[k] = v;
  }
  const d = await call('/stock-screener', params);
  if (!Array.isArray(d)) return [];
  return d.map(s => ({
    symbol: s.symbol,
    name: s.companyName,
    market_cap: s.marketCap,
    sector: s.sector,
    industry: s.industry,
    country: s.country,
    exchange: s.exchangeShortName,
    beta: s.beta,
    price: s.price,
    volume: s.volume,
    last_dividend: s.lastAnnualDividend,
    is_etf: s.isEtf,
    is_actively_trading: s.isActivelyTrading
  }));
}

// Key ratios TTM
export async function fmpRatios(ticker) {
  const d = await call(`/ratios-ttm/${ticker}`);
  if (!Array.isArray(d) || !d[0]) return null;
  const r = d[0];
  return {
    pe: r.peRatioTTM,
    pb: r.priceToBookRatioTTM,
    ps: r.priceToSalesRatioTTM,
    ev_ebitda: r.enterpriseValueOverEBITDATTM,
    ev_sales: r.enterpriseValueOverSalesTTM,
    pfcf: r.priceCashFlowRatioTTM,
    div_yield: r.dividendYielTTM,
    debt_equity: r.debtEquityRatioTTM,
    current_ratio: r.currentRatioTTM,
    roe: r.returnOnEquityTTM,
    roa: r.returnOnAssetsTTM,
    roic: r.returnOnCapitalEmployedTTM,
    gross_margin: r.grossProfitMarginTTM,
    operating_margin: r.operatingProfitMarginTTM,
    net_margin: r.netProfitMarginTTM,
    fcf_yield: r.freeCashFlowYieldTTM
  };
}
