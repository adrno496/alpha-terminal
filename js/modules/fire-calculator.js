// Module 17 — FIRE Calculator (Financial Independence)
import { $, toast } from '../core/utils.js';
import { SYSTEM_FIRE } from '../prompts/fire-calculator.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'fire-calculator';

export function renderFireCalculatorView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.fire-calculator.label'), t('mod.fire-calculator.desc'), { example: t('mod.fire-calculator.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.fire-calculator.profile')}</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Âge actuel</label><input id="fi-age" class="input" type="number" value="32" /></div>
        <div class="field"><label class="field-label">Patrimoine net actuel (€)</label><input id="fi-net" class="input" type="number" step="1000" value="60000" /></div>
        <div class="field"><label class="field-label">Salaire net mensuel (€)</label><input id="fi-salary" class="input" type="number" step="100" value="3500" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Dépenses mensuelles (€)</label><input id="fi-spend" class="input" type="number" step="100" value="2200" /></div>
        <div class="field"><label class="field-label">Épargne mensuelle (€)</label><input id="fi-save" class="input" type="number" step="100" value="1300" /></div>
        <div class="field"><label class="field-label">Rendement attendu (%)</label><input id="fi-yield" class="input" type="number" step="0.5" value="7" /></div>
      </div>
      <div class="field"><label class="field-label">${t('mod.fire-calculator.notes_label')}</label><textarea id="fi-notes" class="textarea" rows="3"></textarea></div>
      <button id="fi-run" class="btn-primary">${t('mod.fire-calculator.run')}</button>
    </div>
    <div id="fi-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#fi-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#fi-age').value = 30; $('#fi-net').value = 80000; $('#fi-salary').value = 4200;
    $('#fi-spend').value = 2500; $('#fi-save').value = 1700; $('#fi-yield').value = 7;
  });
}

async function run() {
  const out = $('#fi-output');
  const d = {
    age: $('#fi-age').value, net: $('#fi-net').value, salary: $('#fi-salary').value,
    spend: $('#fi-spend').value, save: $('#fi-save').value, yieldPct: $('#fi-yield').value,
    notes: $('#fi-notes').value
  };
  const annualSpend = (+d.spend) * 12;
  const number25 = annualSpend * 25;
  const number33 = annualSpend * 33; // safer FR-adjusted
  const userMsg = `Profil FIRE :

- Âge : ${d.age} ans
- Patrimoine net : ${d.net} €
- Salaire net mensuel : ${d.salary} €
- Dépenses mensuelles : ${d.spend} € (≈ ${annualSpend.toLocaleString('fr-FR')} €/an)
- Épargne mensuelle : ${d.save} €
- Rendement attendu : ${d.yieldPct}%/an
- Notes : ${d.notes || 'aucune'}

Calculs préliminaires :
- Number FI règle 4% : ${number25.toLocaleString('fr-FR')} €
- Number FI ajusté FR (3%) : ${number33.toLocaleString('fr-FR')} €

Génère l'analyse FIRE complète selon ton format avec simulation 10/20/30 ans.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_FIRE,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 5000,
      recordInput: d
    }, out, { onTitle: () => `FIRE · ${d.age}y · ${(annualSpend/1000).toFixed(0)}K€/an` });
    toast('FIRE calculé', 'success');
  } catch {}
}
