// Sidebar v2 — mode simple par défaut + mode avancé avec catégories
import { $, $$ } from '../core/utils.js';
import { t, getLocale } from '../core/i18n.js';
import { getUserProfile } from '../core/user-profile.js';
import { recommendedSet } from '../core/module-recommendations.js';
import { isModuleMissingApiKey } from '../core/module-providers.js';
import { getFavorites } from '../core/favorites.js';

// Modules toujours visibles (mode simple)
const ALWAYS_VISIBLE = [
  { id: 'quick-analysis',   num: '⚡' },
  { id: 'wealth',           num: '💼' },
  { id: 'watchlist',        num: '👁' },
  { id: 'knowledge-base',   num: '📚' }
];

// Modules avancés groupés par PARCOURS UTILISATEUR (au lieu de 14 silos techniques).
// Chaque catégorie a une description éducative pour qu'un nouvel utilisateur
// comprenne POURQUOI s'en servir, pas juste ce qu'elle contient.
const CATEGORIES = [
  {
    id: 'daily',
    titleKey: 'cat.daily.title',
    descKey: 'cat.daily.desc',
    modules: [
      { id: 'daily-briefing',       num: '🌅' },
      { id: 'market-pulse',         num: '🌐' },
      { id: 'todays-actions',       num: '🎯' },
      { id: 'smart-alerts-center',  num: '🔔' },
      { id: 'fear-greed',           num: '🌡️' },
      { id: 'watchpoints',          num: '📌' },
      { id: 'price-alerts',         num: '🚨' },
      { id: 'live-watcher',         num: '📡' },
      { id: 'insights-engine',      num: '💡' }
    ]
  },
  {
    id: 'wealth',
    titleKey: 'cat.wealth.title',
    descKey: 'cat.wealth.desc',
    modules: [
      { id: 'accounts-view',          num: '🏦' },
      { id: 'wealth-method',          num: '🧭' },
      { id: 'projection',             num: '📈' },
      { id: 'goals',                  num: '🎯' },
      { id: 'diversification-score',  num: '🎲' },
      { id: 'performance-attribution',num: '📐' },
      { id: 'correlation-matrix',     num: '🔗' },
      { id: 'capital-gains-tracker',  num: '💎' },
      { id: 'multi-currency-pnl',     num: '💱' },
      { id: 'dividends-tracker',      num: '💸' },
      { id: 'portfolio-rebalancer',   num: '⚖️' }
    ]
  },
  {
    id: 'invest',
    titleKey: 'cat.invest.title',
    descKey: 'cat.invest.desc',
    modules: [
      { id: 'research-agent',  num: '🔬' },
      { id: 'decoder-10k',     num: '📑' },
      { id: 'dcf',             num: '💹' },
      { id: 'investment-memo', num: '📝' },
      { id: 'pre-mortem',      num: '🛑' },
      { id: 'stock-screener',  num: '🔎' },
      { id: 'portfolio-audit', num: '🛡️' },
      { id: 'position-sizing', num: '📏' },
      { id: 'battle-mode',     num: '⚔️' },
      { id: 'backtest',        num: '⏪' },
      { id: 'stress-test',     num: '💥' }
    ]
  },
  {
    id: 'market',
    titleKey: 'cat.market.title',
    descKey: 'cat.market.desc',
    modules: [
      { id: 'risk-dashboard',          num: '📊' },
      { id: 'macro-dashboard',         num: '🌍' },
      { id: 'geopolitical-analysis',   num: '🗺️' },
      { id: 'geo-risk',                num: '🛰️' },
      { id: 'news-feed',               num: '📰' },
      { id: 'macro-events-calendar',   num: '📅' },
      { id: 'earnings-calendar',       num: '🏛️' },
      { id: 'sentiment-tracker',       num: '📊' },
      { id: 'earnings-call',           num: '🎙️' },
      { id: 'youtube-transcript',      num: '▶️' },
      { id: 'newsletter-investor',     num: '✉️' }
    ]
  },
  {
    id: 'finance',
    titleKey: 'cat.finance.title',
    descKey: 'cat.finance.desc',
    modules: [
      { id: 'budget',                 num: '💳' },
      { id: 'csv-import',             num: '📥' },
      { id: 'subscriptions-detector', num: '🔁' },
      { id: 'fees-analysis',          num: '🔍' },
      { id: 'fire-calculator',        num: '🔥' }
    ]
  },
  {
    id: 'taxation',
    titleKey: 'cat.taxation.title',
    descKey: 'cat.taxation.desc',
    modules: [
      // Universaux / multi-pays en premier (l'app est utilisée mondialement)
      { id: 'tax-international',      num: '🌐' },  // 9 pays : US, UK, BE, CH, ES, DE, IT, PT, FR
      { id: 'tax-loss-harvesting',    num: '✂️' },  // concept universel (CTO toutes juridictions)
      // Spécifiques France marqués 🇫🇷 dans leur label
      { id: 'tax-optimizer-fr',       num: '🇫🇷' },
      { id: 'envelope-optimizer',     num: '📦' },
      { id: 'ifi-simulator',          num: '🏰' },
      { id: 'donations-succession',   num: '🎁' },
      { id: 'estate-doc-generator',   num: '📜' }
    ]
  },
  {
    id: 'specialty',
    titleKey: 'cat.specialty.title',
    descKey: 'cat.specialty.desc',
    modules: [
      { id: 'crypto-fundamental', num: '🪙' },
      { id: 'whitepaper-reader',  num: '📄' },
      { id: 'esg-impact',         num: '🌱' },
      { id: 'trade-journal',      num: '📓' }
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
  // Wire-once : re-render la sidebar dès qu'un favori est ajouté/retiré
  if (typeof window !== 'undefined' && !window.__alphaFavSidebarWired) {
    window.__alphaFavSidebarWired = true;
    window.addEventListener('alpha:favorites-changed', () => {
      try { renderSidebar(onNavigate); } catch {}
    });
  }
  const nav = $('#sidebar-nav');
  const advanced = getAdvanced();
  // Set des modules recommandés selon profil utilisateur (vide si pas de profil)
  const recoSet = recommendedSet(getUserProfile(), 10, 50);
  const missingKey = (id) => isModuleMissingApiKey(id);
  // Paywall : si paywall.js chargé, marque les modules pro pour les non-premium
  const lockedPro = (id) => {
    try {
      return !!(typeof window !== 'undefined' && window.paywall && !window.paywall.canAccess(id));
    } catch { return false; }
  };
  const recoBadge = (id) => recoSet.has(id) ? `<span class="reco-star" title="${t('reco.tooltip')}" style="color:#ffd700;font-size:13px;line-height:1;" aria-label="recommended">⭐</span>` : '';
  const missingBadge = (id) => missingKey(id) ? `<span class="missing-key" title="${t('reco.missing_key_tooltip')}" style="color:var(--accent-red);font-size:13px;line-height:1;font-weight:700;" aria-label="API key needed">!</span>` : '';
  const lockBadge = (id) => lockedPro(id) ? `<span class="lock-pro" title="Module Premium — abonne-toi pour débloquer" style="color:var(--accent-amber);font-size:13px;line-height:1;" aria-label="Premium only">🔒</span>` : '';
  // Si reco ET missing ET lock : on affiche les badges côté à côté
  const sideBadges = (id) => {
    const a = missingBadge(id), b = recoBadge(id), c = lockBadge(id);
    if (!a && !b && !c) return '';
    return `<span style="margin-left:auto;display:inline-flex;gap:4px;align-items:center;">${a}${b}${c}</span>`;
  };

  const isEN = getLocale() === 'en';
  const searchPlaceholder = isEN ? '🔍 Search modules...' : '🔍 Rechercher un module...';
  let html = '';
  // Search box (en haut, avant ALWAYS_VISIBLE)
  html += `
    <div class="sidebar-search">
      <input type="search" id="sidebar-search-input"
             placeholder="${searchPlaceholder}"
             autocomplete="off"
             spellcheck="false" />
      <button id="sidebar-search-clear" type="button" aria-label="Clear" hidden>×</button>
    </div>
  `;
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

  // === ⭐ FAVORIS — section dédiée toujours visible si au moins 1 favori ===
  // Lookup label/emoji depuis ALL_IDS pour ne pas dupliquer la metadata
  const favIds = getFavorites();
  const favEntries = favIds
    .map(id => ALL_IDS.find(m => m.id === id))
    .filter(Boolean);
  if (favEntries.length > 0) {
    html += `
      <div class="sidebar-favorites" style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);padding:4px 12px;text-transform:uppercase;letter-spacing:0.6px;display:flex;align-items:center;gap:6px;">
          <span>⭐</span><span>${isEN ? 'Favorites' : 'Favoris'}</span>
          <span style="margin-left:auto;font-weight:400;color:var(--text-muted);">${favEntries.length}</span>
        </div>
        ${favEntries.map(m => `
          <button class="sidebar-link${recoSet.has(m.id) ? ' recommended' : ''}${missingKey(m.id) ? ' needs-key' : ''}" data-route="${m.id}" data-num="${m.num}" title="${t(\`mod.${m.id}.desc\`)}">
            <span class="num">${m.num}</span>
            <span class="lbl">${t(\`mod.${m.id}.label\`)}</span>
            ${sideBadges(m.id)}
          </button>
        `).join('')}
      </div>
    `;
  }

  // Advanced toggle — verrouillé pour les non-premium (le mode avancé révèle
  // les 56 modules Pro, donc inutile de l'ouvrir si l'utilisateur ne peut pas
  // les utiliser ; on affiche un cadenas et on ouvre le paywall au clic).
  const advLocked = (() => {
    try { return !!(typeof window !== 'undefined' && window.paywall && !window.paywall._readCache()); }
    catch { return false; }
  })();
  const advLabel = advanced ? t('adv.toggle_hide') : t('adv.toggle_show');
  html += `
    <button class="sidebar-adv-toggle${advLocked ? ' locked' : ''}" data-action="toggle-adv"${advLocked ? ' title="Mode avancé réservé aux abonnés Premium"' : ''}>
      ${advLocked ? '🔒 ' : ''}${advLabel}
    </button>
  `;

  // Categories (only if advanced mode) — collapsible <details>
  if (advanced) {
    const openSet = new Set(JSON.parse(localStorage.getItem('alpha-terminal:sidebar-open-cats') || '[]'));
    // Toujours déplier la 1ère catégorie au tout premier affichage
    if (openSet.size === 0 && !localStorage.getItem('alpha-terminal:sidebar-cats-init')) {
      // Ouvre par défaut la catégorie Daily (la plus utilisée au quotidien)
      openSet.add('daily');
      localStorage.setItem('alpha-terminal:sidebar-cats-init', '1');
    }
    html += `<div class="sidebar-categories">`;
    html += CATEGORIES.map(cat => {
      const recoCount = cat.modules.filter(m => recoSet.has(m.id)).length;
      const isOpen = openSet.has(cat.id);
      const desc = cat.descKey ? t(cat.descKey, '') : '';
      const showDesc = desc && desc !== cat.descKey;
      return `
      <details class="sidebar-cat" data-cat="${cat.id}"${isOpen ? ' open' : ''}>
        <summary class="sidebar-cat-title">
          <span class="sidebar-cat-chevron">▸</span>
          <span class="sidebar-cat-label">${t(cat.titleKey)}</span>
          <span class="sidebar-cat-count">${cat.modules.length}</span>
          ${recoCount > 0 ? `<span class="sidebar-cat-reco" title="${recoCount} recommandé${recoCount>1?'s':''}">⭐${recoCount}</span>` : ''}
        </summary>
        ${showDesc ? `<div class="sidebar-cat-desc" style="font-size:11px;color:var(--text-muted);padding:4px 10px 8px;line-height:1.45;font-style:italic;">${desc}</div>` : ''}
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
    // Si non-premium → le bouton est verrouillé : on ouvre le paywall global
    // au lieu de toggle. Une fois le paiement fait, l'event 'alpha:premiumChanged'
    // re-render la sidebar et le cadenas disparaît.
    const locked = advBtn.classList.contains('locked');
    if (locked && typeof window !== 'undefined' && window.paywall) {
      // Cherche un container central pour afficher le paywall, sinon prompt direct
      const view = document.getElementById('view') || document.body;
      window.paywall.blockUI(view, 'mode-avancé');
      return;
    }
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

  // === Sidebar search (filter modules by label / id) ===
  const searchInput = nav.querySelector('#sidebar-search-input');
  const searchClear = nav.querySelector('#sidebar-search-clear');
  // Restore previous query (volatile, in-memory only) so re-renders during typing don't lose it
  if (typeof window !== 'undefined' && window.__alphaSidebarSearchQ) {
    searchInput.value = window.__alphaSidebarSearchQ;
  }
  // Persist across re-renders triggered by search itself
  if (typeof window !== 'undefined' && window.__alphaSidebarAdvWasOn === undefined) {
    window.__alphaSidebarAdvWasOn = getAdvanced();
  }
  let catOpenStateBeforeSearch = null;

  const clearEmptyMsg = () => {
    const m = nav.querySelector('.sidebar-search-empty-msg');
    if (m) m.remove();
  };

  const applyFilter = () => {
    const qRaw = (searchInput.value || '').trim();
    const q = qRaw.toLowerCase();
    if (typeof window !== 'undefined') window.__alphaSidebarSearchQ = qRaw;

    if (!q) {
      // Reset
      nav.querySelectorAll('.sidebar-link.search-hidden').forEach(el => el.classList.remove('search-hidden'));
      nav.querySelectorAll('.sidebar-cat.search-empty').forEach(el => el.classList.remove('search-empty'));
      clearEmptyMsg();
      searchClear.hidden = true;
      // Restore advanced mode if we toggled it on for search only
      const wasOn = (typeof window !== 'undefined') ? window.__alphaSidebarAdvWasOn : true;
      if (!wasOn && getAdvanced()) {
        setAdvanced(false);
        if (typeof window !== 'undefined') {
          window.__alphaSidebarSearchQ = '';
          window.__alphaSidebarAdvWasOn = undefined;
        }
        renderSidebar(onNavigate);
      } else if (catOpenStateBeforeSearch) {
        // Restore details open state
        nav.querySelectorAll('.sidebar-cat').forEach(d => {
          d.open = catOpenStateBeforeSearch.has(d.dataset.cat);
        });
        catOpenStateBeforeSearch = null;
      }
      return;
    }

    // Active search
    searchClear.hidden = false;

    // If advanced mode is off, enable it temporarily so the categories render
    if (!getAdvanced()) {
      if (typeof window !== 'undefined') window.__alphaSidebarAdvWasOn = false;
      setAdvanced(true);
      renderSidebar(onNavigate);
      // After re-render, the new input exists; re-trigger filter
      const newInput = document.getElementById('sidebar-search-input');
      if (newInput) {
        newInput.value = qRaw;
        newInput.focus();
        // The fresh render will re-wire and call applyFilter via input event? No — call manually
        // by dispatching input event so the new handler runs
        newInput.dispatchEvent(new Event('input'));
      }
      return;
    }

    // Snapshot category open state on first active search
    if (!catOpenStateBeforeSearch) {
      catOpenStateBeforeSearch = new Set();
      nav.querySelectorAll('.sidebar-cat').forEach(d => {
        if (d.open) catOpenStateBeforeSearch.add(d.dataset.cat);
      });
    }

    // Open all categories so matches are visible
    nav.querySelectorAll('.sidebar-cat').forEach(d => { d.open = true; });

    // Filter links
    let totalMatches = 0;
    nav.querySelectorAll('.sidebar-link').forEach(link => {
      const lblEl = link.querySelector('.lbl');
      const label = (lblEl ? lblEl.textContent : link.textContent || '').toLowerCase();
      const route = (link.getAttribute('data-route') || '').toLowerCase();
      const action = link.getAttribute('data-action') || '';
      // Demo button: hide during search (not a module)
      if (action === 'demo') { link.classList.add('search-hidden'); return; }
      const match = label.includes(q) || route.includes(q);
      if (match) { link.classList.remove('search-hidden'); totalMatches++; }
      else link.classList.add('search-hidden');
    });

    // Hide empty categories
    nav.querySelectorAll('.sidebar-cat').forEach(cat => {
      const visible = cat.querySelectorAll('.sidebar-link:not(.search-hidden)').length;
      cat.classList.toggle('search-empty', visible === 0);
    });

    // Empty message
    clearEmptyMsg();
    if (totalMatches === 0) {
      const msg = document.createElement('div');
      msg.className = 'sidebar-search-empty-msg';
      msg.textContent = isEN ? `No module found for "${qRaw}"` : `Aucun module trouvé pour « ${qRaw} »`;
      nav.appendChild(msg);
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
    // Apply once on render (in case of restored query)
    if (searchInput.value) applyFilter();
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      if (typeof window !== 'undefined') window.__alphaSidebarSearchQ = '';
      applyFilter();
      searchInput.focus();
    });
  }

  // Cmd+K / Ctrl+K → focus search (only wire once globally)
  if (typeof window !== 'undefined' && !window.__alphaSidebarSearchKeyWired) {
    window.__alphaSidebarSearchKeyWired = true;
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        const inp = document.getElementById('sidebar-search-input');
        if (inp) {
          e.preventDefault();
          inp.focus();
          inp.select();
        }
      }
    });
  }

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
