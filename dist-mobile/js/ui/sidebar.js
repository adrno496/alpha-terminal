// Sidebar v2 — mode simple par défaut + mode avancé avec catégories
import { $, $$ } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { getUserProfile } from '../core/user-profile.js';
import { recommendedSet } from '../core/module-recommendations.js';
import { isModuleMissingApiKey } from '../core/module-providers.js';

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
    id: 'budget-daily',
    titleKey: 'cat.budget-daily',
    modules: [
      { id: 'budget',                 num: '21' },
      { id: 'csv-import',             num: '26' },
      { id: 'subscriptions-detector', num: '35' }
    ]
  },
  {
    id: 'wealth-overview',
    titleKey: 'cat.wealth-overview',
    modules: [
      { id: 'wealth-method',          num: '25' },
      { id: 'accounts-view',          num: '32' },
      { id: 'projection',             num: '31' },
      { id: 'diversification-score',  num: '24' },
      { id: 'performance-attribution',num: '46' },
      { id: 'correlation-matrix',     num: '42' }
    ]
  },
  {
    id: 'income-costs',
    titleKey: 'cat.income-costs',
    modules: [
      { id: 'dividends-tracker',      num: '23' },
      { id: 'fees-analysis',          num: '22' },
      { id: 'multi-currency-pnl',     num: '40' }
    ]
  },
  {
    id: 'planning-goals',
    titleKey: 'cat.planning-goals',
    modules: [
      { id: 'goals',                  num: '30' },
      { id: 'backtest',               num: '39' },
      { id: 'capital-gains-tracker',  num: '38' }
    ]
  },
  {
    id: 'alerts-live',
    titleKey: 'cat.alerts-live',
    modules: [
      { id: 'insights-engine',        num: '27' },
      { id: 'price-alerts',           num: '28' },
      { id: 'live-watcher',           num: '29' },
      { id: 'earnings-calendar',      num: '41' },
      { id: 'macro-events-calendar',  num: '45' }
    ]
  },
  {
    id: 'tax-advanced',
    titleKey: 'cat.tax-advanced',
    modules: [
      { id: 'envelope-optimizer',     num: '36' },
      { id: 'tax-loss-harvesting',    num: '34' },
      { id: 'ifi-simulator',          num: '33' },
      { id: 'donations-succession',   num: '37' },
      { id: 'estate-doc-generator',   num: '44' }
    ]
  },
  {
    id: 'esg',
    titleKey: 'cat.esg',
    modules: [
      { id: 'esg-impact',             num: '43' }
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
  // Set des modules recommandés selon profil utilisateur (vide si pas de profil)
  const recoSet = recommendedSet(getUserProfile(), 10, 50);
  const missingKey = (id) => isModuleMissingApiKey(id);
  const recoBadge = (id) => recoSet.has(id) ? `<span class="reco-star" title="${t('reco.tooltip')}" style="margin-left:auto;color:#ffd700;font-size:13px;line-height:1;" aria-label="recommended">⭐</span>` : '';
  const missingBadge = (id) => missingKey(id) ? `<span class="missing-key" title="${t('reco.missing_key_tooltip')}" style="margin-left:auto;color:var(--accent-red);font-size:13px;line-height:1;font-weight:700;" aria-label="API key needed">!</span>` : '';
  // Si reco ET missing : on affiche les deux côté à côté
  const sideBadges = (id) => {
    const a = missingBadge(id), b = recoBadge(id);
    if (!a && !b) return '';
    return `<span style="margin-left:auto;display:inline-flex;gap:4px;align-items:center;">${a}${b}</span>`;
  };

  let html = '';
  // Always visible
  html += ALWAYS_VISIBLE.map(m => `
    <button class="sidebar-link primary${recoSet.has(m.id) ? ' recommended' : ''}${missingKey(m.id) ? ' needs-key' : ''}" data-route="${m.id}" data-num="${m.num}" title="${t(`mod.${m.id}.desc`)}${missingKey(m.id) ? ' — ⚠️ ' + t('reco.missing_key_tooltip') : ''}">
      <span class="num">${m.num}</span>
      <span class="lbl">${t(`mod.${m.id}.label`)}</span>
      ${sideBadges(m.id)}
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

  // Categories (only if advanced mode) — collapsible <details>
  if (advanced) {
    const openSet = new Set(JSON.parse(localStorage.getItem('alpha-terminal:sidebar-open-cats') || '[]'));
    // Toujours déplier la 1ère catégorie au tout premier affichage
    if (openSet.size === 0 && !localStorage.getItem('alpha-terminal:sidebar-cats-init')) {
      openSet.add(CATEGORIES[0].id);
      localStorage.setItem('alpha-terminal:sidebar-cats-init', '1');
    }
    html += `<div class="sidebar-categories">`;
    html += CATEGORIES.map(cat => {
      const recoCount = cat.modules.filter(m => recoSet.has(m.id)).length;
      const isOpen = openSet.has(cat.id);
      return `
      <details class="sidebar-cat" data-cat="${cat.id}"${isOpen ? ' open' : ''}>
        <summary class="sidebar-cat-title">
          <span class="sidebar-cat-chevron">▸</span>
          <span class="sidebar-cat-label">${t(cat.titleKey)}</span>
          <span class="sidebar-cat-count">${cat.modules.length}</span>
          ${recoCount > 0 ? `<span class="sidebar-cat-reco" title="${recoCount} recommandé${recoCount>1?'s':''}">⭐${recoCount}</span>` : ''}
        </summary>
        <div class="sidebar-cat-modules">
          ${cat.modules.map(m => `
            <button class="sidebar-link${recoSet.has(m.id) ? ' recommended' : ''}${missingKey(m.id) ? ' needs-key' : ''}" data-route="${m.id}" data-num="${m.num}" title="${t(`mod.${m.id}.desc`)}${missingKey(m.id) ? ' — ⚠️ ' + t('reco.missing_key_tooltip') : ''}">
              <span class="num">${m.num}</span>
              <span class="lbl">${t(`mod.${m.id}.label`)}</span>
              ${sideBadges(m.id)}
              <span class="mod-help-btn" data-mod-help="${m.id}" role="button" tabindex="0" aria-label="Help">?</span>
            </button>
          `).join('')}
        </div>
      </details>`;
    }).join('');
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

  // Persistance des catégories ouvertes/fermées
  $$('.sidebar-cat').forEach(detEl => {
    detEl.addEventListener('toggle', () => {
      const open = [];
      $$('.sidebar-cat').forEach(d => { if (d.open) open.push(d.dataset.cat); });
      localStorage.setItem('alpha-terminal:sidebar-open-cats', JSON.stringify(open));
    });
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
