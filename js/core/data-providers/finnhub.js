// Finnhub — quote, profile, news, earnings
// Free tier : 60 req/min, illimité quotes. CORS-enabled.
// Doc : https://finnhub.io/docs/api
import { getDataKey } from '../data-keys.js';

const BASE = 'https://finnhub.io/api/v1';

async function call(path, params = {}) {
  const key = getDataKey('finnhub');
  if (!key) throw new Error('Finnhub key not configured');
  const url = BASE + path + '?' + new URLSearchParams({ ...params, token: key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

export async function finnhubQuote(ticker) {
  const d = await call('/quote', { symbol: ticker.toUpperCase() });
  if (typeof d.c !== 'number' || d.c === 0) return null;
  return {
    symbol: ticker.toUpperCase(),
    price: d.c,
    change: d.d,
    change_pct: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    previous_close: d.pc,
    timestamp: d.t
  };
}

export async function finnhubProfile(ticker) {
  const d = await call('/stock/profile2', { symbol: ticker.toUpperCase() });
  if (!d.ticker) return null;
  return {
    symbol: d.ticker,
    name: d.name,
    country: d.country,
    currency: d.currency,
    exchange: d.exchange,
    industry: d.finnhubIndustry,
    market_cap: d.marketCapitalization,
    shares_outstanding: d.shareOutstanding,
    ipo_date: d.ipo,
    logo: d.logo,
    weburl: d.weburl
  };
}

export async function finnhubNews(ticker, days = 7) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const d = await call('/company-news', { symbol: ticker.toUpperCase(), from, to });
  if (!Array.isArray(d)) return [];
  return d.slice(0, 5).map(n => ({
    title: n.headline,
    description: (n.summary || '').slice(0, 200),
    source: n.source,
    datetime: new Date(n.datetime * 1000).toISOString(),
    url: n.url,
    image: n.image
  }));
}

export async function finnhubEarnings(ticker) {
  const d = await call('/stock/earnings', { symbol: ticker.toUpperCase() });
  if (!Array.isArray(d) || !d[0]) return null;
  return d.slice(0, 4).map(e => ({
    period: e.period,
    actual: e.actual,
    estimate: e.estimate,
    surprise: e.surprise,
    surprise_pct: e.surprisePercent
  }));
}

export async function finnhubGeneralNews(category = 'general') {
  const d = await call('/news', { category });
  if (!Array.isArray(d)) return [];
  return d.slice(0, 6).map(n => ({
    title: n.headline,
    description: (n.summary || '').slice(0, 160),
    source: n.source,
    datetime: new Date(n.datetime * 1000).toISOString(),
    url: n.url
  }));
}
