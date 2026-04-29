// Twelve Data — quotes, time series, forex, ETF
// Free tier : 800 req/jour, 8 req/min. CORS-enabled.
// Doc : https://twelvedata.com/docs
import { getDataKey } from '../data-keys.js';

const BASE = 'https://api.twelvedata.com';

async function call(path, params = {}) {
  const key = getDataKey('twelvedata');
  if (!key) throw new Error('Twelve Data key not configured');
  const url = BASE + path + '?' + new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TwelveData ${res.status}`);
  const data = await res.json();
  if (data.code === 400 || data.status === 'error') throw new Error('TD: ' + (data.message || 'error'));
  return data;
}

export async function tdQuote(symbol) {
  const d = await call('/quote', { symbol });
  if (!d.symbol) return null;
  return {
    symbol: d.symbol,
    name: d.name,
    exchange: d.exchange,
    currency: d.currency,
    price: parseFloat(d.close),
    change: parseFloat(d.change),
    change_pct: parseFloat(d.percent_change),
    volume: parseInt(d.volume, 10),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    open: parseFloat(d.open),
    previous_close: parseFloat(d.previous_close),
    week_52_high: parseFloat(d.fifty_two_week?.high),
    week_52_low: parseFloat(d.fifty_two_week?.low)
  };
}

// Forex pair (EUR/USD etc)
export async function tdForex(pair) {
  const d = await call('/quote', { symbol: pair });
  if (!d.symbol) return null;
  return {
    pair: d.symbol,
    rate: parseFloat(d.close),
    change: parseFloat(d.change),
    change_pct: parseFloat(d.percent_change)
  };
}
