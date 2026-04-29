// Toggle thème clair / sombre — persiste dans localStorage
const KEY = 'alpha-terminal:theme';

export function getTheme() {
  return localStorage.getItem(KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
  // Met à jour tous les boutons toggle présents dans le DOM
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀' : '🌙';
    btn.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
  });
}

export function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  applyTheme(getTheme());
}

// Crée un bouton toggle (utilisable dans n'importe quel container)
export function makeThemeToggle() {
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.setAttribute('data-theme-toggle', '');
  btn.textContent = getTheme() === 'dark' ? '☀' : '🌙';
  btn.title = getTheme() === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
  btn.addEventListener('click', toggleTheme);
  return btn;
}
