// Module 6 — Tax Optimizer FR
import { $, toast } from '../core/utils.js';
import { SYSTEM_TAX_FR } from '../prompts/tax-optimizer-fr.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { ttIcon } from '../ui/tooltips.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'tax-optimizer-fr';

export function renderTaxOptimizerView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.tax-optimizer-fr.label'), t('mod.tax-optimizer-fr.desc') + ' (PEA ' + ttIcon('pea') + ', CTO ' + ttIcon('cto') + ', PER ' + ttIcon('per') + ', AV ' + ttIcon('av') + ')', { moduleId: MODULE_ID })}
    <div class="alert alert-warning" style="margin-bottom:14px;">${t('mod.tax-optimizer-fr.warning')}</div>

    <div class="card">
      <div class="card-title">Situation personnelle</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Statut</label><select id="tx-status" class="input"><option>Célibataire</option><option>Marié / Pacsé</option><option>Divorcé</option></select></div>
        <div class="field"><label class="field-label">Parts fiscales</label><input id="tx-parts" class="input" type="number" step="0.5" value="1" /></div>
        <div class="field"><label class="field-label">${t('mod.tax-optimizer-fr.income')}</label><input id="tx-income" class="input" type="number" step="1000" value="80000" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">TMI estimé (%) ${ttIcon('tmi')}</label><select id="tx-tmi" class="input"><option>0</option><option>11</option><option selected>30</option><option>41</option><option>45</option></select></div>
        <div class="field"><label class="field-label">PFU ${ttIcon('pfu')}</label><select id="tx-pfu" class="input"><option selected>30% (PFU défaut)</option><option>Barème IR</option></select></div>
        <div class="field"><label class="field-label">Capacité épargne / an (€)</label><input id="tx-savings" class="input" type="number" step="1000" value="20000" /></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Enveloppes & holdings</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">PEA (€)</label><input id="tx-pea" class="input" type="number" step="1000" value="50000" /></div>
        <div class="field"><label class="field-label">PEA — ouvert depuis</label><input id="tx-pea-since" class="input" type="number" value="2018" /></div>
        <div class="field"><label class="field-label">PEA — versé (€)</label><input id="tx-pea-paid" class="input" type="number" step="1000" value="40000" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">CTO (€)</label><input id="tx-cto" class="input" type="number" step="1000" value="80000" /></div>
        <div class="field"><label class="field-label">PER (€)</label><input id="tx-per" class="input" type="number" step="1000" value="0" /></div>
        <div class="field"><label class="field-label">AV (€)</label><input id="tx-av" class="input" type="number" step="1000" value="20000" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">AV — ouverte depuis</label><input id="tx-av-since" class="input" type="number" value="2014" /></div>
        <div class="field"><label class="field-label">Crypto (€)</label><input id="tx-crypto" class="input" type="number" step="1000" value="15000" /></div>
        <div class="field"><label class="field-label">Immo locatif (€)</label><input id="tx-immo" class="input" type="number" step="1000" value="0" /></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Plus-values</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">PV YTD CTO (€)</label><input id="tx-pv-cto" class="input" type="number" step="100" value="6000" /></div>
        <div class="field"><label class="field-label">MV YTD CTO (€)</label><input id="tx-mv-cto" class="input" type="number" step="100" value="2000" /></div>
        <div class="field"><label class="field-label">PV latentes CTO (€)</label><input id="tx-pv-latent" class="input" type="number" step="100" value="12000" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">MV latentes CTO (€)</label><input id="tx-mv-latent" class="input" type="number" step="100" value="3500" /></div>
        <div class="field"><label class="field-label">PV crypto YTD (€)</label><input id="tx-pv-crypto" class="input" type="number" step="100" value="0" /></div>
        <div class="field"><label class="field-label">${t('common.notes_context')}</label><input id="tx-notes" class="input" /></div>
      </div>
    </div>

    <button id="tx-run" class="btn-primary">${t('mod.tax-optimizer-fr.run')}</button>
    <div id="tx-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#tx-run').addEventListener('click', run);
}

async function run() {
  const out = $('#tx-output');
  const data = {
    status: $('#tx-status').value, parts: $('#tx-parts').value, income: $('#tx-income').value,
    tmi: $('#tx-tmi').value, pfu: $('#tx-pfu').value, savings: $('#tx-savings').value,
    pea: $('#tx-pea').value, peaSince: $('#tx-pea-since').value, peaPaid: $('#tx-pea-paid').value,
    cto: $('#tx-cto').value, per: $('#tx-per').value, av: $('#tx-av').value, avSince: $('#tx-av-since').value,
    crypto: $('#tx-crypto').value, immo: $('#tx-immo').value,
    pvCto: $('#tx-pv-cto').value, mvCto: $('#tx-mv-cto').value, pvLatent: $('#tx-pv-latent').value,
    mvLatent: $('#tx-mv-latent').value, pvCrypto: $('#tx-pv-crypto').value, notes: $('#tx-notes').value
  };
  const userMsg = `Situation fiscale FR à optimiser (année 2026) :

**Foyer**
- Statut : ${data.status} · Parts : ${data.parts} · Revenu net annuel : ${data.income} €
- TMI estimé : ${data.tmi}% · Option : ${data.pfu} · Épargne annuelle : ${data.savings} €

**Enveloppes**
- PEA : ${data.pea} € (ouvert ${data.peaSince}, versé ${data.peaPaid} €)
- CTO : ${data.cto} € · PER : ${data.per} € · AV : ${data.av} € (ouverte ${data.avSince})
- Crypto : ${data.crypto} € · Immo locatif : ${data.immo} €

**Plus-values CTO**
- PV YTD : ${data.pvCto} € · MV YTD : ${data.mvCto} €
- PV latentes : ${data.pvLatent} € · MV latentes : ${data.mvLatent} €

**Crypto** : PV YTD : ${data.pvCrypto} €

**Notes** : ${data.notes || 'aucune'}

Génère la stratégie fiscale complète selon ton format.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_TAX_FR,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      recordInput: data
    }, out, { onTitle: () => `Stratégie fiscale · ${data.status} · TMI ${data.tmi}%` });
    toast('Stratégie générée', 'success');
  } catch {}
}
