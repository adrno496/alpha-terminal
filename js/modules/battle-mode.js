// Module 19 — Battle Mode (2 assets en débat)
import { $, toast } from '../core/utils.js';
import { SYSTEM_BATTLE_MODE } from '../prompts/battle-mode.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'battle-mode';

export function renderBattleModeView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.battle-mode.label'), t('mod.battle-mode.desc'), { example: t('mod.battle-mode.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.battle-mode.fighters')}</div>
      <div class="field-row">
        <div class="field"><label class="field-label">Asset 1 (Bull case A)</label><input id="bm-a" class="input" placeholder="NVDA" /></div>
        <div class="field"><label class="field-label">Asset 2 (Bull case B)</label><input id="bm-b" class="input" placeholder="AMD" /></div>
      </div>
      <div class="field"><label class="field-label">Type</label><select id="bm-type" class="input"><option>Stock vs Stock</option><option>Crypto vs Crypto</option><option>Stock vs Crypto</option><option>ETF vs ETF</option><option>Sector vs Sector</option></select></div>
      <div class="field"><label class="field-label">Contexte / horizon</label><input id="bm-ctx" class="input" placeholder="ex: 'horizon 12 mois', 'qui acheter pour le cycle IA'..." /></div>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0;cursor:pointer;">
        <input type="checkbox" id="bm-web" checked /> Web search pour data récentes
      </label>
      <button id="bm-run" class="btn-primary">${t('mod.battle-mode.run')}</button>
    </div>
    <div id="bm-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#bm-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { $('#bm-a').value = 'NVDA'; $('#bm-b').value = 'AMD'; run(); });
}

async function run() {
  const out = $('#bm-output');
  const a = $('#bm-a').value.trim(), b = $('#bm-b').value.trim();
  const type = $('#bm-type').value, ctx = $('#bm-ctx').value.trim();
  const web = $('#bm-web').checked;
  if (!a || !b) { out.innerHTML = '<div class="alert alert-danger">Indique les 2 actifs.</div>'; return; }
  const userMsg = `Battle : **${a}** vs **${b}** (${type})\n${ctx ? 'Contexte : ' + ctx : ''}\n\nLance le débat structuré complet.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_BATTLE_MODE,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      useWebSearch: web,
      recordInput: { a, b, type, ctx, web }
    }, out, { onTitle: () => `Battle · ${a} vs ${b}` });
    toast('Combat terminé', 'success');
  } catch {}
}
