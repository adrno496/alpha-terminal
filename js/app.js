// Entry point — bootstrap, router, landing/setup flow, home, cmdk, tooltips
import { $, fmtUSD, fmtRelative, escHtml } from './core/utils.js';
import { isConnected, onConnectionChange, abortCurrentCall } from './core/api.js';
import { hasVault, markActivity } from './core/crypto.js';
import { listAnalyses, getSettings, setSettings, onDbAvailabilityChange } from './core/storage.js';
import { getCost, onCostChange } from './core/cost-tracker.js';

import { renderSidebar, setActiveSidebar, getModuleById } from './ui/sidebar.js';
import { openLockFlow } from './ui/modal.js';
import { renderHistoryView } from './ui/history.js';
import { renderSettingsView } from './ui/settings.js';
import { initCmdK } from './ui/cmdk.js';
import { initTooltips } from './ui/tooltips.js';
import { renderLanding, showLanding, hideLanding } from './ui/landing.js';
import './ui/trust-details.js'; // global click handler for trust-badges
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
import { makeLocaleToggle, t, applyI18nAttributes, getLocale } from './core/i18n.js';
import { isTourCompleted, startTour } from './ui/tour.js';
import { initKeyboard } from './ui/keyboard.js';
import { tryLoadSharedFromHash } from './ui/sharing.js';
import { showDemoGallery } from './ui/demo-mode.js';
import { openComparePicker } from './ui/compare.js';

// V7 — Finances perso
import { renderBudgetView }                from './modules/budget.js';
import { renderFeesAnalysisView }          from './modules/fees-analysis.js';
import { renderDividendsTrackerView }      from './modules/dividends-tracker.js';
import { renderDiversificationScoreView }  from './modules/diversification-score.js';
import { renderWealthMethodView }          from './modules/wealth-method.js';
import { renderCsvImportView }             from './modules/csv-import.js';
import { renderInsightsEngineView }        from './modules/insights-engine.js';
import { renderPriceAlertsView }           from './modules/price-alerts.js';
import { bootAlertCheck, updateAlertBadge } from './ui/alerts-banner.js';

// V9 — IFI / Goals / Live / Accounts / Projection
import { renderIfiSimulatorView }   from './modules/ifi-simulator.js';
import { renderGoalsView }          from './modules/goals.js';
import { renderLiveWatcherView }    from './modules/live-watcher.js';
import { renderAccountsViewView }   from './modules/accounts-view.js';
import { renderProjectionView }     from './modules/projection.js';

// V10 — Tax-Loss Harvesting / Subscriptions / Envelope Optimizer
import { renderTaxLossHarvestingView }      from './modules/tax-loss-harvesting.js';
import { renderSubscriptionsDetectorView }  from './modules/subscriptions-detector.js';
import { renderEnvelopeOptimizerView }      from './modules/envelope-optimizer.js';

// V11 — Donations & Succession / Capital Gains / Backtest
import { renderDonationsSuccessionView }    from './modules/donations-succession.js';
import { renderCapitalGainsTrackerView }    from './modules/capital-gains-tracker.js';
import { renderBacktestView }               from './modules/backtest.js';

// V12 — Multi-currency P&L / Earnings Calendar / Correlation / ESG / Estate / Macro / Attribution
import { renderMultiCurrencyPnlView }       from './modules/multi-currency-pnl.js';
import { renderEarningsCalendarView }       from './modules/earnings-calendar.js';
import { renderCorrelationMatrixView }      from './modules/correlation-matrix.js';
import { renderEsgImpactView }              from './modules/esg-impact.js';
import { renderEstateDocGeneratorView }     from './modules/estate-doc-generator.js';
import { renderMacroEventsCalendarView }    from './modules/macro-events-calendar.js';
import { renderPerformanceAttributionView } from './modules/performance-attribution.js';

// V13 — Analyse géopolitique
import { renderGeopoliticalAnalysisView }   from './modules/geopolitical-analysis.js';

// V14 — Daily brief category
import { renderDailyBriefingView }     from './modules/daily-briefing.js';
import { renderMarketPulseView }       from './modules/market-pulse.js';
import { renderTodaysActionsView }     from './modules/todays-actions.js';
import { renderSmartAlertsCenterView } from './modules/smart-alerts-center.js';
import { renderFearGreedView }         from './modules/fear-greed.js';
import { renderWatchpointsView }       from './modules/watchpoints.js';

