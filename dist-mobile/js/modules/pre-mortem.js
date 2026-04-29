// Module 13 — Pre-Mortem / Devil's Advocate
import { $, toast } from '../core/utils.js';
import { SYSTEM_PRE_MORTEM } from '../prompts/pre-mortem.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import { makeMicButton } from '../ui/voice.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'pre-mortem';

export function renderPreMortemView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.pre-mortem.label'), t('mod.pre-mortem.desc'), { moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.pre-mortem.thesis_title')}</div>
      <div class="field"><label class="field-label">Asset / position</label><input id="pm-asset" class="input" /></div>
      <div class="field" style="position:relative;">
        <label class="field-label">${t('mod.pre-mortem.thesis')}</label>
        <textarea id="pm-thesis" class="textarea" rows="10" placeholder="${t('mod.pre-mortem.thesis_placeholder')}"></textarea>
      </div>
      <button id="pm-run" class="btn-primary">${t('mod.pre-mortem.run')}</button>
    </div>
    <div id="pm-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  bindDraft(MODULE_ID, 'pm-thesis');
  // Mic button for voice dictation
  const f = $('#pm-thesis').parentElement;
  f.style.position = 'relative';
  const mic = makeMicButton($('#pm-thesis'));
  mic.style.position = 'absolute';
  mic.style.right = '8px';
  mic.style.top = '32px';
  f.appendChild(mic);
  $('#pm-run').addEventListener('click', run);
}

async function run() {
  const out = $('#pm-output');
  const asset = $('#pm-asset').value.trim();
  const thesis = $('#pm-thesis').value.trim();
  if (!thesis) { out.innerHTML = `<div class="alert alert-danger">${t('pm.thesis_required')}</div>`; return; }
  const userMsg = `Asset : **${asset || 'non précisé'}**\n\nThèse à challenger :\n\n${thesis}\n\nApplique ton format pre-mortem complet.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_PRE_MORTEM,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 5000,
      recordInput: { asset, thesis }
    }, out, { onTitle: () => `Pre-Mortem · ${asset || 'thèse'}` });
    toast('Pre-mortem terminé', 'success');
  } catch {}
}
