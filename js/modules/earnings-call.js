// Module 4 — Earnings Call Analyzer
import { $, toast } from '../core/utils.js';
import { parsePdf } from '../core/pdf-parser.js';
import { SYSTEM_EARNINGS } from '../prompts/earnings-call.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'earnings-call';

export function renderEarningsCallView(viewEl) {
  const state = { parsedPdf: null, file: null };
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.earnings-call.label'), t('mod.earnings-call.desc'), { moduleId: MODULE_ID })}
    <div class="field-row">
      <div class="field"><label class="field-label">Ticker</label><input id="ec-ticker" class="input" placeholder="NVDA, MC.PA..." /></div>
      <div class="field"><label class="field-label">Quarter</label><input id="ec-quarter" class="input" placeholder="Q4 FY2025" /></div>
    </div>
    <div class="dropzone" id="ec-drop"><div class="dropzone-title">${t('mod.earnings-call.drop_title')}</div><div class="dropzone-hint">${t('mod.earnings-call.drop_hint')}</div><div id="ec-file" class="dropzone-file"></div><input id="ec-input" type="file" accept="application/pdf" hidden /></div>
    <div class="field"><label class="field-label">Transcript</label><textarea id="ec-text" class="textarea" rows="14"></textarea></div>
    <div class="field"><label class="field-label">${t('mod.earnings-call.prev_notes')}</label><textarea id="ec-prev" class="textarea" rows="4"></textarea></div>
    <button id="ec-run" class="btn-primary">${t('mod.earnings-call.run')}</button>
    <div id="ec-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  const drop = $('#ec-drop'), input = $('#ec-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) await handle(state, f); });
  input.addEventListener('change', async e => { const f = e.target.files[0]; if (f) await handle(state, f); });
  $('#ec-run').addEventListener('click', () => run(state));
}

async function handle(state, file) {
  if (file.type !== 'application/pdf') return;
  $('#ec-file').textContent = `📄 ${file.name} · parsing...`;
  try {
    state.parsedPdf = await parsePdf(file, { withText: true, withBase64: true });
    state.file = file;
    $('#ec-file').textContent = `✓ ${state.parsedPdf.name} · ${state.parsedPdf.pages} pages`;
    if (!$('#ec-text').value.trim()) $('#ec-text').value = state.parsedPdf.text;
  } catch (e) { $('#ec-file').textContent = '✗ ' + e.message; state.parsedPdf = null; }
}

async function run(state) {
  const out = $('#ec-output');
  const ticker = $('#ec-ticker').value.trim();
  const quarter = $('#ec-quarter').value.trim();
  const text = $('#ec-text').value.trim();
  const prev = $('#ec-prev').value.trim();
  if (!text && !state.parsedPdf) { out.innerHTML = '<div class="alert alert-danger">Fournis un transcript.</div>'; return; }

  let prompt = `Analyse ce transcript d'earnings call :\n\nSociété : ${ticker || 'non précisée'}\nQuarter : ${quarter || 'non précisé'}\n\n`;
  if (prev) prompt += `**Notes du quarter précédent** :\n${prev}\n\n`;
  if (text) prompt += `**Transcript** :\n${text}`;

  const files = state.parsedPdf ? [{ type: 'pdf', base64: state.parsedPdf.base64, name: state.parsedPdf.name, file: state.file, extractedText: state.parsedPdf.text }] : [];
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_EARNINGS,
      messages: [{ role: 'user', content: prompt }],
      files,
      maxTokens: 5000,
      recordInput: { ticker, quarter, hasPdf: !!state.parsedPdf, prevNotes: prev }
    }, out, { onTitle: () => `Earnings · ${ticker || '?'} · ${quarter || ''}`.trim() });
    toast('Analyse terminée', 'success');
  } catch {}
}
