// Frankfurter — taux de change EUR/USD/GBP/etc. Données BCE.
// 100% gratuit, no key, illimité. CORS-enabled.
// Doc : https://www.frankfurter.app/docs/

const BASE = 'https://api.frankfurter.dev';

const cache = new Map();
function memo(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
  return res.json();
}

// Taux de change actuels par rapport à une base
export async function fxLatest(base = 'EUR', symbols = ['USD', 'GBP', 'CHF', 'JPY', 'CNY']) {
  return memo('fx:' + base + ':' + symbols.join(','), 30 * 60 * 1000, async () => {
    const path = '/latest?base=' + base + (symbols.length ? '&symbols=' + symbols.join(',') : '');
    const d = await get(path);
    return { base: d.base, date: d.date, rates: d.rates };
  });
}

// Conversion ponctuelle
export async function fxConvert(amount, from, to) {
  const data = await fxLatest(from, [to]);
  if (!data.rates?.[to]) return null;
  return { amount, from, to, rate: data.rates[to], converted: amount * data.rates[to], date: data.date };
}

// Historique simple (date YYYY-MM-DD)
export async function fxHistorical(date, base = 'EUR', symbols = ['USD']) {
  const path = '/' + date + '?base=' + base + '&symbols=' + symbols.join(',');
  return memo('fx-hist:' + date + ':' + base + ':' + symbols.join(','), 24 * 60 * 60 * 1000, async () => {
    const d = await get(path);
    return d;
  });
}
