// Module 11 — DCF / Intrinsic Value Calculator
import { $, toast } from '../core/utils.js';
import { SYSTEM_DCF } from '../prompts/dcf.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'dcf';

export function renderDcfView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.dcf.label'), t('mod.dcf.desc'), { example: t('mod.dcf.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">Inputs</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Ticker / nom</label><input id="dcf-ticker" class="input" placeholder="NVDA" /></div>
        <div class="field"><label class="field-label">FCF actuel (M€/M$)</label><input id="dcf-fcf" class="input" type="number" step="100" /></div>
        <div class="field"><label class="field-label">Devise</label><select id="dcf-cur" class="input"><option>USD</option><option>EUR</option></select></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Croissance Y1-5 (%)</label><input id="dcf-g1" class="input" type="number" step="0.5" value="15" /></div>
        <div class="field"><label class="field-label">Croissance Y6-10 (%)</label><input id="dcf-g2" class="input" type="number" step="0.5" value="8" /></div>
        <div class="field"><label class="field-label">Terminal growth (%)</label><input id="dcf-tg" class="input" type="number" step="0.1" value="2.5" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">WACC (%)</label><input id="dcf-wacc" class="input" type="number" step="0.1" value="9" /></div>
        <div class="field"><label class="field-label">Dette nette</label><input id="dcf-debt" class="input" type="number" step="100" value="0" /></div>
        <div class="field"><label class="field-label">Diluted shares (M)</label><input id="dcf-shares" class="input" type="number" step="10" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="field-label">Prix actuel</label><input id="dcf-price" class="input" type="number" step="0.01" /></div>
        <div class="field"><label class="field-label">${t('common.notes')}</label><input id="dcf-notes" class="input" placeholder="${t('mod.dcf.notes_placeholder')}" /></div>
      </div>
      <button id="dcf-run" class="btn-primary">${t('mod.dcf.run')}</button>
    </div>
    <div id="dcf-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  bindDraft(MODULE_ID, 'dcf-notes');
  $('#dcf-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#dcf-ticker').value = 'NVDA'; $('#dcf-fcf').value = 60400; $('#dcf-cur').value = 'USD';
    $('#dcf-g1').value = 25; $('#dcf-g2').value = 12; $('#dcf-tg').value = 3;
    $('#dcf-wacc').value = 10; $('#dcf-shares').value = 24500; $('#dcf-price').value = 145;
  });
}

async function run() {
  const out = $('#dcf-output');
  const d = {
    ticker: $('#dcf-ticker').value, fcf: $('#dcf-fcf').value, cur: $('#dcf-cur').value,
    g1: $('#dcf-g1').value, g2: $('#dcf-g2').value, tg: $('#dcf-tg').value,
    wacc: $('#dcf-wacc').value, debt: $('#dcf-debt').value, shares: $('#dcf-shares').value,
    price: $('#dcf-price').value, notes: $('#dcf-notes').value
  };
  if (!d.fcf || !d.shares) { out.innerHTML = '<div class="alert alert-danger">FCF et nombre de shares requis.</div>'; return; }
  const userMsg = `Inputs DCF :

- Ticker : ${d.ticker || '?'}
- Devise : ${d.cur}
- FCF actuel : ${d.fcf} ${d.cur}M
- Croissance Y1-5 : ${d.g1}% / Y6-10 : ${d.g2}% / Terminal : ${d.tg}%
- WACC : ${d.wacc}%
- Dette nette : ${d.debt} ${d.cur}M
- Diluted shares : ${d.shares}M
- Prix actuel : ${d.price || 'non fourni'} ${d.cur}/share
${d.notes ? '- Notes : ' + d.notes : ''}

Calcule la fair value avec sensibilité et verdict.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_DCF,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 5000,
      recordInput: d
    }, out, { onTitle: () => `DCF · ${d.ticker || '?'}` });
    toast('DCF calculé', 'success');
  } catch {}
}
