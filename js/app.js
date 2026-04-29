// Entry point — bootstrap, router, landing/setup flow, home, cmdk, tooltips
import { $, fmtUSD, fmtRelative, escHtml } from './core/utils.js';
import { isConnected, onConnectionChange, abortCurrentCall } from './core/api.js';
import { hasVault } from './core/crypto.js';
import { listAnalyses, getSettings, setSettings, onDbAvailabilityChange } from './core/storage.js';
import { getCost, onCostChange } from './core/cost-tracker.js';

import { renderSidebar, setActiveSidebar, getModuleById } from './ui/sidebar.js';
import { openLockFlow } from './ui/modal.js';
import { renderHistoryView } from './ui/history.js';
import { renderSettingsView } from './ui/settings.js';
import { initCmdK } from './ui/cmdk.js';
import { initTooltips } from './ui/tooltips.js';
import { renderLanding, showLanding, hideLanding } from './ui/landing.js';
import { initTheme, makeThemeToggle } from './ui/theme.js';

import { renderDecoder10kView }         from './modules/decoder-10k.js';
import { renderMacroDashboardView }     from './modules/macro-dashboard.js';
import { renderCryptoFundamentalView }  from './modules/crypto-fundamental.js';
import { renderEarningsCallView }       from './modules/earnings-call.js';
import { renderPortfolioRebalancerView } from './modules/portfolio-rebalancer.js';
import { renderTaxOptimizerView }       from './modules/tax-optimizer-fr.js';
import { renderTaxInternationalView }   from './modules/tax-international.js';
import { renderQuickAnalysisView }      from './modules/quick-analysis.js';
import { renderWealthView }             from './modules/wealth.js';
import { renderWhitepaperReaderView }   from './modules/whitepaper-reader.js';
import { renderSentimentTrackerView }   from './modules/sentiment-tracker.js';
import { renderNewsletterInvestorView } from './modules/newsletter-investor.js';
import { renderPositionSizingView }     from './modules/position-sizing.js';
import { renderDcfView }                from './modules/dcf.js';
import { renderResearchAgentView }      from './modules/research-agent.js';
import { renderPreMortemView }          from './modules/pre-mortem.js';
import { renderStockScreenerView }      from './modules/stock-screener.js';
import { renderTradeJournalView }       from './modules/trade-journal.js';
import { renderInvestmentMemoView }     from './modules/investment-memo.js';
import { renderFireCalculatorView }     from './modules/fire-calculator.js';
import { renderStressTestView }         from './modules/stress-test.js';
import { renderBattleModeView }         from './modules/battle-mode.js';
import { renderWatchlistView }          from './modules/watchlist.js';
import { renderKnowledgeBaseView }      from './modules/knowledge-base.js';
import { renderPortfolioAuditView }     from './modules/portfolio-audit.js';
import { renderYoutubeTranscriptView }  from './modules/youtube-transcript.js';

import { renderExistingResult } from './modules/_shared.js';
import { safeRender } from './core/safe-render.js';
import { makeLocaleToggle, t, applyI18nAttributes } from './core/i18n.js';
import { isTourCompleted, startTour } from './ui/tour.js';
import { initKeyboard } from './ui/keyboard.js';
import { tryLoadSharedFromHash } from './ui/sharing.js';
import { showDemoGallery } from './ui/demo-mode.js';
import { openComparePicker } from './ui/compare.js';

