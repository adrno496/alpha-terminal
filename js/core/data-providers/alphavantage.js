// Alpha Vantage — quotes, overview, income statement
// Free tier : 25 req/day. CORS-enabled.
// Doc : https://www.alphavantage.co/documentation/
import { getDataKey } from '../data-keys.js';

const BASE = 'https://www.alphavantage.co/query';

async function call(params) {
  const key = getDataKey('alphavantage');
  if (!key) throw new Error('Alpha Vantage key not configured');
  const url = BASE + '?' + new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AV ${res.status}`);
  const data = await res.json();
  if (data['Error Message']) throw new Error('AV: ' + data['Error Message']);
  if (data['Note']) throw new Error('AV rate limit (25/day free tier)');
  return data;
}

export async function avQuote(ticker) {
  const d = await call({ function: 'GLOBAL_QUOTE', symbol: ticker });
  const q = d['Global Quote'] || {};
  if (!q['05. price']) return null;
  return {
    symbol: q['01. symbol'],
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    change_pct: parseFloat((q['10. change percent'] || '0').replace('%', '')),
    volume: parseInt(q['06. volume'], 10),
    prev_close: parseFloat(q['08. previous close']),
    high: parseFloat(q['03. high']),
    low: parseFloat(q['04. low']),
    open: parseFloat(q['02. open']),
    latest_day: q['07. latest trading day']
  };
}

export async function avOverview(ticker) {
  const d = await call({ function: 'OVERVIEW', symbol: ticker });
  if (!d.Symbol) return null;
  return {
    symbol: d.Symbol,
    name: d.Name,
    description: (d.Description || '').slice(0, 400),
    sector: d.Sector,
    industry: d.Industry,
    country: d.Country,
    market_cap: parseFloat(d.MarketCapitalization) || null,
    pe: parseFloat(d.PERatio) || null,
    peg: parseFloat(d.PEGRatio) || null,
    pb: parseFloat(d.PriceToBookRatio) || null,
    ev_ebitda: parseFloat(d.EVToEBITDA) || null,
    profit_margin: parseFloat(d.ProfitMargin) || null,
    operating_margin: parseFloat(d.OperatingMarginTTM) || null,
    roe: parseFloat(d.ReturnOnEquityTTM) || null,
    roa: parseFloat(d.ReturnOnAssetsTTM) || null,
    revenue_ttm: parseFloat(d.RevenueTTM) || null,
    eps: parseFloat(d.EPS) || null,
    beta: parseFloat(d.Beta) || null,
    div_yield: parseFloat(d.DividendYield) || null,
    payout_ratio: parseFloat(d.PayoutRatio) || null,
    target_price: parseFloat(d.AnalystTargetPrice) || null,
    week_52_high: parseFloat(d['52WeekHigh']) || null,
    week_52_low: parseFloat(d['52WeekLow']) || null
  };
}
