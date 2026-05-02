// Quota tracker pour data providers.
// Stocké en localStorage par provider et par jour (UTC). Reset auto à minuit UTC.
// Les providers appellent bumpQuota() à chaque requête réussie. UI lit getQuotaToday().

const KEY = 'alpha-terminal:data-quota';

// Limites connues par provider (free tier). Source : doc officielle.
// `null` = pas de limite stricte ou non documentée.
export const QUOTA_LIMITS = {
  newsapi: { daily: 100, label: 'NewsAPI', resetUTC: true },
  acled:   { daily: null, label: 'ACLED', resetUTC: true }, // pas de limite stricte
  fred:    { daily: null, label: 'FRED', resetUTC: true },  // ~120 req/min, no daily cap documented
  alphavantage: { daily: 25, label: 'Alpha Vantage', resetUTC: true },
  finnhub: { perMinute: 60, label: 'Finnhub' },
  polygon: { perMinute: 5, label: 'Polygon' },
  tiingo:  { hourly: 500, label: 'Tiingo' },
  twelvedata: { daily: 800, label: 'Twelve Data', resetUTC: true },
  metals_api: { monthly: 50, label: 'Metals-API' },
  fmp:     { perMinute: 250, label: 'FMP' },
  etherscan: { daily: 100000, label: 'Etherscan', resetUTC: true }
};

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function write(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

// À appeler après chaque requête API réussie pour ce provider
export function bumpQuota(providerId) {
  if (!providerId) return;
  const data = read();
  const day = todayKey();
  if (!data[providerId]) data[providerId] = {};
  // Purge les anciennes entrées pour ne pas grossir indéfiniment
  for (const d of Object.keys(data[providerId])) {
    if (d < day && (todayKey() > d) && new Date(d) < new Date(Date.now() - 7 * 24 * 3600 * 1000)) {
      delete data[providerId][d];
    }
  }
  data[providerId][day] = (data[providerId][day] || 0) + 1;
  write(data);
}

// Retourne le compte du jour pour un provider
export function getQuotaToday(providerId) {
  const data = read();
  return data[providerId]?.[todayKey()] || 0;
}

// Retourne les comptes des N derniers jours
export function getQuotaHistory(providerId, days = 7) {
  const data = read();
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    out.push({ date: d, count: data[providerId]?.[d] || 0 });
  }
  return out;
}

// Helper pour la UI : retourne { used, limit, pct, color, label } pour affichage.
export function getQuotaStatus(providerId) {
  const limits = QUOTA_LIMITS[providerId];
  const used = getQuotaToday(providerId);
  if (!limits) return { used, limit: null, pct: null, color: 'var(--text-muted)', label: 'non tracké' };
  const limit = limits.daily;
  if (!limit) return { used, limit: null, pct: null, color: 'var(--text-muted)', label: 'illimité' };
  const pct = Math.min(100, (used / limit) * 100);
  let color = 'var(--accent-green)';
  if (pct > 80) color = 'var(--accent-red)';
  else if (pct > 50) color = 'var(--accent-amber)';
  return { used, limit, pct, color, label: `${used}/${limit}` };
}

export function clearAllQuotas() {
  write({});
}