const ROUTES = {
  'quick-analysis':      { render: renderQuickAnalysisView,      label: '⚡ Quick Analysis' },
  'wealth':              { render: renderWealthView,             label: '💼 Patrimoine' },
  'research-agent':      { render: renderResearchAgentView,      label: '🚀 Research Agent' },
  'decoder-10k':         { render: renderDecoder10kView,         label: '10-K Decoder' },
  'macro-dashboard':     { render: renderMacroDashboardView,     label: 'Macro Dashboard' },
  'crypto-fundamental':  { render: renderCryptoFundamentalView,  label: 'Crypto Fundamental' },
  'earnings-call':       { render: renderEarningsCallView,       label: 'Earnings Call' },
  'portfolio-rebalancer':{ render: renderPortfolioRebalancerView,label: 'Portfolio Rebalancer' },
  'tax-optimizer-fr':    { render: renderTaxOptimizerView,       label: 'Tax Optimizer FR' },
  'tax-international':   { render: renderTaxInternationalView,   label: 'Tax Optimizer International' },
  'whitepaper-reader':   { render: renderWhitepaperReaderView,   label: 'Whitepaper Reader' },
  'sentiment-tracker':   { render: renderSentimentTrackerView,   label: 'Sentiment Tracker' },
  'newsletter-investor': { render: renderNewsletterInvestorView, label: 'Newsletter (Voice)' },
  'position-sizing':     { render: renderPositionSizingView,     label: 'Position Sizing' },
  'dcf':                 { render: renderDcfView,                label: 'DCF / Fair Value' },
  'pre-mortem':          { render: renderPreMortemView,          label: 'Pre-Mortem' },
  'stock-screener':      { render: renderStockScreenerView,      label: 'Stock Screener' },
  'trade-journal':       { render: renderTradeJournalView,       label: 'Trade Journal' },
  'investment-memo':     { render: renderInvestmentMemoView,     label: 'Investment Memo' },
  'fire-calculator':     { render: renderFireCalculatorView,     label: 'FIRE Calculator' },
  'stress-test':         { render: renderStressTestView,         label: 'Stress Test' },
  'battle-mode':         { render: renderBattleModeView,         label: 'Battle Mode' },
  'watchlist':           { render: renderWatchlistView,          label: 'Watchlist' },
  'knowledge-base':      { render: renderKnowledgeBaseView,      label: 'Knowledge Base' },
  'portfolio-audit':     { render: renderPortfolioAuditView,     label: '🔎 Portfolio Audit' },
  'youtube-transcript':  { render: renderYoutubeTranscriptView,  label: '🎙 YouTube + CEO Forensics' },
};

const STATE = { currentRoute: null };

function setHash(route) { if (location.hash !== '#' + route) location.hash = '#' + route; }

function navigate(route) {
  // Landing : on quitte l'app
  if (route === 'landing') {
    showLanding();
    setHash('landing');
    return;
  }
  // S'assure que l'app est visible
  if ($('#app').classList.contains('hidden')) {
    // L'app est masquée — il faut soit débloquer (vault), soit landing
    if (!isConnected()) {
      // Pas connecté → ouvre le lock flow (depuis la landing par exemple)
      openLockFlow();
      return;
    }
    hideLanding();
  }

  if (STATE.currentRoute && STATE.currentRoute !== route) abortCurrentCall();
  STATE.currentRoute = route;
  const view = $('#view');
  view.innerHTML = '';
  setActiveSidebar(route);

  const titleEl = $('#active-title');
  const subEl = $('#active-subtitle');

  if (ROUTES[route]) {
    titleEl.textContent = ROUTES[route].label;
    subEl.textContent = '';
    ROUTES[route].render(view);
    setHash(route);
    return;
  }
  if (route === 'history') { titleEl.textContent = 'HISTORIQUE'; subEl.textContent = ''; renderHistoryView(view, { onOpen: openExistingRecord }); setHash(route); return; }
  if (route === 'settings') { titleEl.textContent = 'SETTINGS'; subEl.textContent = ''; renderSettingsView(view); setHash(route); return; }

  // Home
  titleEl.textContent = 'ALPHA TERMINAL';
  subEl.textContent = 'Multi-LLM · BYOK · 100% client-side';
  renderHome(view);
  setHash('home');
}

