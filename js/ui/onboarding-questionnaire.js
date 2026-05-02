// Questionnaire d'onboarding bilingue FR/EN — modal multi-step (5 étapes).
// Sauve les réponses dans user-profile.js + déclenche le calcul de recommandations.
import { saveUserProfile, getUserProfile, markOnboardingSkipped } from '../core/user-profile.js';
import { getLocale } from '../core/i18n.js';
import { toast } from '../core/utils.js';

const STEPS = 6;

export function openOnboardingQuestionnaire({ onComplete = null, onSkip = null } = {}) {
  const isEN = getLocale() === 'en';
  const existing = getUserProfile() || {};
  let step = 1;
  const state = { ...existing };

  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10005;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `<div id="onb-modal" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:22px;max-width:680px;width:100%;max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:14px;"></div>`;
  document.body.appendChild(w);
  const modal = w.querySelector('#onb-modal');

  function close(isComplete = false) {
    try { document.body.removeChild(w); } catch {}
    if (!isComplete && onSkip) onSkip();
  }
  w.addEventListener('click', (e) => { if (e.target === w) close(); });

  function render() {
    const stepperHtml = `<div style="display:flex;gap:6px;margin-bottom:8px;">${Array.from({ length: STEPS }, (_, i) => `<div style="flex:1;height:4px;background:${i + 1 <= step ? 'var(--accent-green)' : 'var(--bg-tertiary)'};border-radius:2px;"></div>`).join('')}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${isEN ? 'Step' : 'Étape'} ${step} / ${STEPS}</div>`;

    let body = '';
    let title = '';
    if (step === 1) {
      title = isEN ? '👋 Tell us about you' : '👋 Parle-nous de toi';
      body = renderStep1(state, isEN);
    } else if (step === 2) {
      title = isEN ? '💰 Your financial situation' : '💰 Ta situation financière';
      body = renderStep2(state, isEN);
    } else if (step === 3) {
      title = isEN ? '🎯 Goals & needs' : '🎯 Objectifs & besoins';
      body = renderStep3(state, isEN);
    } else if (step === 4) {
      title = isEN ? '📊 Assets & investing style' : '📊 Actifs & style d\'investissement';
      body = renderStep4(state, isEN);
    } else if (step === 5) {
      title = isEN ? '⚙️ Experience & usage' : '⚙️ Expérience & usage';
      body = renderStep5(state, isEN);
    } else if (step === 6) {
      title = isEN ? '🚀 Quick start (optional)' : '🚀 Démarrage express (optionnel)';
      body = renderStep6(state, isEN);
    }

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
        <div style="flex:1;">
          ${stepperHtml}
          <h2 style="margin:0;font-size:18px;">${title}</h2>
        </div>
        <button id="onb-close" class="btn-ghost" aria-label="${isEN ? 'Close' : 'Fermer'}" style="font-size:18px;">×</button>
      </div>
      <div id="onb-body" style="display:flex;flex-direction:column;gap:12px;">${body}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;">
        <div>
          ${step > 1 ? `<button id="onb-back" class="btn-ghost">${isEN ? '← Back' : '← Retour'}</button>` : ''}
          <button id="onb-skip" class="btn-ghost" style="font-size:11.5px;color:var(--text-muted);">${isEN ? 'Skip questionnaire' : 'Passer le questionnaire'}</button>
        </div>
        <button id="onb-next" class="btn-primary">${step < STEPS ? (isEN ? 'Next →' : 'Suivant →') : (isEN ? '✓ Get my recommendations' : '✓ Voir mes recommandations')}</button>
      </div>
      <p style="font-size:10.5px;color:var(--text-muted);margin:0;text-align:center;">${isEN ? 'All answers stay 100% local on your device. They never leave the app.' : 'Toutes tes réponses restent 100% locales sur ton appareil. Elles ne quittent jamais l\'app.'}</p>
    `;

    bindCommons();
    bindStepFields(state, isEN, step);
  }

  function bindCommons() {
    modal.querySelector('#onb-close').addEventListener('click', () => close());
    modal.querySelector('#onb-back')?.addEventListener('click', () => { step--; render(); });
    modal.querySelector('#onb-skip').addEventListener('click', () => {
      if (confirm(isEN ? 'Skip the questionnaire? You can run it later from Settings.' : 'Passer le questionnaire ? Tu pourras le faire plus tard depuis Settings.')) {
        markOnboardingSkipped();
        close();
        if (onSkip) onSkip();
      }
    });
    modal.querySelector('#onb-next').addEventListener('click', async () => {
      // Validation step
      if (step === 1 && !state.country) { toast(isEN ? 'Please pick a country' : 'Choisis un pays', 'error'); return; }
      if (step === 6) {
        // Sauvegarde du profil + des holdings/watchlist saisis dans le quickstart
        saveUserProfile(state);
        await persistQuickStart(state);
        close(true);
        toast(isEN ? '🎉 Profile saved — you\'re all set!' : '🎉 Profil sauvegardé — tu es prêt !', 'success');
        if (onComplete) onComplete(state);
        return;
      }
      step++;
      render();
    });
  }

  render();
}

// === STEPS ===

function renderStep1(state, isEN) {
  return `
    <p style="font-size:13px;color:var(--text-secondary);margin:0;">${isEN ? 'A few quick questions to recommend the most relevant modules for you. Takes ~2 minutes.' : 'Quelques questions rapides pour te recommander les modules les plus utiles pour toi. ~2 minutes.'}</p>

    <div class="field-row">
      <div class="field"><label class="field-label">${isEN ? 'Age' : 'Âge'}</label><input id="onb-age" class="input" type="number" min="18" max="100" value="${state.age || ''}" placeholder="35" /></div>
      <div class="field"><label class="field-label">${isEN ? 'Country of residence' : 'Pays de résidence'} *</label>
        <select id="onb-country" class="input">
          <option value="">— ${isEN ? 'Pick' : 'Choisis'} —</option>
          <option value="fr" ${state.country === 'fr' ? 'selected' : ''}>🇫🇷 France</option>
          <option value="us" ${state.country === 'us' ? 'selected' : ''}>🇺🇸 United States</option>
          <option value="uk" ${state.country === 'uk' ? 'selected' : ''}>🇬🇧 United Kingdom</option>
          <option value="de" ${state.country === 'de' ? 'selected' : ''}>🇩🇪 Germany</option>
          <option value="ch" ${state.country === 'ch' ? 'selected' : ''}>🇨🇭 Switzerland</option>
          <option value="be" ${state.country === 'be' ? 'selected' : ''}>🇧🇪 Belgium</option>
          <option value="ca" ${state.country === 'ca' ? 'selected' : ''}>🇨🇦 Canada</option>
          <option value="other" ${state.country === 'other' ? 'selected' : ''}>${isEN ? 'Other' : 'Autre'}</option>
        </select>
      </div>
    </div>
    <div class="field"><label class="field-label">${isEN ? 'Family status' : 'Situation familiale'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        ${radio('familyStatus', 'single',       isEN ? '👤 Single'                    : '👤 Célibataire',                      state.familyStatus)}
        ${radio('familyStatus', 'couple',       isEN ? '👫 Couple, no kids'           : '👫 En couple, sans enfants',         state.familyStatus)}
        ${radio('familyStatus', 'family_kids',  isEN ? '👨‍👩‍👧 Family with kids'        : '👨‍👩‍👧 Famille avec enfants',        state.familyStatus)}
        ${radio('familyStatus', 'other',        isEN ? '· Other'                      : '· Autre',                             state.familyStatus)}
      </div>
    </div>
  `;
}

function renderStep2(state, isEN) {
  // Auto-derive bracket category from precise income for backward-compat with le routing
  return `
    <p style="font-size:12.5px;color:var(--text-muted);margin:0;">${isEN
      ? 'Precise figures — stored locally only, never sent. The whole app uses these to personalize tax/budget/cashflow analyses.'
      : 'Chiffres précis — stockés localement, jamais envoyés. Toute l\'app les utilise pour personnaliser les analyses fiscales, budget, cashflow.'}</p>

    <div class="field-row">
      <div class="field"><label class="field-label">${isEN ? 'Net monthly salary (€)' : 'Salaire mensuel net (€)'}</label>
        <input id="onb-salary" class="input" type="number" step="50" min="0" value="${state.salaryNet || ''}" placeholder="ex: 3500" />
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Other monthly recurring income (€)' : 'Autres revenus mensuels récurrents (€)'}</label>
        <input id="onb-other-income" class="input" type="number" step="10" min="0" value="${state.otherMonthlyIncome || ''}" placeholder="ex: 600 (loyers, dividendes…)" />
      </div>
    </div>

    <div class="field-row">
      <div class="field"><label class="field-label">${isEN ? 'Total monthly fixed charges (€)' : 'Charges fixes mensuelles totales (€)'}</label>
        <input id="onb-charges" class="input" type="number" step="10" min="0" value="${state.monthlyCharges || ''}" placeholder="ex: 1800 (loyer/prêt, énergie, assurances, abonnements…)" />
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Estimated variable spending (€/month)' : 'Dépenses variables estimées (€/mois)'}</label>
        <input id="onb-variable-spending" class="input" type="number" step="10" min="0" value="${state.variableSpending || ''}" placeholder="ex: 800 (courses, loisirs, transport)" />
      </div>
    </div>

    <div class="field"><label class="field-label">${isEN ? 'Total wealth (financial + real estate net of debt) (€)' : 'Patrimoine total (financier + immo net de dette) (€)'}</label>
      <input id="onb-wealth" class="input" type="number" step="1000" min="0" value="${state.totalWealth || ''}" placeholder="ex: 145000" />
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px;">${isEN ? 'Or skip — Patrimoine module computes this from your holdings.' : 'Ou laisse vide — le module Patrimoine calcule ce total depuis tes positions.'}</div>
    </div>

    <div id="onb-cashflow-preview" style="background:var(--bg-tertiary);padding:10px;border-radius:6px;font-size:12.5px;color:var(--text-secondary);"></div>

    <div class="field" id="onb-tmi-row" style="display:${(state.country || 'fr') === 'fr' ? 'block' : 'none'};">
      <label class="field-label">${isEN ? 'Marginal tax bracket (FR — TMI)' : 'Tranche marginale d\'imposition (TMI FR)'}</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${radio('tmiPct', '0',  '0%',  String(state.tmiPct))}
        ${radio('tmiPct', '11', '11%', String(state.tmiPct))}
        ${radio('tmiPct', '30', '30%', String(state.tmiPct))}
        ${radio('tmiPct', '41', '41%', String(state.tmiPct))}
        ${radio('tmiPct', '45', '45%', String(state.tmiPct))}
      </div>
    </div>
  `;
}

function renderStep3(state, isEN) {
  const goals = state.goals || [];
  const needs = state.needs || [];
  const goalOptions = [
    ['fire',           isEN ? '🔥 Reach FIRE / financial independence' : '🔥 Atteindre l\'indépendance financière (FIRE)'],
    ['retirement',     isEN ? '🏖️ Comfortable retirement'             : '🏖️ Préparer une retraite confortable'],
    ['house',          isEN ? '🏠 Buy a property'                       : '🏠 Acheter un bien immobilier'],
    ['education',      isEN ? '🎓 Fund children education'              : '🎓 Financer les études des enfants'],
    ['travel',         isEN ? '✈️ Travel / personal projects'           : '✈️ Voyager / projets personnels'],
    ['wealth_growth',  isEN ? '📈 Grow my wealth'                       : '📈 Faire croître mon patrimoine'],
    ['passive_income', isEN ? '💸 Build passive income'                 : '💸 Bâtir des revenus passifs'],
    ['tax_optim',      isEN ? '📊 Optimize my taxes'                    : '📊 Optimiser ma fiscalité']
  ];
  const needsOptions = [
    ['budget_tracking',     isEN ? '💰 Track my budget month by month' : '💰 Suivre mon budget mois par mois'],
    ['tax_savings',         isEN ? '📊 Save on taxes'                    : '📊 Économiser sur mes impôts'],
    ['diversification',     isEN ? '🎯 Diversify better'                 : '🎯 Mieux diversifier'],
    ['passive_income',      isEN ? '💸 Generate passive income'          : '💸 Générer des revenus passifs'],
    ['retirement_planning', isEN ? '🏖️ Plan retirement'                   : '🏖️ Planifier ma retraite'],
    ['wealth_growth',       isEN ? '📈 Grow my capital'                  : '📈 Faire fructifier mon capital'],
    ['first_purchase',      isEN ? '🏠 First real-estate purchase'       : '🏠 Premier achat immobilier']
  ];
  return `
    <p style="font-size:12.5px;color:var(--text-secondary);margin:0;">${isEN ? 'Pick all that apply.' : 'Coche tout ce qui s\'applique.'}</p>
    <div class="field"><label class="field-label">${isEN ? 'Long-term goals' : 'Objectifs long terme'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
        ${goalOptions.map(([k, label]) => check('goals', k, label, goals)).join('')}
      </div>
    </div>
    <div class="field"><label class="field-label">${isEN ? 'Most pressing needs (right now)' : 'Besoins les plus urgents (en ce moment)'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
        ${needsOptions.map(([k, label]) => check('needs', k, label, needs)).join('')}
      </div>
    </div>
    <div class="field"><label class="field-label">${isEN ? 'Investment horizon' : 'Horizon d\'investissement'}</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${radio('horizon', 'short',  isEN ? '< 3 years'    : '< 3 ans',     state.horizon)}
        ${radio('horizon', 'medium', isEN ? '3 – 10 years' : '3 – 10 ans',  state.horizon)}
        ${radio('horizon', 'long',   isEN ? '> 10 years'   : '> 10 ans',    state.horizon)}
      </div>
    </div>
  `;
}

function renderStep4(state, isEN) {
  const assets = state.assetTypes || [];
  const focus = state.analysisFocus || [];
  const assetOptions = [
    ['stocks',         isEN ? '📈 Individual stocks'      : '📈 Actions en direct'],
    ['etf',            isEN ? '📊 ETFs'                   : '📊 ETF'],
    ['crypto',         isEN ? '🪙 Crypto'                 : '🪙 Crypto'],
    ['real_estate',    isEN ? '🏠 Real estate'            : '🏠 Immobilier'],
    ['bonds',          isEN ? '📜 Bonds'                  : '📜 Obligations'],
    ['commodities',    isEN ? '🥇 Gold / commodities'     : '🥇 Or / matières premières'],
    ['life_insurance', isEN ? '🛡️ Life insurance (FR AV)' : '🛡️ Assurance-vie'],
    ['pea',            'PEA'],
    ['per',            'PER']
  ];
  const focusOptions = [
    ['fundamental',     isEN ? '🔬 Fundamental analysis'   : '🔬 Analyse fondamentale'],
    ['technical',       isEN ? '📉 Technical / charts'     : '📉 Technique / graphique'],
    ['macro',           isEN ? '🌍 Macro / context'        : '🌍 Macro / contexte'],
    ['tax',             isEN ? '📊 Tax optimization'       : '📊 Optimisation fiscale'],
    ['sentiment',       isEN ? '📰 Sentiment / news'       : '📰 Sentiment / actualités'],
    ['quick_decisions', isEN ? '⚡ Quick decisions'        : '⚡ Décisions rapides']
  ];
  return `
    <div class="field"><label class="field-label">${isEN ? 'Assets you currently own' : 'Actifs que tu possèdes'}</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
        ${assetOptions.map(([k, label]) => check('assetTypes', k, label, assets)).join('')}
      </div>
    </div>
    <div class="field"><label class="field-label">${isEN ? 'Analysis style you prefer' : 'Style d\'analyse préféré'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
        ${focusOptions.map(([k, label]) => check('analysisFocus', k, label, focus)).join('')}
      </div>
    </div>
    <div class="field"><label class="field-label">${isEN ? 'Risk tolerance' : 'Tolérance au risque'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        ${radio('riskProfile', 'conservative', isEN ? '🛡️ Conservative — capital preservation'  : '🛡️ Conservateur — préserver le capital',   state.riskProfile)}
        ${radio('riskProfile', 'balanced',     isEN ? '⚖️ Balanced — mixed risk'              : '⚖️ Équilibré — risque mesuré',           state.riskProfile)}
        ${radio('riskProfile', 'dynamic',      isEN ? '🚀 Dynamic — accept volatility'        : '🚀 Dynamique — accepter la volatilité',  state.riskProfile)}
        ${radio('riskProfile', 'aggressive',   isEN ? '🔥 Aggressive — high-conviction bets'  : '🔥 Agressif — paris à forte conviction', state.riskProfile)}
      </div>
    </div>
  `;
}

function renderStep6(state, isEN) {
  // Initialise les buffers si absents
  state._qsHoldings = Array.isArray(state._qsHoldings) ? state._qsHoldings : [
    { ticker: '', name: '', category: 'etf', quantity: '', unitPrice: '', currency: 'EUR' }
  ];
  state._qsWatchCrypto = state._qsWatchCrypto || 'bitcoin,ethereum,solana';
  state._qsWatchFx = state._qsWatchFx || 'USD,GBP,JPY,CHF';

  const catOptions = [
    ['stocks',      isEN ? '📈 Stock'         : '📈 Action'],
    ['etf',         '📊 ETF'],
    ['crypto',      isEN ? '🪙 Crypto'        : '🪙 Crypto'],
    ['cash',        isEN ? '💵 Cash'          : '💵 Cash'],
    ['bonds',       isEN ? '📜 Bond'          : '📜 Obligation'],
    ['retirement',  isEN ? '🏦 Retirement'    : '🏦 Retraite (PEA/PER…)'],
    ['real_estate', isEN ? '🏠 Real estate'   : '🏠 Immobilier'],
    ['commodities', isEN ? '🥇 Commodity'     : '🥇 Or / matières'],
    ['other',       isEN ? '· Other'          : '· Autre']
  ];

  const rowHtml = (h, idx) => `
    <div class="qs-row" data-idx="${idx}" style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 30px;gap:6px;align-items:center;margin-bottom:6px;">
      <input class="input qs-name" data-field="name" type="text" placeholder="${isEN ? 'Name (Apple, BTC, RP Lyon…)' : 'Nom (Apple, BTC, RP Lyon…)'}" value="${(h.name||'').replace(/"/g,'&quot;')}" style="font-size:12px;" />
      <select class="input qs-cat" data-field="category" style="font-size:12px;">
        ${catOptions.map(([id, lbl]) => `<option value="${id}" ${h.category===id?'selected':''}>${lbl}</option>`).join('')}
      </select>
      <input class="input qs-ticker" data-field="ticker" type="text" placeholder="AAPL, BTC, CW8.PA…" value="${(h.ticker||'').replace(/"/g,'&quot;')}" style="font-size:12px;text-transform:uppercase;" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <input class="input qs-qty" data-field="quantity" type="number" step="any" min="0" placeholder="${isEN ? 'Qty' : 'Qté'}" value="${h.quantity||''}" style="font-size:12px;" />
        <input class="input qs-price" data-field="unitPrice" type="number" step="0.01" min="0" placeholder="${isEN ? 'Unit €' : 'PU €'}" value="${h.unitPrice||''}" style="font-size:12px;" />
      </div>
      <button type="button" class="btn-ghost qs-del" data-idx="${idx}" title="${isEN ? 'Remove' : 'Retirer'}" aria-label="${isEN ? 'Remove' : 'Retirer'}" style="color:var(--accent-red);font-size:14px;">×</button>
    </div>
  `;

  return `
    <p style="font-size:12.5px;color:var(--text-secondary);margin:0;">
      ${isEN
        ? 'Add a few of your current positions and tickers you want to monitor — so you don\'t have to re-enter them later. <strong>All optional</strong>: skip if you prefer to add them in the Patrimoine module.'
        : 'Saisis quelques positions actuelles et tickers à surveiller — tu n\'auras pas à les ressaisir plus tard. <strong>Tout est optionnel</strong> : passe si tu préfères les ajouter depuis Patrimoine.'}
    </p>

    <div class="card" style="padding:12px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px;">💼 ${isEN ? 'Your first holdings' : 'Tes premières positions'}</div>
      <div id="qs-holdings-list">
        ${state._qsHoldings.map(rowHtml).join('')}
      </div>
      <button type="button" id="qs-add-holding" class="btn-secondary" style="font-size:12px;">+ ${isEN ? 'Add another' : 'Ajouter une autre'}</button>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:6px;">${isEN ? 'Saved to Patrimoine. Auto-refresh prices later if you add Twelve Data / FMP / Finnhub keys in Settings → Data keys.' : 'Sauvegardé dans Patrimoine. Refresh auto des prix plus tard si tu ajoutes une clé Twelve Data / FMP / Finnhub dans Settings → Data keys.'}</div>
    </div>

    <div class="card" style="padding:12px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px;">🌐 ${isEN ? 'Your daily Market Pulse' : 'Ton pulse marché quotidien'}</div>
      <div class="field">
        <label class="field-label">${isEN ? 'Crypto IDs to watch (CoinGecko, comma-separated)' : 'IDs crypto à surveiller (CoinGecko, séparés par virgules)'}</label>
        <input id="qs-watch-crypto" class="input" type="text" value="${state._qsWatchCrypto.replace(/"/g,'&quot;')}" placeholder="bitcoin,ethereum,solana,…" />
      </div>
      <div class="field">
        <label class="field-label">${isEN ? 'FX targets (vs EUR, ISO codes)' : 'Devises FX cibles (vs EUR, codes ISO)'}</label>
        <input id="qs-watch-fx" class="input" type="text" value="${state._qsWatchFx.replace(/"/g,'&quot;')}" placeholder="USD,GBP,JPY,CHF,…" />
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? 'Visible every morning in Daily Briefing and Market Pulse modules. Editable later via the ⚙️ button on each.' : 'Visible chaque matin dans les modules Daily Briefing et Market Pulse. Modifiable via le bouton ⚙️ sur chaque module.'}</div>
    </div>

    <div style="padding:10px;background:rgba(0,255,136,0.05);border-left:3px solid var(--accent-green);border-radius:4px;font-size:12px;color:var(--text-secondary);line-height:1.55;">
      ${isEN
        ? '<strong>What\'s next:</strong><br>1️⃣ Open <em>🌅 Daily Briefing</em> for your morning routine.<br>2️⃣ Click <em>⚡ Quick Analysis</em> for an instant verdict on any ticker.<br>3️⃣ Browse advanced modules in the sidebar — each has a <em>?</em> help icon.'
        : '<strong>La suite :</strong><br>1️⃣ Ouvre <em>🌅 Daily Briefing</em> pour ta routine matinale.<br>2️⃣ Clique <em>⚡ Quick Analysis</em> pour un verdict express sur n\'importe quel ticker.<br>3️⃣ Explore les modules avancés dans la sidebar — chacun a une icône <em>?</em> d\'aide.'}
    </div>
  `;
}

function renderStep5(state, isEN) {
  return `
    <div class="field"><label class="field-label">${isEN ? 'Investing experience' : 'Expérience en investissement'}</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${radio('experience', 'beginner',     isEN ? '🌱 Beginner'    : '🌱 Débutant',     state.experience)}
        ${radio('experience', 'intermediate', isEN ? '📚 Intermediate' : '📚 Intermédiaire', state.experience)}
        ${radio('experience', 'advanced',     isEN ? '🎯 Advanced'    : '🎯 Avancé',       state.experience)}
      </div>
    </div>
    <div class="field"><label class="field-label">${isEN ? 'Expected app usage frequency' : 'Fréquence d\'usage prévue'}</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${radio('usageFrequency', 'occasional', isEN ? '📅 Occasional (monthly)' : '📅 Occasionnel (mensuel)', state.usageFrequency)}
        ${radio('usageFrequency', 'weekly',     isEN ? '📆 Weekly'                : '📆 Hebdomadaire',          state.usageFrequency)}
        ${radio('usageFrequency', 'daily',      isEN ? '⏰ Daily'                 : '⏰ Quotidien',             state.usageFrequency)}
      </div>
    </div>
    <div style="padding:12px;background:var(--bg-tertiary);border-radius:6px;font-size:12.5px;color:var(--text-secondary);">
      ${isEN
        ? '✅ All set! Click "Get my recommendations" — the most relevant modules will be tagged with a ⭐ in the sidebar and listed on your home dashboard. You can re-run this questionnaire anytime from Settings.'
        : '✅ C\'est tout ! Clique "Voir mes recommandations" — les modules les plus pertinents seront marqués ⭐ dans la sidebar et listés sur ton home. Tu peux refaire ce questionnaire à tout moment depuis Settings.'}
    </div>
  `;
}

// === Helpers UI ===

function radio(name, value, label, current) {
  const checked = String(current) === String(value) ? 'checked' : '';
  return `
    <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:12.5px;background:${checked ? 'var(--bg-tertiary)' : 'transparent'};">
      <input type="radio" name="${name}" value="${value}" ${checked} />
      <span>${label}</span>
    </label>
  `;
}

function check(name, value, label, currentList) {
  const checked = (currentList || []).includes(value) ? 'checked' : '';
  return `
    <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:12.5px;background:${checked ? 'var(--bg-tertiary)' : 'transparent'};">
      <input type="checkbox" data-multi="${name}" value="${value}" ${checked} />
      <span>${label}</span>
    </label>
  `;
}

function bindStepFields(state, isEN, step) {
  const root = document.getElementById('onb-body');
  if (!root) return;

  // Toggle TMI row when country changes
  const cc = root.querySelector('#onb-country');
  if (cc) cc.addEventListener('change', () => {
    state.country = cc.value;
    const row = document.getElementById('onb-tmi-row');
    if (row) row.style.display = cc.value === 'fr' ? 'block' : 'none';
  });

  // Inputs spécifiques step 1
  if (step === 1) {
    root.querySelector('#onb-age')?.addEventListener('input', (e) => { state.age = parseInt(e.target.value, 10) || null; });
  }

  // Inputs spécifiques step 6 (quick start : holdings + watchlist)
  if (step === 6) {
    const list = root.querySelector('#qs-holdings-list');
    const wireRow = (rowEl) => {
      const idx = +rowEl.dataset.idx;
      rowEl.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => {
          const f = el.getAttribute('data-field');
          let v = el.value;
          if (f === 'quantity' || f === 'unitPrice') v = parseFloat(v) || '';
          if (f === 'ticker') v = String(v || '').toUpperCase();
          state._qsHoldings[idx][f] = v;
        });
        el.addEventListener('change', () => {
          const f = el.getAttribute('data-field');
          state._qsHoldings[idx][f] = el.value;
        });
      });
      rowEl.querySelector('.qs-del')?.addEventListener('click', () => {
        state._qsHoldings.splice(idx, 1);
        if (state._qsHoldings.length === 0) {
          state._qsHoldings.push({ ticker: '', name: '', category: 'etf', quantity: '', unitPrice: '', currency: 'EUR' });
        }
        render();
      });
    };
    list.querySelectorAll('.qs-row').forEach(wireRow);

    root.querySelector('#qs-add-holding')?.addEventListener('click', () => {
      state._qsHoldings.push({ ticker: '', name: '', category: 'etf', quantity: '', unitPrice: '', currency: 'EUR' });
      render();
    });

    root.querySelector('#qs-watch-crypto')?.addEventListener('input', e => { state._qsWatchCrypto = e.target.value; });
    root.querySelector('#qs-watch-fx')?.addEventListener('input', e => { state._qsWatchFx = e.target.value; });
  }

  // Inputs spécifiques step 2 (situation financière précise)
  if (step === 2) {
    const refreshCashflow = () => {
      const inc = (Number(state.salaryNet) || 0) + (Number(state.otherMonthlyIncome) || 0);
      const out = (Number(state.monthlyCharges) || 0) + (Number(state.variableSpending) || 0);
      const cf = inc - out;
      const el = root.querySelector('#onb-cashflow-preview');
      if (!el) return;
      if (!inc && !out) { el.innerHTML = ''; return; }
      const color = cf >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
      const sign = cf >= 0 ? '+' : '';
      el.innerHTML = `${isEN ? 'Estimated monthly cashflow' : 'Cashflow mensuel estimé'} : <strong style="color:${color};">${sign}${Math.round(cf).toLocaleString('fr-FR')} €</strong> · ${isEN ? 'savings rate' : 'taux d\'épargne'} : <strong>${inc > 0 ? Math.round((cf / inc) * 100) : 0}%</strong>`;
    };
    const bind = (id, field, parse = parseFloat) => {
      const el = root.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('input', (e) => {
        state[field] = parse(e.target.value) || 0;
        refreshCashflow();
      });
    };
    bind('onb-salary',             'salaryNet');
    bind('onb-other-income',       'otherMonthlyIncome');
    bind('onb-charges',            'monthlyCharges');
    bind('onb-variable-spending',  'variableSpending');
    bind('onb-wealth',             'totalWealth');
    refreshCashflow();
  }

  // Radio (single)
  root.querySelectorAll('input[type="radio"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) {
        const name = r.name;
        // tmiPct est numérique
        state[name] = name === 'tmiPct' ? Number(r.value) : r.value;
        // visual selection
        root.querySelectorAll(`input[name="${name}"]`).forEach(o => {
          const lbl = o.closest('label');
          if (lbl) lbl.style.background = o.checked ? 'var(--bg-tertiary)' : 'transparent';
        });
      }
    });
  });

  // Checkbox (multi)
  root.querySelectorAll('input[type="checkbox"][data-multi]').forEach(c => {
    c.addEventListener('change', () => {
      const name = c.dataset.multi;
      const arr = Array.isArray(state[name]) ? state[name].slice() : [];
      const idx = arr.indexOf(c.value);
      if (c.checked && idx < 0) arr.push(c.value);
      if (!c.checked && idx >= 0) arr.splice(idx, 1);
      state[name] = arr;
      const lbl = c.closest('label');
      if (lbl) lbl.style.background = c.checked ? 'var(--bg-tertiary)' : 'transparent';
    });
  });
}

// Persiste les données du Quick Start (étape 6) :
//   - holdings → IndexedDB store wealth via saveHolding()
//   - pulse watchlist → localStorage (lue par daily-briefing.js + market-pulse.js)
// Idempotent : on ne crée pas de doublons si l'utilisateur revient et re-soumet.
async function persistQuickStart(state) {
  // 1. Watchlist Pulse — sauvegarde directe en localStorage si renseigné
  try {
    const { setPulseWatchlist } = await import('../modules/daily-briefing.js');
    const crypto = String(state._qsWatchCrypto || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const fx = String(state._qsWatchFx || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (crypto.length || fx.length) {
      setPulseWatchlist({
        crypto: crypto.length ? crypto : ['bitcoin', 'ethereum', 'solana'],
        fx:     fx.length     ? fx     : ['USD', 'GBP', 'JPY', 'CHF']
      });
    }
  } catch (e) { console.warn('[onboarding] pulse watchlist persist skipped:', e); }

  // 2. Holdings — saveHolding() pour chaque ligne avec un nom OU ticker valide
  try {
    const { saveHolding } = await import('../core/wealth.js');
    const { uuid } = await import('../core/utils.js');
    const rows = Array.isArray(state._qsHoldings) ? state._qsHoldings : [];
    for (const h of rows) {
      const name = String(h.name || '').trim();
      const ticker = String(h.ticker || '').trim().toUpperCase();
      if (!name && !ticker) continue;
      const qty = Number(h.quantity) || 0;
      const unit = Number(h.unitPrice) || 0;
      await saveHolding({
        id: uuid(),
        name: name || ticker,
        ticker: ticker || null,
        category: h.category || 'other',
        quantity: qty,
        unitPrice: unit,
        value: +(qty * unit).toFixed(2),
        currency: h.currency || 'EUR',
        autoValue: !!ticker, // refresh auto si on a un ticker
        notes: 'Saisi pendant l\'onboarding',
        createdAt: new Date().toISOString()
      });
    }
  } catch (e) { console.warn('[onboarding] holdings persist failed:', e); }
}
