// Tracker d'usage des modules — pour la section "Récemment utilisés" en sidebar.
// Stocké en localStorage. Compteur + dernière utilisation par module ID.

const KEY = 'alpha-terminal:module-usage';
const MAX_RECENT = 5;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function write(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alpha:module-usage-changed'));
    }
  } catch {}
}

// Appelé par navigate() à chaque ouverture de module
export function trackModuleUsage(moduleId) {
  if (!moduleId || moduleId === 'home' || moduleId === 'settings' || moduleId === 'history' || moduleId === 'landing') return;
  const data = read();
  const prev = data[moduleId] || { count: 0, lastAt: 0 };
  data[moduleId] = { count: prev.count + 1, lastAt: Date.now() };
  write(data);
}

// Liste les N derniers modules utilisés (par lastAt desc)
export function getRecentModules(limit = MAX_RECENT) {
  const data = read();
  return Object.entries(data)
    .sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0))
    .slice(0, limit)
    .map(([id, meta]) => ({ id, ...meta }));
}

// Top N par count
export function getMostUsedModules(limit = MAX_RECENT) {
  const data = read();
  return Object.entries(data)
    .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
    .slice(0, limit)
    .map(([id, meta]) => ({ id, ...meta }));
}

export function clearModuleUsage() {
  write({});
}
