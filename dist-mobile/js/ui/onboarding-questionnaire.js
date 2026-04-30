// Questionnaire d'onboarding bilingue FR/EN — modal multi-step (5 étapes).
// Sauve les réponses dans user-profile.js + déclenche le calcul de recommandations.
import { saveUserProfile, getUserProfile, markOnboardingSkipped } from '../core/user-profile.js';
import { getLocale } from '../core/i18n.js';
import { toast } from '../core/utils.js';

const STEPS = 5;

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
    }

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
        <div style="flex:1;">
          ${stepperHtml}
          <h2 style="margin:0;font-size:18px;">${title}</h2>
        </div>
        <button id="onb-close" class="btn-ghost" style="font-size:18px;">×</button>
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
    modal.querySelector('#onb-next').addEventListener('click', () => {
      // Validation step
      if (step === 1 && !state.country) { toast(isEN ? 'Please pick a country' : 'Choisis un pays', 'error'); return; }
      if (step === 5) {
        // Save + complete
        saveUserProfile(state);
        close(true);
        toast(isEN ? '🎉 Profile saved — recommendations ready!' : '🎉 Profil sauvegardé — recommandations prêtes !', 'success');
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
  return `
    <p style="font-size:12.5px;color:var(--text-muted);margin:0;">${isEN ? 'Approximate ranges — used to tailor suggestions, not stored exactly.' : 'Fourchettes approximatives — pour adapter les suggestions, pas stockées précisément.'}</p>

    <div class="field"><label class="field-label">${isEN ? 'Net monthly income' : 'Revenu mensuel net'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        ${radio('monthlyIncome', 'low',       isEN ? '< €2,000'           : '< 2 000 €',           state.monthlyIncome)}
        ${radio('monthlyIncome', 'medium',    isEN ? '€2,000 – €5,000'    : '2 000 – 5 000 €',     state.monthlyIncome)}
        ${radio('monthlyIncome', 'high',      isEN ? '€5,000 – €10,000'   : '5 000 – 10 000 €',    state.monthlyIncome)}
        ${radio('monthlyIncome', 'very_high', isEN ? '> €10,000'          : '> 10 000 €',          state.monthlyIncome)}
      </div>
    </div>

    <div class="field"><label class="field-label">${isEN ? 'Total wealth (financial + real estate net)' : 'Patrimoine total (financier + immo net)'}</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        ${radio('wealthLevel', 'starting',         isEN ? '< €50K (starting out)'        : '< 50 K€ (en construction)',         state.wealthLevel)}
        ${radio('wealthLevel', 'building',         isEN ? '€50K – €200K (building)'      : '50 K€ – 200 K€ (en accumulation)', state.wealthLevel)}
        ${radio('wealthLevel', 'established',      isEN ? '€200K – €500K (established)'  : '200 K€ – 500 K€ (établi)',         state.wealthLevel)}
        ${radio('wealthLevel', 'high_net_worth',   isEN ? '> €500K (high net worth)'     : '> 500 K€ (patrimoine élevé)',      state.wealthLevel)}
      </div>
    </div>

    <div class="field" id="onb-tmi-row" style="display:${(state.country || 'fr') === 'fr' ? 'block' : 'none'};">
      <label class="field-label">${isEN ? 'Marginal tax bracket (FR — TMI)' : 'Tranche marginale d\'imposition (TMI FR)'}</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${radio('tmiPct', '0',  '0%',  String(state.tmiPct))}
        ${radio('tmiPct', '11', '11%', String(state.tmiPct))}
        ${radio('tmiPct', '30', '30%', String(state.tmiPct))}
        ${radio('tmiPct', '41', '41%', String(state.tmiPct))}
        ${radio('tmiPct', '45', '45%', String(state.tmiPct))}
        ${radio('tmiPct', '0',  isEN ? '?' : '?', String(state.tmiPct))}
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