// V15 — News + Geo + Risk Dashboard
import { renderNewsFeedView }          from './modules/news-feed.js';
import { renderGeoRiskView }           from './modules/geo-risk.js';
import { renderRiskDashboardView }     from './modules/risk-dashboard.js';

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
  // V7 — Finances perso
  'budget':                { render: renderBudgetView,               label: '💰 Budget' },
  'fees-analysis':         { render: renderFeesAnalysisView,         label: '🔥 Frais cachés' },
  'dividends-tracker':     { render: renderDividendsTrackerView,     label: '💸 Dividendes' },
  'diversification-score': { render: renderDiversificationScoreView, label: '🎯 Score Diversification' },
  'wealth-method':         { render: renderWealthMethodView,         label: '📚 Méthode patrimoniale' },
  'csv-import':            { render: renderCsvImportView,            label: '📥 Import CSV' },
  'insights-engine':       { render: renderInsightsEngineView,       label: '✨ Insights' },
  'price-alerts':          { render: renderPriceAlertsView,          label: '🚨 Alertes prix' },
  // V9
  'ifi-simulator':         { render: renderIfiSimulatorView,         label: '🇫🇷 Simulateur IFI' },
  'goals':                 { render: renderGoalsView,                label: '🎯 Objectifs financiers' },
  'live-watcher':          { render: renderLiveWatcherView,          label: '📈 Live Watcher' },
  'accounts-view':         { render: renderAccountsViewView,         label: '🏦 Vue par compte' },
  'projection':            { render: renderProjectionView,           label: '📊 Projection patrimoine' },
  // V10
  'tax-loss-harvesting':   { render: renderTaxLossHarvestingView,    label: '🧮 Tax-Loss Harvesting' },
  'subscriptions-detector':{ render: renderSubscriptionsDetectorView, label: '🔍 Détecteur abonnements' },
  'envelope-optimizer':    { render: renderEnvelopeOptimizerView,    label: '🇫🇷 Optimiseur enveloppe fiscale' },
  // V11
  'donations-succession':  { render: renderDonationsSuccessionView,  label: '🎁 Donations & Succession FR' },
  'capital-gains-tracker': { render: renderCapitalGainsTrackerView,  label: '🧾 Capital Gains (FIFO/CMP)' },
  'backtest':              { render: renderBacktestView,             label: '🔁 Backtest' },
  // V12
  'multi-currency-pnl':    { render: renderMultiCurrencyPnlView,     label: '💱 Multi-currency P&L' },
  'earnings-calendar':     { render: renderEarningsCalendarView,     label: '📅 Earnings Calendar' },
  'correlation-matrix':    { render: renderCorrelationMatrixView,    label: '🌡️ Correlation Matrix' },
  'esg-impact':            { render: renderEsgImpactView,            label: '🌍 ESG Impact' },
  'estate-doc-generator':  { render: renderEstateDocGeneratorView,   label: '📜 Estate Documents FR' },
  'macro-events-calendar': { render: renderMacroEventsCalendarView,  label: '🏛️ Macro Events' },
  'performance-attribution':{ render: renderPerformanceAttributionView, label: '📈 Performance Attribution' },
  // V13
  'geopolitical-analysis': { render: renderGeopoliticalAnalysisView,   label: '🌍 Analyse géopolitique' },
  // V14 — Daily brief
  'daily-briefing':        { render: renderDailyBriefingView,          label: '🌅 Daily Briefing' },
  'market-pulse':          { render: renderMarketPulseView,            label: '🌐 Market Pulse' },
  'todays-actions':        { render: renderTodaysActionsView,          label: '🎯 Today’s Actions' },
  'smart-alerts-center':   { render: renderSmartAlertsCenterView,      label: '🔔 Smart Alerts Center' },
  'fear-greed':            { render: renderFearGreedView,              label: '🌡️ Fear & Greed' },
  'watchpoints':           { render: renderWatchpointsView,            label: '📌 Mes points de surveillance' },
  // V15 — News + Geo + Risk Dashboard (data-driven, pas LLM)
  'news-feed':             { render: renderNewsFeedView,                label: '📰 News' },
  'geo-risk':              { render: renderGeoRiskView,                 label: '🌍 Risque géopolitique' },
  'risk-dashboard':        { render: renderRiskDashboardView,           label: '📊 Risk Dashboard' },
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
  // Notifie tous les modules qu'on quitte la route actuelle. Permet le cleanup
  // d'event listeners document/window, intervals, observers, etc.
  // Usage côté module : `window.addEventListener('app:route-leaving', () => clearInterval(myTimer), { once: true });`
  try {
    window.dispatchEvent(new CustomEvent('app:route-leaving', { detail: { from: STATE.currentRoute, to: route } }));
  } catch {}
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
  titleEl.textContent = 'Alpha';
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

  // V10 — Carte "Recommandés pour toi" basée sur profil utilisateur
  let recoCard = '';
  try {
    const { getUserProfile, isOnboardingCompleted } = await import('./core/user-profile.js');
    const profile = getUserProfile();
    if (profile && isOnboardingCompleted()) {
      const { topRecommendedIds } = await import('./core/module-recommendations.js');
      const top = topRecommendedIds(profile, 6);
      const isEN = getLocale() === 'en';
      const labelOf = (id) => t(`mod.${id}.label`) || id;
      const descOf = (id) => t(`mod.${id}.desc`) || '';
      const { isModuleMissingApiKey } = await import('./core/module-providers.js');
      recoCard = `
        <div class="card" style="border-left:4px solid #ffd700;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div class="card-title" style="margin:0;">⭐ ${isEN ? 'Recommended for you' : 'Recommandés pour toi'}</div>
            <button id="reco-redo" class="btn-ghost" style="font-size:11px;color:var(--text-muted);">↻ ${isEN ? 'Redo questionnaire' : 'Refaire le questionnaire'}</button>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin:4px 0 12px;">${isEN ? 'Based on your profile (' + (profile.experience || 'intermediate') + ' · ' + (profile.country || 'fr') + ')' : 'Selon ton profil (' + (profile.experience || 'intermédiaire') + ' · ' + (profile.country || 'fr') + ')'}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
            ${top.map(id => {
              const needsKey = isModuleMissingApiKey(id);
              return `
              <div data-route="${id}" style="cursor:pointer;padding:12px;background:var(--bg-tertiary);border-radius:6px;border-left:3px solid ${needsKey ? 'var(--accent-red)' : '#ffd700'};position:relative;">
                ${needsKey ? `<span style="position:absolute;top:6px;right:8px;color:var(--accent-red);font-weight:700;" title="${t('reco.missing_key_tooltip')}">!</span>` : ''}
                <div style="font-size:13px;font-weight:600;margin-bottom:3px;">${labelOf(id)}</div>
                <div style="font-size:11px;color:var(--text-muted);line-height:1.4;">${descOf(id).slice(0, 100)}</div>
              </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (!profile) {
      // Pas de profil → invitation à faire le questionnaire
      const isEN = getLocale() === 'en';
      recoCard = `
        <div class="card" style="border-left:4px solid #ffd700;text-align:center;padding:18px;">
          <div style="font-size:28px;margin-bottom:6px;">⭐</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;">${isEN ? 'Get personalized recommendations' : 'Obtiens des recommandations personnalisées'}</div>
          <p style="font-size:12px;color:var(--text-secondary);margin:0 0 10px;">${isEN ? '~2 min questionnaire to highlight the most relevant modules for your profile.' : '~2 min de questionnaire pour identifier les modules les plus utiles pour ton profil.'}</p>
          <button id="reco-start" class="btn-primary" style="font-size:12.5px;">🎯 ${isEN ? 'Start questionnaire' : 'Démarrer le questionnaire'}</button>
        </div>
      `;
    }
  } catch (e) { console.warn('Reco card failed:', e); }

  // V8 — Bannière alertes prix triggered (en haut, voyant rouge clignotant)
  let alertBanner = '';
  try {
    const { buildHomeAlertBanner } = await import('./ui/alerts-banner.js');
    alertBanner = await buildHomeAlertBanner();
  } catch (e) { console.warn('Alert banner failed:', e); }

  // V7 — Finances perso : score + insights + dividends/fees glance
  let financesPersoCards = '';
  try {
    const { listWealth } = await import('./core/wealth.js');
    const { computeDiversificationScore } = await import('./modules/diversification-score.js');
    const { runInsightsEngine } = await import('./modules/insights-engine.js');
    const holdings = await listWealth().catch(() => []);
    if (holdings.length > 0) {
      const score = computeDiversificationScore(holdings);
      const insights = await runInsightsEngine();
      const top3 = (insights || []).slice(0, 3);
      const totalValue = holdings.reduce((s, h) => s + (Number(h.value) || 0), 0);
      const colorMap = { high: 'var(--accent-red)', medium: 'var(--accent-orange)', low: 'var(--text-muted)' };
      const ip = (p) => p === 'alert' ? 'var(--accent-red)' : p === 'warning' ? 'var(--accent-orange)' : p === 'celebration' ? 'var(--accent-green)' : 'var(--accent-blue)';
      financesPersoCards = `
        <div class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          <div data-route="diversification-score" style="cursor:pointer;padding:14px;background:var(--bg-tertiary);border-radius:6px;text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">🎯 ${t('mod.diversification-score.label')}</div>
            <div style="font-size:36px;font-weight:700;font-family:var(--font-mono);color:${score.total < 50 ? 'var(--accent-orange)' : score.total < 70 ? 'var(--accent-green)' : 'var(--accent-green)'};">${score.total}</div>
            <div style="font-size:10px;color:var(--text-muted);">/ 100 — ${score.total < 50 ? '⚠️ à améliorer' : score.total < 70 ? '👍 correct' : '🏆 excellent'}</div>
          </div>
          <div data-route="insights-engine" style="cursor:pointer;padding:14px;background:var(--bg-tertiary);border-radius:6px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">✨ ${t('mod.insights-engine.label')} (${(insights || []).length})</div>
            ${top3.length ? top3.map(i => `<div style="font-size:11.5px;line-height:1.4;margin-bottom:4px;border-left:3px solid ${ip(i.priority)};padding-left:6px;">${(i.message || '').slice(0, 110)}${(i.message || '').length > 110 ? '…' : ''}</div>`).join('') : '<div style="font-size:11px;color:var(--text-muted);">Aucun insight détecté.</div>'}
          </div>
          <div data-route="fees-analysis" style="cursor:pointer;padding:14px;background:var(--bg-tertiary);border-radius:6px;text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">🔥 ${t('mod.fees-analysis.label')}</div>
            <div style="font-size:18px;font-weight:600;font-family:var(--font-mono);">${totalValue ? fmtUSD(totalValue).replace('$', '€') : '—'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">→ Calculer l'impact des frais sur 30 ans</div>
          </div>
        </div>
      `;
    }
  } catch (e) { console.warn('Finances perso cards failed:', e); }

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

    ${alertBanner}

    ${recoCard}

    ${financesPersoCards}

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

  // Boutons questionnaire (start / redo)
  const recoBtnStart = viewEl.querySelector('#reco-start');
  const recoBtnRedo  = viewEl.querySelector('#reco-redo');
  const openOnb = async () => {
    const { openOnboardingQuestionnaire } = await import('./ui/onboarding-questionnaire.js');
    openOnboardingQuestionnaire({ onComplete: () => { renderSidebar(navigate); navigate('home'); } });
  };
  if (recoBtnStart) recoBtnStart.addEventListener('click', openOnb);
  if (recoBtnRedo) recoBtnRedo.addEventListener('click', openOnb);
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

  // === Price alerts : boot check (1h throttle) + badge sidebar ===
  // Lance en background : ne bloque pas le boot. Fire l'event si nouvelles alertes triggered.
  bootAlertCheck().then(() => updateAlertBadge()).catch(() => {});

  // === Auto-backup local : snapshot 24h dans une DB séparée, conserve les 7 dernières ===
  // Best-effort : ne bloque pas le boot et silencieux en cas d'échec (DB indispo, etc.)
  setTimeout(() => {
    import('./core/auto-backup.js')
      .then(m => m.maybeRunAutoBackup())
      .catch(() => {});
  }, 5000); // léger delay pour ne pas concurrencer le boot critique
  window.addEventListener('app:alerts-updated', () => updateAlertBadge());

  // In-app footer legal links
  document.querySelectorAll('[data-app-legal]').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const which = a.getAttribute('data-app-legal');
      const { showLegalPage } = await import('./ui/legal-pages.js');
      showLegalPage(which);
    });
  });

  onConnectionChange(() => {
    refreshApiStatus();
    // Re-render la sidebar pour mettre à jour les badges ⚠️ (clés manquantes)
    try { renderSidebar(navigate); } catch {}
  });

  // Paywall : re-render la sidebar quand le statut premium change
  // (active/désactive les badges 🔒 sur les modules pro)
  if (typeof window !== 'undefined') {
    window.addEventListener('alpha:premiumChanged', () => {
      try { renderSidebar(navigate); } catch {}
    });
  }
  onCostChange(refreshCostBadge);
  refreshApiStatus();

  // Bannière informative si le stockage local échoue. On ne diagnostique PAS la cause
  // (mode privé / quota / corruption) : on probe vraiment et on présente les faits.
  onDbAvailabilityChange(async (available) => {
    let banner = document.getElementById('db-unavailable-banner');
    if (available) {
      if (banner) banner.remove();
      return;
    }
    if (banner) return;
    // Probe explicite avant d'afficher quoi que ce soit (évite les faux positifs)
    const { probeStorage } = await import('./core/storage.js');
    const probe = await probeStorage();
    // Si en réalité ça marche (faux positif), n'affiche rien
    if (probe.indexedDB || probe.localStorage) return;
    banner = document.createElement('div');
    banner.id = 'db-unavailable-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;padding:10px 16px;background:#b8860b;color:#fff;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    const msg = probe.isLikelyPrivate
      ? '⚠️ <strong>Stockage local désactivé</strong> — Tes analyses ne seront pas conservées entre sessions sur cet appareil.'
      : '⚠️ <strong>Stockage local indisponible</strong> — Tes analyses ne seront pas conservées. Essaie de recharger la page.';
    banner.innerHTML = `${msg} <button style="margin-left:8px;background:transparent;border:1px solid #fff;color:#fff;padding:2px 8px;cursor:pointer;border-radius:3px;" aria-label="Fermer">Fermer</button>`;
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

  // Si browse-mode est activé (refresh ou back avec mode actif), on dispatch direct
  if (localStorage.getItem('alpha-terminal:browse-mode') === '1' && !isConnected()) {
    setTimeout(() => window.dispatchEvent(new CustomEvent('app:browse-mode-enabled')), 100);
  }

  window.addEventListener('app:unlocked', async () => {
    refreshApiStatus();
    setSettings({ hasSeenLanding: true });
    hideLanding();
    injectCostBadge();
    applyI18nAttributes();
    // Clear browse-mode si l'utilisateur a fini par configurer son vault
    localStorage.removeItem('alpha-terminal:browse-mode');
    // Mount du chatbot widget (bouton flottant disponible sur toutes les pages)
    try {
      const { mountChatbotWidget } = await import('./ui/chatbot-widget.js');
      mountChatbotWidget();
    } catch (e) { console.warn('Chatbot widget mount failed:', e); }
    const initial = (location.hash || '').slice(1);
    if (ROUTES[initial] || initial === 'history' || initial === 'settings' || initial === 'home') {
      navigate(initial);
    } else {
      navigate('quick-analysis');
    }

    // Onboarding questionnaire : déclenche si pas encore fait (et pas skipped)
    try {
      const { isOnboardingCompleted } = await import('./core/user-profile.js');
      if (!isOnboardingCompleted()) {
        setTimeout(async () => {
          const { openOnboardingQuestionnaire } = await import('./ui/onboarding-questionnaire.js');
          openOnboardingQuestionnaire({
            onComplete: () => { renderSidebar(navigate); navigate('home'); },
            onSkip: () => { /* ne rien faire */ }
          });
        }, 800);
      }
    } catch {}

    // Tour onboarding (si jamais fait)
    if (!isTourCompleted()) {
      setTimeout(() => startTour(), 600);
    }
  });

  // Browse mode : l'utilisateur a cliqué "Browse first" sur le wizard.
  // On masque la modale + on affiche l'app avec sidebar mais isConnected() = false.
  // L'access aux modules est libre, mais runAnalysis() redirigera vers le lock flow.
  window.addEventListener('app:browse-mode-enabled', async () => {
    hideLanding();
    applyI18nAttributes();
    // Mount chatbot aussi en browse mode (le widget gère le cas "pas de clé")
    try {
      const { mountChatbotWidget } = await import('./ui/chatbot-widget.js');
      mountChatbotWidget();
    } catch {}
    // Pas de pill "browse mode" — l'utilisateur peut maintenant utiliser les 4 modules
    // toujours-visibles avec une clé gratuite, donc pas besoin d'un indicateur permanent.
    // Si jamais on en a besoin plus tard, retirer ce nettoyage et restaurer le pill.
    const oldPill = document.getElementById('browse-mode-pill');
    if (oldPill) oldPill.remove();
    navigate('home');
  });

  window.addEventListener('hashchange', () => {
    const r = location.hash.slice(1);
    if (r && r !== STATE.currentRoute) navigate(r);
  });

  // Changement de langue → re-render sans reload (compat Electron)
  window.addEventListener('app:locale-changed', () => {
    // Si la landing est visible (utilisateur non connecté) → re-render la landing
    // sans déclencher le lock flow.
    const landingEl = document.getElementById('landing');
    const landingVisible = landingEl && !landingEl.classList.contains('hidden');
    if (landingVisible) {
      renderLanding({ onCtaClick: startLockFlow });
      return;
    }

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
    } else if (isConnected()) {
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

// Activity tracker — rafraîchit le timestamp d'inactivité (throttle 30s) tant que l'user
// interagit. Si l'app reste inactive > 1h, le prochain openLockFlow() re-promptera la passphrase.
let _lastMark = 0;
function pingActivity() {
  const now = Date.now();
  if (now - _lastMark < 30000) return; // throttle 30s
  _lastMark = now;
  markActivity();
}
['click', 'keydown', 'visibilitychange'].forEach(ev => {
  window.addEventListener(ev, pingActivity, { passive: true });
});
