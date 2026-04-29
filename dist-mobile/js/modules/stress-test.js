// Module 18 — Stress Test Portfolio
import { $, toast } from '../core/utils.js';
import { SYSTEM_STRESS_TEST } from '../prompts/stress-test.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'stress-test';

export function renderStressTestView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.stress-test.label'), t('mod.stress-test.desc'), { moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.stress-test.title')}</div>
      <p style="color:var(--text-secondary);font-size:12.5px;margin-bottom:10px;">
        Format : <code>asset | classe | montant | devise</code>. Une ligne par position.
      </p>
      <textarea id="st-portfolio" class="textarea" rows="10" placeholder="CW8 (MSCI World) | Equity US | 30000 | EUR&#10;NVDA | Tech / Growth | 15000 | USD&#10;OAT 10Y | Bonds Sov. | 10000 | EUR&#10;BTC | Crypto | 5000 | USD"></textarea>
      <div class="field"><label class="field-label">${t('common.notes_context')}</label><textarea id="st-notes" class="textarea" rows="2"></textarea></div>
      <button id="st-run" class="btn-primary">${t('mod.stress-test.run')}</button>
    </div>
    <div id="st-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#st-run').addEventListener('click', run);
}

async function run() {
  const out = $('#st-output');
  const portfolio = $('#st-portfolio').value.trim();
  const notes = $('#st-notes').value.trim();
  if (!portfolio) { out.innerHTML = `<div class="alert alert-danger">${t('st.portfolio_required')}</div>`; return; }
  const userMsg = `Portfolio à stress-tester :

${portfolio}

Notes : ${notes || 'aucune'}

Applique les 6 scénarios + synthèse + hedges suggérés.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_STRESS_TEST,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      recordInput: { portfolio, notes }
    }, out, { onTitle: () => `Stress Test · ${new Date().toLocaleDateString('fr-FR')}` });
    toast('Stress test terminé', 'success');
  } catch {}
}
