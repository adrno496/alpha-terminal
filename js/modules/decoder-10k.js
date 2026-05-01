// Module 1 — Decoder 10-K
import { $, toast } from '../core/utils.js';
import { parsePdf } from '../core/pdf-parser.js';
import { SYSTEM_DECODER_10K } from '../prompts/decoder-10k.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { ttIcon } from '../ui/tooltips.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'decoder-10k';

export function renderDecoder10kView(viewEl) {
  const state = { parsedPdf: null };
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.decoder-10k.label'), t('mod.decoder-10k.desc') + ' ' + ttIcon('moat'), { moduleId: MODULE_ID })}
    <div class="dropzone" id="tk-drop">
      <div class="dropzone-title">${t('mod.decoder-10k.drop_title')}</div>
      <div class="dropzone-hint">${t('mod.decoder-10k.drop_hint')}</div>
      <div id="tk-file" class="dropzone-file"></div>
      <input id="tk-input" type="file" accept="application/pdf" hidden />
    </div>
    <div class="field"><label class="field-label">${t('mod.decoder-10k.ticker')}</label><input id="tk-ticker" class="input" placeholder="NVDA, LVMH..." /></div>
    <div class="field"><label class="field-label">${t('mod.decoder-10k.notes')}</label><textarea id="tk-notes" class="textarea"></textarea></div>
    <button id="tk-run" class="btn-primary" disabled>${t('mod.decoder-10k.run')}</button>
    <div id="tk-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  const drop = $('#tk-drop'), input = $('#tk-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', async e => {
    e.preventDefault(); drop.classList.remove('dragover');
    const f = e.dataTransfer.files[0]; if (f) await handle(state, f);
  });
  input.addEventListener('change', async e => { const f = e.target.files[0]; if (f) await handle(state, f); });
  $('#tk-run').addEventListener('click', () => run(state));
}

async function handle(state, file) {
  if (file.type !== 'application/pdf') { toast('Seuls les PDF sont supportés', 'warning'); return; }
  const fileEl = $('#tk-file');
  fileEl.textContent = `📄 ${file.name} · encoding...`;
  try {
    state.parsedPdf = await parsePdf(file, {
      withText: true, withBase64: true, pageLimit: 300,
      onProgress: (p) => {
        if (p.stage === 'encoding') fileEl.textContent = `⏳ ${file.name} · encoding base64...`;
        else if (p.stage === 'parsing' && p.page) fileEl.textContent = `⏳ parsing ${p.page}/${p.total}`;
      }
    });
    state.file = file;
    fileEl.textContent = `✓ ${state.parsedPdf.name} · ${state.parsedPdf.pages} pages · ${(state.parsedPdf.size/1024/1024).toFixed(1)} Mo`;
    $('#tk-run').disabled = false;
  } catch (e) {
    fileEl.textContent = '✗ ' + e.message;
    state.parsedPdf = null;
    $('#tk-run').disabled = true;
  }
}

async function run(state) {
  const out = $('#tk-output');
  if (!state.parsedPdf) return;
  const ticker = $('#tk-ticker').value.trim();
  const notes  = $('#tk-notes').value.trim();
  let prompt = `Analyse le rapport annuel ci-joint selon ton format.`;
  if (ticker) prompt += `\nSociété : ${ticker}.`;
  if (notes)  prompt += `\nFocus utilisateur : ${notes}`;

  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_DECODER_10K,
      messages: [{ role: 'user', content: prompt }],
      files: [{
        type: 'pdf',
        base64: state.parsedPdf.base64,
        name: state.parsedPdf.name,
        file: state.file,
        extractedText: state.parsedPdf.text // utilisé en fallback si provider sans PDF natif
      }],
      maxTokens: 6000,
      recordInput: { ticker, notes, fileName: state.parsedPdf.name, pages: state.parsedPdf.pages }
    }, out, { onTitle: () => `10-K · ${ticker || state.parsedPdf.name}` });
    toast('Analyse terminée', 'success');
  } catch (e) {
    console.error('[decoder-10k] run failed:', e);
  }
}
