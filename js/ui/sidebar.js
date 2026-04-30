// Sidebar v2 — mode simple par défaut + mode avancé avec catégories
import { $, $$ } from '../core/utils.js';
import { t } from '../core/i18n.js';

// Modules toujours visibles (mode simple)
const ALWAYS_VISIBLE = [
  { id: 'quick-analysis',   num: '⚡' },
  { id: 'wealth',           num: '💼' },
  { id: 'watchlist',        num: '👁' },
  { id: 'knowledge-base',   num: '📚' }
];

// Modules avancés groupés par catégorie
const CATEGORIES = [
  {
    id: 'fundamentals',
    titleKey: 'cat.fundamentals',
    modules: [
      { id: 'research-agent',  num: '00' },
      { id: 'decoder-10k',     num: '01' },
      { id: 'dcf',             num: '11' },
      { id: 'investment-memo', num: '15' },
      { id: 'pre-mortem',      num: '12' },
      { id: 'stock-screener',  num: '13' },
      { id: 'portfolio-audit', num: '19' }
    ]
  },
  {
    id: 'macro',
    titleKey: 'cat.macro',
    modules: [
      { id: 'macro-dashboard', num: '02' },
      { id: 'stress-test',     num: '17' },
      { id: 'portfolio-rebalancer', num: '05' },
      { id: 'battle-mode',     num: '18' }
    ]
  },
  {
    id: 'crypto',
    titleKey: 'cat.crypto',
    modules: [
      { id: 'crypto-fundamental', num: '03' },
      { id: 'whitepaper-reader',  num: '07' }
    ]
  },
  {
    id: 'sentiment',
    titleKey: 'cat.sentiment',
    modules: [
      { id: 'sentiment-tracker', num: '08' },
      { id: 'earnings-call',     num: '04' },
      { id: 'newsletter-investor', num: '09' },
      { id: 'youtube-transcript', num: '20' }
    ]
  },
  {
    id: 'tools',
    titleKey: 'cat.tools',
    modules: [
      { id: 'position-sizing', num: '10' },
      { id: 'trade-journal',   num: '14' },
      { id: 'fire-calculator', num: '16' }
    ]
  },
  {
    id: 'tax',
    titleKey: 'cat.tax',
    modules: [
      { id: 'tax-optimizer-fr',  num: '06' },
      { id: 'tax-international', num: '06b' }
    ]
  },
  {
    id: 'finances-perso',
    titleKey: 'cat.finances-perso',
    modules: [
      { id: 'budget',                num: '21' },
      { id: 'fees-analysis',         num: '22' },
      { id: 'dividends-tracker',     num: '23' },
      { id: 'diversification-score', num: '24' },
      { id: 'wealth-method',         num: '25' },
      { id: 'csv-import',            num: '26' },
      { id: 'insights-engine',       num: '27' }
    ]
  }
];

// API publique — liste plate de tous les modules avec labels traduits
const ALL_IDS = [
  ...ALWAYS_VISIBLE,
  ...CATEGORIES.flatMap(c => c.modules)
];

export const MODULES = ALL_IDS.map(m => ({
  ...m,
  get label() { return t(`mod.${m.id}.label`); },
  get desc()  { return t(`mod.${m.id}.desc`); }
}));

const ADV_KEY = 'alpha-terminal:advanced-mode';
function getAdvanced() { return localStorage.getItem(ADV_KEY) === '1'; }
function setAdvanced(v) { localStorage.setItem(ADV_KEY, v ? '1' : '0'); }

export function renderSidebar(onNavigate) {
  const nav = $('#sidebar-nav');
  const advanced = getAdvanced();

  let html = '';
  // Always visible
  html += ALWAYS_VISIBLE.map(m => `
    <button class="sidebar-link primary" data-route="${m.id}" data-num="${m.num}" title="${t(`mod.${m.id}.desc`)}">
      <span class="num">${m.num}</span>
      <span class="lbl">${t(`mod.${m.id}.label`)}</span>
      <span class="mod-help-btn" data-mod-help="${m.id}" role="button" tabindex="0" aria-label="Help">?</span>
    </button>
  `).join('');

  // Demo button (always visible too — high CTA)
  html += `
    <button class="sidebar-link demo-link" data-action="demo" title="${t('demo.no_api')}">
      <span class="num">🎬</span>
      <span class="lbl">${t('demo.title')}</span>
    </button>
  `;

  // Advanced toggle
  html += `
    <button class="sidebar-adv-toggle" data-action="toggle-adv">
      ${advanced ? t('adv.toggle_hide') : t('adv.toggle_show')}
    </button>
  `;

  // Categories (only if advanced mode)
  if (advanced) {
    html += `<div class="sidebar-categories">`;
    html += CATEGORIES.map(cat => `
      <div class="sidebar-cat">
        <div class="sidebar-cat-title">${t(cat.titleKey)}</div>
        ${cat.modules.map(m => `
          <button class="sidebar-link" data-route="${m.id}" data-num="${m.num}" title="${t(`mod.${m.id}.desc`)}">
            <span class="num">${m.num}</span>
            <span class="lbl">${t(`mod.${m.id}.label`)}</span>
            <span class="mod-help-btn" data-mod-help="${m.id}" role="button" tabindex="0" aria-label="Help">?</span>
          </button>
        `).join('')}
      </div>
    `).join('');
    html += `</div>`;
  }

  nav.innerHTML = html;

  // Wire clicks
  $$('.sidebar-link').forEach(b => {
    b.addEventListener('click', (e) => {
      // Don't navigate when the (?) help icon is clicked — it has its own handler
      if (e.target.closest('.mod-help-btn')) return;
      const route = b.getAttribute('data-route');
      const action = b.getAttribute('data-action');
      if (action === 'demo') {
        import('./demo-mode.js').then(m => m.showDemoGallery());
      } else if (route) {
        onNavigate(route);
      }
    });
  });

  // Wire (?) help buttons — open popover
  $$('.mod-help-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = b.getAttribute('data-mod-help');
      const { showModuleHelp } = await import('./tooltips.js');
      showModuleHelp(b, id);
    });
  });
  // Advanced toggle
  const advBtn = nav.querySelector('[data-action="toggle-adv"]');
  if (advBtn) advBtn.addEventListener('click', () => {
    setAdvanced(!getAdvanced());
    renderSidebar(onNavigate);
  });

  // Sidebar bottom labels
  document.querySelectorAll('.sidebar-bottom .sidebar-link').forEach(b => {
    const route = b.getAttribute('data-route');
    if (route === 'history') b.innerHTML = '<span class="dot"></span> ' + t('sidebar.history');
    else if (route === 'settings') b.innerHTML = '<span class="dot"></span> ' + t('sidebar.settings');
    else if (route === 'landing') b.innerHTML = '<span class="dot"></span> ' + t('sidebar.about');
  });
}

export function setActiveSidebar(route) {
  $$('.sidebar-link').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-route') === route);
  });
}

export function getModuleById(id) {
  return MODULES.find(m => m.id === id);
}

export { CATEGORIES };
