// Cost tracker multi-provider (USD interne — affichage USD/EUR au choix)
const KEY = 'alpha-terminal:costs';
const listeners = new Set();
let session = { total: 0, byProvider: {} };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"total":0,"calls":0,"byProvider":{}}'); }
  catch { return { total: 0, calls: 0, byProvider: {} }; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function getCost() {
  const s = load();
  return { ...s, session: { ...session } };
}

export function addCost(usd, providerName = 'unknown') {
  if (!usd || isNaN(usd)) return;
  const s = load();
  s.total = (s.total || 0) + usd;
  s.calls = (s.calls || 0) + 1;
  s.byProvider = s.byProvider || {};
  if (!s.byProvider[providerName]) s.byProvider[providerName] = { total: 0, calls: 0 };
  s.byProvider[providerName].total += usd;
  s.byProvider[providerName].calls += 1;

  session.total += usd;
  session.byProvider[providerName] = (session.byProvider[providerName] || 0) + usd;

  save(s);
  listeners.forEach(fn => fn(getCost()));
}

export function resetTotalCost() {
  save({ total: 0, calls: 0, byProvider: {} });
  session = { total: 0, byProvider: {} };
  listeners.forEach(fn => fn(getCost()));
}

export function onCostChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// DEBUG : expose en console pour vérifier le tracking
if (typeof window !== 'undefined') {
  window.__costDebug = () => {
    const c = load();
    console.table({
      'Total ($)': c.total?.toFixed(6),
      'Calls': c.calls,
      'Session ($)': session.total?.toFixed(6)
    });
    console.log('By provider:', c.byProvider);
    return c;
  };
}
