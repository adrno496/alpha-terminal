// Cost tracker multi-provider (USD interne — affichage USD/EUR au choix)
// Stocke aussi les agrégats jour/mois pour le budget control.
const KEY = 'alpha-terminal:costs';
const BUDGET_KEY = 'alpha-terminal:budget-limits';
const listeners = new Set();
let session = { total: 0, byProvider: {} };

function todayKey() { return new Date().toISOString().slice(0, 10); }            // YYYY-MM-DD
function monthKey() { return new Date().toISOString().slice(0, 7); }             // YYYY-MM

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      total: s.total || 0,
      calls: s.calls || 0,
      byProvider: s.byProvider || {},
      daily: s.daily || {},   // { 'YYYY-MM-DD': { total, calls } }
      monthly: s.monthly || {} // { 'YYYY-MM': { total, calls } }
    };
  } catch { return { total: 0, calls: 0, byProvider: {}, daily: {}, monthly: {} }; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

// === BUDGET LIMITS ===
const DEFAULT_LIMITS = {
  enabled: false,
  dailyCapUSD: 0,    // 0 = illimité
  monthlyCapUSD: 0,  // 0 = illimité
  perCallCapUSD: 0,  // 0 = illimité
  action: 'warn'     // 'warn' (popup mais lance) | 'block' (refuse)
};

export function getBudgetLimits() {
  try { return { ...DEFAULT_LIMITS, ...JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}') }; }
  catch { return { ...DEFAULT_LIMITS }; }
}

export function setBudgetLimits(patch) {
  const next = { ...getBudgetLimits(), ...patch };
  localStorage.setItem(BUDGET_KEY, JSON.stringify(next));
  listeners.forEach(fn => fn(getCost()));
  return next;
}

export function getDailyTotalUSD(date = todayKey()) {
  return (load().daily?.[date]?.total) || 0;
}
export function getMonthlyTotalUSD(month = monthKey()) {
  return (load().monthly?.[month]?.total) || 0;
}

// Vérifie si une analyse estimée à `estimatedUSD` peut passer.
// Retourne { ok: boolean, reason?: string, action: 'warn'|'block', limit?: number, current?: number }
export function checkBudgetCap(estimatedUSD = 0) {
  const lim = getBudgetLimits();
  if (!lim.enabled) return { ok: true, action: 'warn' };
  const today = getDailyTotalUSD();
  const month = getMonthlyTotalUSD();
  // 1) Per-call cap
  if (lim.perCallCapUSD > 0 && estimatedUSD > lim.perCallCapUSD) {
    return { ok: false, action: lim.action, reason: 'per-call', limit: lim.perCallCapUSD, current: estimatedUSD };
  }
  // 2) Daily cap
  if (lim.dailyCapUSD > 0 && (today + estimatedUSD) > lim.dailyCapUSD) {
    return { ok: false, action: lim.action, reason: 'daily', limit: lim.dailyCapUSD, current: today + estimatedUSD };
  }
  // 3) Monthly cap
  if (lim.monthlyCapUSD > 0 && (month + estimatedUSD) > lim.monthlyCapUSD) {
    return { ok: false, action: lim.action, reason: 'monthly', limit: lim.monthlyCapUSD, current: month + estimatedUSD };
  }
  return { ok: true, action: lim.action };
}

export function getCost() {
  const s = load();
  return {
    ...s,
    session: { ...session },
    todayUSD: getDailyTotalUSD(),
    monthUSD: getMonthlyTotalUSD(),
    limits: getBudgetLimits()
  };
}

export function addCost(usd, providerName = 'unknown') {
  if (!usd || isNaN(usd)) return;
  const s = load();
  const day = todayKey(), mon = monthKey();
  s.total = (s.total || 0) + usd;
  s.calls = (s.calls || 0) + 1;
  s.byProvider = s.byProvider || {};
  if (!s.byProvider[providerName]) s.byProvider[providerName] = { total: 0, calls: 0 };
  s.byProvider[providerName].total += usd;
  s.byProvider[providerName].calls += 1;

  s.daily = s.daily || {};
  if (!s.daily[day]) s.daily[day] = { total: 0, calls: 0 };
  s.daily[day].total += usd;
  s.daily[day].calls += 1;

  s.monthly = s.monthly || {};
  if (!s.monthly[mon]) s.monthly[mon] = { total: 0, calls: 0 };
  s.monthly[mon].total += usd;
  s.monthly[mon].calls += 1;

  // Garbage collect : ne garde que les 90 derniers jours / 24 derniers mois
  const cutoffDay = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(s.daily)) if (k < cutoffDay) delete s.daily[k];
  const cutoffMon = new Date(Date.now() - 24 * 30 * 86400000).toISOString().slice(0, 7);
  for (const k of Object.keys(s.monthly)) if (k < cutoffMon) delete s.monthly[k];

  session.total += usd;
  session.byProvider[providerName] = (session.byProvider[providerName] || 0) + usd;

  save(s);
  listeners.forEach(fn => fn(getCost()));
}

export function resetTotalCost() {
  save({ total: 0, calls: 0, byProvider: {}, daily: {}, monthly: {} });
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
