// Polygon.io — quotes + financials + news
// Free tier : 5 req/min, end-of-day data. CORS-enabled.
// Doc : https://polygon.io/docs
import { getDataKey } from '../data-keys.js';

const BASE = 'https://api.polygon.io';

async function call(path, params = {}) {
  const key = getDataKey('polygon');
  if (!key) throw new Error('Polygon key not configured');
  const url = BASE + path + '?' + new URLSearchParams({ ...params, apiKey: key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon ${res.status}`);
  return res.json();
}

export async function polygonPrevClose(ticker) {
  const d = await call(`/v2/aggs/ticker/${ticker.toUpperCase()}/prev`);
  if (!d.results?.[0]) return null;
  const r = d.results[0];
  return {
    symbol: ticker.toUpperCase(),
    close: r.c,
    open: r.o,
    high: r.h,
    low: r.l,
    volume: r.v,
    vwap: r.vw,
    change_pct: r.o ? ((r.c - r.o) / r.o) * 100 : null
  };
}

export async function polygonTickerDetails(ticker) {
  const d = await call(`/v3/reference/tickers/${ticker.toUpperCase()}`);
  if (!d.results) return null;
  const r = d.results;
  return {
    symbol: r.ticker,
    name: r.name,
    market: r.market,
    exchange: r.primary_exchange,
    type: r.type,
    description: (r.description || '').slice(0, 400),
    sector: r.sic_description,
    market_cap: r.market_cap,
    employees: r.total_employees,
    list_date: r.list_date,
    homepage: r.homepage_url
  };
}

export async function polygonNews(ticker, limit = 5) {
  const d = await call('/v2/reference/news', { ticker: ticker.toUpperCase(), limit });
  if (!Array.isArray(d.results)) return [];
  return d.results.map(n => ({
    title: n.title,
    description: (n.description || '').slice(0, 200),
    publisher: n.publisher?.name,
    published_utc: n.published_utc,
    url: n.article_url,
    tickers: n.tickers
  }));
}
