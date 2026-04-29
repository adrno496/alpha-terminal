// Module 16 — Investment Memo Writer
import { $, toast } from '../core/utils.js';
import { SYSTEM_INVESTMENT_MEMO } from '../prompts/investment-memo.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'investment-memo';

export function renderInvestmentMemoView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.investment-memo.label'), t('mod.investment-memo.desc'), { moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">Inputs</div>
      <div class="field-row">
        <div class="field"><label class="field-label">Asset / ticker</label><input id="im-asset" class="input" /></div>
        <div class="field"><label class="field-label">Taille position envisagée (%)</label><input id="im-size" class="input" type="number" step="0.5" /></div>
      </div>
      <div class="field"><label class="field-label">${t('mod.investment-memo.bull')}</label><textarea id="im-bull" class="textarea" rows="4"></textarea></div>
      <div class="field"><label class="field-label">${t('mod.investment-memo.bear')}</label><textarea id="im-bear" class="textarea" rows="3"></textarea></div>
      <div class="field"><label class="field-label">${t('mod.investment-memo.cat')}</label><textarea id="im-cat" class="textarea" rows="2"></textarea></div>
      <div class="field"><label class="field-label">${t('mod.investment-memo.notes_data')}</label><textarea id="im-notes" class="textarea" rows="3"></textarea></div>
      <button id="im-run" class="btn-primary">${t('mod.investment-memo.run')}</button>
    </div>
    <div id="im-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  ['im-bull','im-bear','im-cat','im-notes'].forEach(id => bindDraft(MODULE_ID, id));
  $('#im-run').addEventListener('click', run);
}

async function run() {
  const out = $('#im-output');
  const d = {
    asset: $('#im-asset').value.trim(), size: $('#im-size').value,
    bull: $('#im-bull').value.trim(), bear: $('#im-bear').value.trim(),
    cat: $('#im-cat').value.trim(), notes: $('#im-notes').value.trim()
  };
  if (!d.asset) { out.innerHTML = '<div class="alert alert-danger">Indique l\'asset.</div>'; return; }
  const userMsg = `Memo à rédiger pour : **${d.asset}**

Taille position envisagée : ${d.size || '?'}%

**Bull case** :
${d.bull || '(à compléter par toi)'}

**Bear case / risques** :
${d.bear || '(à compléter par toi)'}

**Catalyseurs 12 mois** :
${d.cat || '(à compléter par toi)'}

**Data / notes** :
${d.notes || '(non fournie)'}

Rédige le memo institutionnel complet selon ton format.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_INVESTMENT_MEMO,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      recordInput: d
    }, out, { onTitle: () => `Memo · ${d.asset}` });
    toast('Memo généré', 'success');
  } catch {}
}
