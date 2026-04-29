// Keyboard shortcuts globaux (g+x à la Linear/Vim, ? pour cheatsheet)
import { showGenericModal } from './modal.js';

const SHORTCUTS = [
  { keys: 'g h',    desc: 'Home',                 route: 'home' },
  { keys: 'g d',    desc: '10-K Decoder',         route: 'decoder-10k' },
  { keys: 'g m',    desc: 'Macro Dashboard',      route: 'macro-dashboard' },
  { keys: 'g c',    desc: 'Crypto Fundamental',   route: 'crypto-fundamental' },
  { keys: 'g e',    desc: 'Earnings Call',        route: 'earnings-call' },
  { keys: 'g p',    desc: 'Portfolio Rebalancer', route: 'portfolio-rebalancer' },
  { keys: 'g t',    desc: 'Tax Optimizer FR',     route: 'tax-optimizer-fr' },
  { keys: 'g w',    desc: 'Whitepaper Reader',    route: 'whitepaper-reader' },
  { keys: 'g s',    desc: 'Sentiment Tracker',    route: 'sentiment-tracker' },
  { keys: 'g n',    desc: 'Newsletter (Voice)',   route: 'newsletter-investor' },
  { keys: 'g k',    desc: 'Position Sizing',      route: 'position-sizing' },
  { keys: 'g f',    desc: 'DCF / Intrinsic Value',route: 'dcf' },
  { keys: 'g r',    desc: 'Research Agent',       route: 'research-agent' },
  { keys: 'g x',    desc: 'Pre-Mortem',           route: 'pre-mortem' },
  { keys: 'g q',    desc: 'Stock Screener',       route: 'stock-screener' },
  { keys: 'g j',    desc: 'Trade Journal',        route: 'trade-journal' },
  { keys: 'g v',    desc: 'Investment Memo',      route: 'investment-memo' },
  { keys: 'g i',    desc: 'FIRE Calculator',      route: 'fire-calculator' },
  { keys: 'g u',    desc: 'Stress Test',          route: 'stress-test' },
  { keys: 'g b',    desc: 'Battle Mode',          route: 'battle-mode' },
  { keys: 'g l',    desc: 'Watchlist',            route: 'watchlist' },
  { keys: 'g [',    desc: 'Historique',           route: 'history' },
  { keys: 'g ,',    desc: 'Settings',             route: 'settings' },
  { keys: '⌘K / ⌃K',desc: 'Command palette' },
  { keys: '?',      desc: 'Show this help' },
  { keys: 'esc',    desc: 'Fermer modale / palette' }
];

let pendingG = false;
let gTimer = null;

export function initKeyboard(navigate) {
  document.addEventListener('keydown', (e) => {
    // Ne pas intercepter si on tape dans un input/textarea
    const t = e.target;
    if (t.matches('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '?') { e.preventDefault(); showCheatsheet(); return; }
    if (e.key === 'g') {
      pendingG = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(() => pendingG = false, 1000);
      return;
    }
    if (pendingG) {
      pendingG = false;
      const route = SHORTCUTS.find(s => s.keys === 'g ' + e.key)?.route;
      if (route) { e.preventDefault(); navigate(route); }
    }
  });
}

function showCheatsheet() {
  const html = `
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;">
      Tape <kbd>g</kbd> puis une lettre pour naviguer. <kbd>⌘K</kbd> pour la palette.
    </p>
    <table class="cheatsheet">
      <tbody>
        ${SHORTCUTS.map(s => `<tr><td><kbd>${s.keys}</kbd></td><td>${s.desc}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
  showGenericModal('⌨️ Raccourcis clavier', html);
}
