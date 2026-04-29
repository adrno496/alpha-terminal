// Tiingo — quotes, news, crypto, fondamentaux
// Free tier : 500 req/hour, 50 sym/req. CORS-enabled.
// Doc : https://www.tiingo.com/documentation
import { getDataKey } from '../data-keys.js';

const BASE = 'https://api.tiingo.com';

async function call(path, params = {}) {
  const key = getDataKey('tiingo');
  if (!key) throw new Error('Tiingo key not configured');
  const url = BASE + path + (path.includes('?') ? '&' : '?') + new URLSearchParams({ ...params, token: key });
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`Tiingo ${res.status}`);
  return res.json();
}

export async function tiingoIex(ticker) {
  const d = await call(`/iex/${ticker.toUpperCase()}`);
  if (!Array.isArray(d) || !d[0]) return null;
  const q = d[0];
  return {
    symbol: q.ticker,
    price: q.last,
    bid: q.bidPrice,
    ask: q.askPrice,
    high: q.high,
    low: q.low,
    open: q.open,
    previous_close: q.prevClose,
    volume: q.volume,
    timestamp: q.timestamp
  };
}

export async function tiingoMeta(ticker) {
  const d = await call(`/tiingo/daily/${ticker.toUpperCase()}`);
  if (!d.ticker) return null;
  return {
    symbol: d.ticker,
    name: d.name,
    description: (d.description || '').slice(0, 400),
    exchange: d.exchangeCode,
    start_date: d.startDate,
    end_date: d.endDate
  };
}

export async function tiingoNews(ticker, limit = 5) {
  const d = await call('/tiingo/news', { tickers: ticker.toLowerCase(), limit });
  if (!Array.isArray(d)) return [];
  return d.map(n => ({
    title: n.title,
    description: (n.description || '').slice(0, 200),
    source: n.source,
    published_at: n.publishedDate,
    url: n.url,
    tags: n.tags
  }));
}

export async function tiingoCryptoQuote(symbol) {
  const d = await call('/tiingo/crypto/top', { tickers: symbol.toLowerCase() + 'usd' });
  if (!Array.isArray(d) || !d[0] || !d[0].topOfBookData?.[0]) return null;
  const t = d[0].topOfBookData[0];
  return {
    symbol: symbol.toUpperCase(),
    price: t.lastPrice,
    bid: t.bidPrice,
    ask: t.askPrice,
    bid_size: t.bidSize,
    ask_size: t.askSize,
    timestamp: t.lastSaleTimestamp
  };
}
