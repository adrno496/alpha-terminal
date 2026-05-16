// 🔥 Streak — compte les jours consécutifs d'utilisation pour créer une habitude.
// Comme Duolingo : voir le compteur monter pousse à revenir le lendemain.
// Privacy-first : 100% localStorage, aucune donnée envoyée serveur.

const KEY = 'alpha-terminal:streak';
const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysBetween(a, b) {
  // a, b = 'YYYY-MM-DD'. Retourne nombre de jours pleins entre les 2 (b après a).
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDay: null, totalDays: 0, milestonesHit: [] };
  } catch {
    return { current: 0, best: 0, lastDay: null, totalDays: 0, milestonesHit: [] };
  }
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

// Appelé au boot de l'app. Retourne { current, best, milestone? } si nouveau jour.
export function tickStreak() {
  const s = read();
  const today = todayStr();
  if (s.lastDay === today) return s; // déjà compté aujourd'hui

  let milestoneHit = null;
  if (!s.lastDay) {
    s.current = 1;
  } else {
    const gap = daysBetween(s.lastDay, today);
    if (gap === 1) s.current += 1;       // jour consécutif
    else if (gap > 1) s.current = 1;     // streak cassée, reset
    // gap === 0 ne devrait pas arriver (déjà filtré ci-dessus)
  }
  s.lastDay = today;
  s.totalDays = (s.totalDays || 0) + 1;
  s.best = Math.max(s.best || 0, s.current);

  // Milestone atteint ?
  if (MILESTONES.includes(s.current) && !(s.milestonesHit || []).includes(s.current)) {
    s.milestonesHit = [...(s.milestonesHit || []), s.current];
    milestoneHit = s.current;
  }
  write(s);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alpha:streak-changed', { detail: { ...s, milestoneHit } }));
  }
  return { ...s, milestoneHit };
}

export function getStreak() { return read(); }

// Affichage compact pour la sidebar : 🔥 N
export function formatStreakBadge() {
  const s = read();
  if (!s.current) return '';
  // Choix de la flamme : bronze < 7, argent < 30, or 30+
  const flame = s.current >= 30 ? '🔥' : s.current >= 7 ? '🔥' : '🔥';
  return `${flame} ${s.current}`;
}
