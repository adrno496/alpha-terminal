// Command palette Cmd+K — switch rapide entre modules + actions
import { $ } from '../core/utils.js';
import { MODULES } from './sidebar.js';

let host = null;
let onPick = null;

const ACTIONS = [
  { id: 'history',  label: 'Historique',     hint: 'voir toutes les analyses' },
  { id: 'settings', label: 'Settings',       hint: 'configuration & sécurité' },
  { id: 'home',     label: 'Home dashboard', hint: 'stats globales' },
];

export function initCmdK(navigate) {
  onPick = navigate;
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open();
    }
    if (e.key === 'Escape' && host) close();
  });
}

function open() {
  if (host) { close(); return; }
  host = document.createElement('div');
  host.className = 'cmdk-overlay';
  host.innerHTML = `
    <div class="cmdk-modal">
      <input id="cmdk-input" class="cmdk-input" placeholder="Tape pour chercher un module ou une action..." autofocus />
      <div id="cmdk-list" class="cmdk-list"></div>
      <div class="cmdk-footer">
        <span><kbd>↑↓</kbd> naviguer</span>
        <span><kbd>↵</kbd> ouvrir</span>
        <span><kbd>esc</kbd> fermer</span>
      </div>
    </div>
  `;
  host.addEventListener('click', (e) => { if (e.target === host) close(); });
  document.body.appendChild(host);

  const input = $('#cmdk-input', host);
  input.focus();

  let items = buildItems('');
  let cursor = 0;
  render();

  input.addEventListener('input', () => {
    items = buildItems(input.value);
    cursor = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = (cursor + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = (cursor - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(items[cursor]); }
  });

  function render() {
    const list = $('#cmdk-list', host);
    list.innerHTML = items.map((it, i) => `
      <div class="cmdk-item ${i === cursor ? 'active' : ''}" data-i="${i}">
        <span class="cmdk-num">${it.num || '·'}</span>
        <span class="cmdk-label">${it.label}</span>
        <span class="cmdk-hint">${it.hint || ''}</span>
      </div>
    `).join('');
    list.querySelectorAll('.cmdk-item').forEach((el) => {
      el.addEventListener('click', () => pick(items[+el.getAttribute('data-i')]));
    });
  }

  function pick(it) {
    if (!it) return;
    close();
    onPick && onPick(it.id);
  }
}

function buildItems(q) {
  const all = [
    ...MODULES.map(m => ({ id: m.id, num: m.num, label: m.label, hint: m.desc })),
    ...ACTIONS
  ];
  if (!q.trim()) return all;
  const ql = q.toLowerCase();
  return all.filter(it =>
    (it.label || '').toLowerCase().includes(ql) ||
    (it.hint  || '').toLowerCase().includes(ql) ||
    (it.id    || '').toLowerCase().includes(ql)
  );
}

function close() {
  if (host) host.remove();
  host = null;
}
