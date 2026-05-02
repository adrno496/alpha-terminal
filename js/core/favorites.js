// Module favorites — l'utilisateur épingle ses modules préférés via une étoile
// dans le header du module. Persisté en localStorage. Event 'alpha:favorites-changed'
// dispatché à chaque modif pour que la sidebar / autres UIs re-render.

const KEY = 'alpha-terminal:favorite-modules';

function readSet() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSet(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alpha:favorites-changed', { detail: { ids: Array.from(set) } }));
    }
  } catch (e) {
    console.warn('[favorites] save failed:', e);
  }
}

export function getFavorites() {
  return Array.from(readSet());
}

export function isFavorite(moduleId) {
  if (!moduleId) return false;
  return readSet().has(moduleId);
}

export function addFavorite(moduleId) {
  if (!moduleId) return;
  const s = readSet();
  if (!s.has(moduleId)) {
    s.add(moduleId);
    writeSet(s);
  }
}

export function removeFavorite(moduleId) {
  if (!moduleId) return;
  const s = readSet();
  if (s.delete(moduleId)) writeSet(s);
}

export function toggleFavorite(moduleId) {
  if (!moduleId) return false;
  const s = readSet();
  if (s.has(moduleId)) {
    s.delete(moduleId);
    writeSet(s);
    return false;
  } else {
    s.add(moduleId);
    writeSet(s);
    return true;
  }
}

export function clearFavorites() {
  writeSet(new Set());
}