async function renderHome(viewEl) {
  const cost = getCost();
  const all = await listAnalyses({ limit: 1000 });
  const recent = all.slice(0, 6);
  const byModule = {};
  all.forEach(a => byModule[a.module] = (byModule[a.module] || 0) + 1);
  const topModules = Object.entries(byModule).sort((a,b) => b[1]-a[1]).slice(0, 3);

  let providers = [];
  try { const { getOrchestrator } = await import('./core/api.js'); providers = getOrchestrator().getProviderNames(); } catch {}

  viewEl.innerHTML = `
    <div class="module-header">
      <h2>${t('home.welcome')}</h2>
      <div class="module-desc">
        ${t('home.desc')}
        <kbd style="background:var(--bg-tertiary);padding:1px 6px;border-radius:3px;font-family:var(--font-mono);font-size:11px;border:1px solid var(--border);margin:0 4px;">⌘K</kbd> ${t('home.palette_hint')}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${t('home.cost_total')}</div><div class="stat-value green">${fmtUSD(cost.total || 0)}</div></div>
      <div class="stat"><div class="stat-label">${t('home.analyses')}</div><div class="stat-value">${all.length}</div></div>
      <div class="stat"><div class="stat-label">${t('home.api_calls')}</div><div class="stat-value">${cost.calls || 0}</div></div>
      <div class="stat"><div class="stat-label">${t('home.providers')}</div><div class="stat-value ${providers.length ? 'green' : 'red'}">${providers.length}</div></div>
    </div>

    ${providers.length ? `
    <div class="card">
      <div class="card-title">${t('home.providers_connected')}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${providers.map(p => {
          const icons = { claude:'🤖', openai:'🧠', gemini:'✨', grok:'🐦', openrouter:'🌀', perplexity:'🔎', mistral:'🇫🇷', cerebras:'⚡', github:'🐙', nvidia:'🟢', huggingface:'🤗', cloudflare:'☁️', together:'🟣', cohere:'🟦' };
          const names = { claude:'Claude', openai:'OpenAI', gemini:'Gemini', grok:'Grok', openrouter:'OpenRouter', perplexity:'Perplexity', mistral:'Mistral', cerebras:'Cerebras', github:'GitHub', nvidia:'NVIDIA', huggingface:'HuggingFace', cloudflare:'Cloudflare', together:'Together', cohere:'Cohere' };
          return `<div style="padding:8px 14px;background:var(--bg-tertiary);border-radius:4px;font-size:12px;"><span style="margin-right:6px;">${icons[p] || '·'}</span> ${names[p] || p}</div>`;
        }).join('')}
      </div>
      <p style="font-size:11.5px;color:var(--text-muted);margin-top:10px;">→ <a href="#settings" data-nav="settings">${t('home.manage_keys')}</a></p>
    </div>
    ` : ''}

    ${topModules.length ? `
    <div class="card">
      <div class="card-title">${t('home.top_modules')}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${topModules.map(([mod, count]) => {
          const m = getModuleById(mod);
          return `<div data-route="${mod}" style="cursor:pointer;padding:8px 14px;background:var(--bg-tertiary);border-radius:4px;font-size:12px;"><span style="color:var(--text-secondary);">${m ? m.label : mod}</span> <span style="font-family:var(--font-mono);color:var(--accent-green);">${count}</span></div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${recent.length ? `
    <div class="card">
      <div class="card-title">${t('home.recent')}</div>
      <div class="home-recent">
        ${recent.map(r => {
          const m = getModuleById(r.module);
          const preview = (r.output || '').replace(/[#*`_>\-\|]/g, '').replace(/\n+/g, ' ').slice(0, 140);
          return `
          <div class="home-recent-item" data-rid="${r.id}">
            <div class="home-recent-meta">${m ? m.label : r.module} · ${fmtRelative(r.createdAt)}</div>
            <div style="font-size:13px;font-weight:500;margin-bottom:4px;">${escHtml(r.title || '')}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${escHtml(preview)}…</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ` : `
    <div class="card">
      <div class="card-title">Quick start</div>
      <ol style="margin-left:18px;line-height:2;color:var(--text-secondary);">
        <li>Choisis un module dans la sidebar (ou tape <kbd style="background:var(--bg-tertiary);padding:1px 6px;border-radius:3px;font-family:var(--font-mono);font-size:11px;border:1px solid var(--border);">⌘K</kbd>).</li>
        <li>Le router sélectionne automatiquement le meilleur provider.</li>
        <li>Lance l'analyse → streaming markdown progressif.</li>
        <li>Override possible par module dans le header.</li>
      </ol>
    </div>
    `}
  `;

  viewEl.querySelectorAll('[data-route]').forEach(el => el.addEventListener('click', () => navigate(el.getAttribute('data-route'))));
  viewEl.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.getAttribute('data-nav')); }));
  viewEl.querySelectorAll('[data-rid]').forEach(el => el.addEventListener('click', async () => {
    const id = el.getAttribute('data-rid');
    const rec = all.find(a => a.id === id);
    if (rec) openExistingRecord(rec);
  }));
}

function openExistingRecord(record) {
  navigate(record.module);
  setTimeout(() => {
    const view = $('#view');
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '20px';
    view.appendChild(wrapper);
    renderExistingResult(wrapper, record);
    wrapper.scrollIntoView({ behavior: 'smooth' });
  }, 60);
}

function refreshApiStatus() {
  const el = $('#api-status'); if (!el) return;
  if (isConnected()) { el.classList.add('connected'); el.querySelector('.status-text').textContent = 'API connected'; }
  else { el.classList.remove('connected'); el.querySelector('.status-text').textContent = 'API disconnected'; }
}

function injectCostBadge() {
  const right = document.querySelector('.topbar-right');
  if (!right || $('#cost-badge')) return;
  const badge = document.createElement('button');
  badge.id = 'cost-badge';
  badge.className = 'cost-badge';
  badge.innerHTML = `<span class="cost-label">${t('topbar.cost')}</span><span id="cost-value">$0.0000</span>`;
  badge.title = t('topbar.cost.tooltip');
  badge.addEventListener('click', () => navigate('settings'));
  right.insertBefore(badge, right.firstChild);
  // Theme toggle (à côté du cost badge)
  if (!right.querySelector('.theme-toggle')) right.insertBefore(makeThemeToggle(), badge);
  // Locale toggle
  if (!right.querySelector('.lang-toggle')) right.insertBefore(makeLocaleToggle(), badge);
  refreshCostBadge();
}
function refreshCostBadge() {
  const el = $('#cost-value'); if (!el) return;
  el.textContent = fmtUSD(getCost().total || 0);
}

function startLockFlow() {
  hideLanding();
  openLockFlow();
}

function boot() {
  renderSidebar(navigate);

  document.querySelectorAll('.sidebar-bottom .sidebar-link').forEach(b => {
    b.addEventListener('click', () => navigate(b.getAttribute('data-route')));
  });
  document.querySelector('.sidebar-logo')?.addEventListener('click', () => navigate('home'));

  // In-app footer legal links
  document.querySelectorAll('[data-app-legal]').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const which = a.getAttribute('data-app-legal');
      const { showLegalPage } = await import('./ui/legal-pages.js');
      showLegalPage(which);
    });
  });

  onConnectionChange(refreshApiStatus);
  onCostChange(refreshCostBadge);
  refreshApiStatus();

  // Bannière "navigation privée" si IndexedDB indisponible
  onDbAvailabilityChange((available) => {
    let banner = document.getElementById('db-unavailable-banner');
    if (available) {
      if (banner) banner.remove();
      return;
    }
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'db-unavailable-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;padding:10px 16px;background:#b8860b;color:#fff;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    banner.innerHTML = '⚠️ <strong>Stockage local indisponible</strong> — Navigation privée détectée. Tes analyses ne seront pas sauvegardées. <button style="margin-left:8px;background:transparent;border:1px solid #fff;color:#fff;padding:2px 8px;cursor:pointer;border-radius:3px;">Fermer</button>';
    banner.querySelector('button').addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
  });

  initCmdK(navigate);
  initTooltips();
  initTheme();
  initKeyboard(navigate);

  // Mobile : hamburger menu drawer
  const hamb = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const appEl = document.getElementById('app');
  if (hamb && sidebar) {
    hamb.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      appEl.classList.toggle('drawer-open');
    });
    // Auto-close on navigation (mobile only)
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        if (e.target.closest('.sidebar-link') || e.target.closest('.sidebar-bottom .sidebar-link')) {
          sidebar.classList.remove('open');
          appEl.classList.remove('drawer-open');
        }
      }
    });
    // Close on overlay click (mobile)
    appEl.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        if (e.target === appEl || e.target.classList.contains('main')) {
          sidebar.classList.remove('open');
          appEl.classList.remove('drawer-open');
        }
      }
    });
  }

  // PWA service worker — uniquement sur http(s) hors Capacitor/Electron
  const isCapacitor = !!(window.Capacitor || window.cordova);
  const isElectron  = navigator.userAgent.toLowerCase().includes('electron');
  const protoOK    = location.protocol === 'http:' || location.protocol === 'https:';
  if ('serviceWorker' in navigator && protoOK && !isCapacitor && !isElectron) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // Compare button + Demo button (raccourcis dans la sidebar bottom)
  const sidebarBottom = document.querySelector('.sidebar-bottom');
  if (sidebarBottom && !sidebarBottom.querySelector('[data-cmp]')) {
    const cmp = document.createElement('button');
    cmp.className = 'sidebar-link';
    cmp.setAttribute('data-cmp', '');
    cmp.innerHTML = '<span class="dot"></span> ⚔️ Compare';
    cmp.addEventListener('click', () => openComparePicker());
    sidebarBottom.insertBefore(cmp, sidebarBottom.querySelector('[data-route="settings"]'));
  }

  renderLanding({ onCtaClick: startLockFlow });

  window.addEventListener('app:unlocked', () => {
    refreshApiStatus();
    setSettings({ hasSeenLanding: true });
    hideLanding();
    injectCostBadge();
    applyI18nAttributes();
    const initial = (location.hash || '').slice(1);
    if (ROUTES[initial] || initial === 'history' || initial === 'settings' || initial === 'home') {
      navigate(initial);
    } else {
      // Default = Quick Analysis (la killer feature)
      navigate('quick-analysis');
    }
    // Trigger onboarding tour si premier lancement
    if (!isTourCompleted()) {
      setTimeout(() => startTour(), 600);
    }
  });

  window.addEventListener('hashchange', () => {
    const r = location.hash.slice(1);
    if (r && r !== STATE.currentRoute) navigate(r);
  });

  // Changement de langue → re-render sans reload (compat Electron)
  window.addEventListener('app:locale-changed', () => {
    // Re-render la sidebar (labels + tooltips)
    renderSidebar(navigate);
    // Re-render les boutons sidebar bottom
    document.querySelectorAll('.sidebar-bottom .sidebar-link').forEach(b => {
      b.addEventListener('click', () => navigate(b.getAttribute('data-route')));
    });
    // Re-injecter le bouton lang/theme/cost (au cas où le label change)
    const right = document.querySelector('.topbar-right');
    if (right) {
      right.querySelectorAll('.lang-toggle').forEach(el => el.remove());
      const badge = document.getElementById('cost-badge');
      if (badge) right.insertBefore(makeLocaleToggle(), badge);
      // Re-set la tooltip du cost badge avec la nouvelle langue
      if (badge) {
        badge.title = t('topbar.cost.tooltip');
        const lbl = badge.querySelector('.cost-label');
        if (lbl) lbl.textContent = t('topbar.cost');
      }
    }
    // Re-render la vue active
    if (STATE.currentRoute) {
      const r = STATE.currentRoute;
      STATE.currentRoute = null; // force re-render
      navigate(r);
    } else {
      navigate('home');
    }
  });

  // Si une analyse partagée est dans l'URL → l'afficher direct
  tryLoadSharedFromHash().then(shared => {
    if (shared) {
      // Affiche dans une modale, pas besoin de vault
      import('./ui/modal.js').then(({ showGenericModal }) => {
        const html = safeRender(shared.output || '');
        showGenericModal(`🔗 ${shared.title || 'Analyse partagée'}`, `<div class="result"><div class="result-body">${html}</div></div>`, { wide: true });
      });
      return;
    }
    // Décide quoi afficher au boot
    const settings = getSettings();
    const seen = settings.hasSeenLanding;
    if (!seen && !hasVault()) {
      // Premier lancement → landing avec demo CTA
      showLanding();
      // Wire le bouton "Voir une analyse demo" si présent
      setTimeout(() => {
        document.querySelectorAll('[data-demo-trigger]').forEach(b => b.addEventListener('click', () => showDemoGallery()));
      }, 300);
    } else if (hasVault()) {
      // Vault existant → unlock direct
      startLockFlow();
    } else {
      // Pas de vault mais déjà vu landing → wizard direct
      openLockFlow();
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
