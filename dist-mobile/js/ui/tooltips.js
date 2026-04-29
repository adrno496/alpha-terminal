// Système de tooltips pour les termes techniques
// Usage : ajoute un attribut data-tt="key" sur n'importe quel élément, ou data-tt-text="texte direct"

import { t } from '../core/i18n.js';
import { safeRender } from '../core/safe-render.js';

const GLOSSARY = {
  // Fiscal FR
  tmi: 'Tranche Marginale d\'Imposition. Le taux % de la dernière tranche IR appliqué sur ton revenu.',
  pfu: 'Prélèvement Forfaitaire Unique (flat tax). 30% sur les plus-values mobilières (12,8% IR + 17,2% PS).',
  pea: 'Plan d\'Épargne en Actions. Enveloppe fiscale FR : exonération PV après 5 ans (hors PS 17,2%).',
  cto: 'Compte-Titres Ordinaire. Pas d\'avantage fiscal, PV soumises au PFU 30%.',
  per: 'Plan Épargne Retraite. Versements déductibles du revenu imposable, fiscalité en sortie.',
  av: 'Assurance-Vie. Après 8 ans : abattement 4 600€/an (9 200€ couple) sur les PV.',

  // Trading
  kelly: 'Fraction de capital optimale = (bp - q) / b. Maximise la croissance log mais très volatile en pratique.',
  reward_risk: 'Reward / Risk (R) : le gain potentiel divisé par le risque. Un trade 2R = on peut gagner 2× la perte max.',
  winrate: 'Pourcentage de trades gagnants sur l\'ensemble des trades.',
  drawdown: 'Perte max du capital depuis un sommet. Mesure clé de la volatilité du portefeuille.',
  vix: 'Indice de volatilité implicite S&P500. < 15 = complacence, > 25 = stress, > 40 = panique.',

  // Crypto
  fdv: 'Fully Diluted Valuation = prix × supply max. Indique la valo future si tous les tokens étaient en circulation.',
  tvl: 'Total Value Locked. Capital déposé dans les contrats du protocole.',
  pf_ratio: 'Price / Fees ratio. Équivalent du P/E pour DeFi : market cap divisé par les fees annualisés.',
  unlock: 'Tokens nouvellement débloqués (équipe, VCs, treasury). Pression vendeuse potentielle.',

  // Macro
  yield_curve: 'Courbe des taux. 10y - 2y < 0 (inversion) = signal historique de récession à 12-18 mois.',
  dxy: 'Dollar Index. Force du USD vs panier de devises. DXY ↑ = headwind pour EM, gold, commodities.',
  real_rate: 'Taux réel = taux nominal - inflation. Positif = restrictif, négatif = stimulant.',
  hy_oas: 'High Yield Option-Adjusted Spread (bps). Spread des bonds spéculatifs vs treasuries. > 500 bps = stress.',

  // Equity
  moat: 'Avantage concurrentiel durable (Buffett). Network effects, switching costs, scale, brand, regulatory.',
  roic: 'Return On Invested Capital. Si > WACC = création de valeur ; si < WACC = destruction.',
  fcf: 'Free Cash Flow = cash op - capex. Le vrai cash que la boîte génère, hors comptabilité créative.',
  sbc: 'Stock-Based Compensation. Si > 10% revenus = dilution importante, on doit le retirer du FCF "ajusté".'
};

let tipEl = null;

function ensureTipEl() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'tooltip';
  document.body.appendChild(tipEl);
  return tipEl;
}

function show(target, text) {
  const el = ensureTipEl();
  el.textContent = text;
  const r = target.getBoundingClientRect();
  el.classList.add('visible');
  // Position : au-dessus si possible
  el.style.left = Math.min(window.innerWidth - 280, Math.max(8, r.left + r.width / 2 - 140)) + 'px';
  el.style.top = (r.top - el.offsetHeight - 8) + 'px';
  if (r.top - el.offsetHeight - 8 < 0) {
    el.style.top = (r.bottom + 8) + 'px';
  }
}

function hide() {
  if (tipEl) tipEl.classList.remove('visible');
}

export function initTooltips() {
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tt],[data-tt-text]');
    if (!t) return;
    const key = t.getAttribute('data-tt');
    const direct = t.getAttribute('data-tt-text');
    const text = direct || (key && GLOSSARY[key]);
    if (text) show(t, text);
  });
  document.addEventListener('mouseout', (e) => {
    const t = e.target.closest('[data-tt],[data-tt-text]');
    if (t) hide();
  });
  document.addEventListener('scroll', hide, true);
}

// Helper pour générer une icône info inline avec une clé du glossaire
export function ttIcon(key) {
  return `<span class="tt-icon" data-tt="${key}" tabindex="0">i</span>`;
}

export function ttText(text) {
  return `<span class="tt-icon" data-tt-text="${(text || '').replace(/"/g, '&quot;')}" tabindex="0">i</span>`;
}

// === Module help popover ===
// Rich popover with markdown content from i18n key `mod.<id>.help`
let _modPop = null;
let _modPopTarget = null;

function ensureModPop() {
  if (_modPop) return _modPop;
  _modPop = document.createElement('div');
  _modPop.className = 'mod-help-popover';
  document.body.appendChild(_modPop);
  // Click outside closes
  document.addEventListener('mousedown', (e) => {
    if (!_modPop.classList.contains('visible')) return;
    if (e.target === _modPop || _modPop.contains(e.target)) return;
    if (e.target.closest('.mod-help-btn')) return;
    hideModuleHelp();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModuleHelp();
  });
  return _modPop;
}

export function showModuleHelp(target, moduleId) {
  const el = ensureModPop();
  const labelKey = `mod.${moduleId}.label`;
  const helpKey = `mod.${moduleId}.help`;
  const label = t(labelKey);
  const helpText = t(helpKey, '');

  const md = helpText && helpText !== helpKey ? helpText : t('mod.help.missing');
  const body = safeRender(md || '');

  el.innerHTML = `
    <div class="mod-help-popover-head">
      <strong>${label}</strong>
      <button class="mod-help-popover-close" aria-label="Close">×</button>
    </div>
    <div class="mod-help-popover-body">${body}</div>
  `;
  el.querySelector('.mod-help-popover-close').addEventListener('click', hideModuleHelp);

  el.classList.add('visible');
  _modPopTarget = target;

  // Position : a droite du bouton, ou en dessous si pas la place
  const r = target.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = r.right + 10;
  let top = r.top;
  if (left + w > window.innerWidth - 10) {
    // pas la place à droite : on met sous le bouton
    left = Math.max(10, r.left - w / 2);
    top = r.bottom + 8;
  }
  if (top + h > window.innerHeight - 10) {
    top = window.innerHeight - h - 10;
  }
  el.style.left = Math.max(10, left) + 'px';
  el.style.top = Math.max(10, top) + 'px';
}

export function hideModuleHelp() {
  if (_modPop) _modPop.classList.remove('visible');
  _modPopTarget = null;
}
