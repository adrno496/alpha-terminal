// 🆕 "Depuis ta dernière visite" — résumé compact pour donner envie d'explorer.
// Aggrège : alertes déclenchées, mouvements watchlist > seuil, news récentes.
// Affiché en bandeau au boot si nouveau jour ou > 12h depuis la dernière visite.

const KEY = 'alpha-terminal:last-visit';

export function getLastVisit() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function recordVisit() {
  try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now() })); } catch {}
}

// Heuristique : on n'affiche le banner que si la dernière visite date de > 8h.
export function shouldShowSummary() {
  const last = getLastVisit();
  if (!last) return false; // first visit, pas de "depuis" à afficher
  return Date.now() - last.at > 8 * 3600 * 1000;
}

// Compose un résumé { alerts, watchlistMoves, news, hoursSince } à partir de
// localStorage / IndexedDB. Best-effort : retourne 0 si data indispo.
export async function buildSinceLastSummary() {
  const last = getLastVisit();
  const since = last ? last.at : Date.now() - 24 * 3600 * 1000;
  const hoursSince = Math.round((Date.now() - since) / 3600000);

  let alerts = 0;
  try {
    const raw = localStorage.getItem('alpha-terminal:alerts-fired');
    if (raw) {
      const arr = JSON.parse(raw);
      alerts = arr.filter(a => (a.at || 0) > since).length;
    }
  } catch {}

  // Watchlist moves : on regarde les snapshots de prix s'il y en a.
  let watchlistMoves = 0;
  try {
    const raw = localStorage.getItem('alpha-terminal:watchlist-snapshot');
    const cur = localStorage.getItem('alpha-terminal:watchlist-prices');
    if (raw && cur) {
      const old = JSON.parse(raw);
      const now = JSON.parse(cur);
      Object.keys(now).forEach(sym => {
        const o = old[sym], n = now[sym];
        if (o && n && o > 0) {
          const pct = Math.abs((n - o) / o);
          if (pct >= 0.03) watchlistMoves++; // > 3% bouge
        }
      });
    }
  } catch {}

  return { alerts, watchlistMoves, hoursSince };
}
