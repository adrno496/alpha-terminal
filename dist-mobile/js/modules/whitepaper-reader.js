// Module 7 — Whitepaper Reader (scam detection)
import { $, toast } from '../core/utils.js';
import { parsePdf } from '../core/pdf-parser.js';
import { SYSTEM_WHITEPAPER } from '../prompts/whitepaper-reader.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'whitepaper-reader';

export function renderWhitepaperReaderView(viewEl) {
  const state = { parsedPdf: null, file: null };
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.whitepaper-reader.label'), t('mod.whitepaper-reader.desc'), { moduleId: MODULE_ID })}
    <div class="dropzone" id="wp-drop"><div class="dropzone-title">${t('mod.whitepaper-reader.drop_title')}</div><div class="dropzone-hint">drag & drop</div><div id="wp-file" class="dropzone-file"></div><input id="wp-input" type="file" accept="application/pdf" hidden /></div>
    <div class="field"><label class="field-label">${t('mod.whitepaper-reader.url')}</label><input id="wp-url" class="input" placeholder="https://..." /></div>
    <div class="field"><label class="field-label">${t('mod.whitepaper-reader.name')}</label><input id="wp-name" class="input" /></div>
    <div class="field"><label class="field-label">${t('common.notes_context')}</label><textarea id="wp-notes" class="textarea"></textarea></div>
    <button id="wp-run" class="btn-primary">${t('mod.whitepaper-reader.run')}</button>
    <div id="wp-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  const drop = $('#wp-drop'), input = $('#wp-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) await handle(state, f); });
  input.addEventListener('change', async e => { const f = e.target.files[0]; if (f) await handle(state, f); });
  $('#wp-run').addEventListener('click', () => run(state));
}

async function handle(state, file) {
  if (file.type !== 'application/pdf') return;
  $('#wp-file').textContent = `📄 ${file.name} · parsing...`;
  try {
    state.parsedPdf = await parsePdf(file, { withText: true, withBase64: true });
    state.file = file;
    $('#wp-file').textContent = `✓ ${state.parsedPdf.name} · ${state.parsedPdf.pages} pages`;
  } catch (e) { $('#wp-file').textContent = '✗ ' + e.message; state.parsedPdf = null; }
}

async function run(state) {
  const out = $('#wp-output');
  const url = $('#wp-url').value.trim();
  const name = $('#wp-name').value.trim();
  const notes = $('#wp-notes').value.trim();
  if (!state.parsedPdf && !url) { out.innerHTML = '<div class="alert alert-danger">Fournis un PDF ou une URL.</div>'; return; }

  if (url && !state.parsedPdf) {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const f = new File([new Blob([buf])], 'whitepaper.pdf');
      state.parsedPdf = await parsePdf(f, { withText: true, withBase64: true });
      state.file = f;
      $('#wp-file').textContent = `✓ Téléchargé · ${state.parsedPdf.pages} pages`;
    } catch (e) {
      // CORS — on continue avec le contexte fourni
    }
  }

  const prompt = `Projet à analyser : **${name || 'inconnu'}**\n${notes ? 'Contexte : ' + notes : ''}\n\nApplique ton scan anti-scam complet selon ton format.`;
  const files = state.parsedPdf ? [{ type: 'pdf', base64: state.parsedPdf.base64, name: state.parsedPdf.name, file: state.file, extractedText: state.parsedPdf.text }] : [];
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_WHITEPAPER,
      messages: [{ role: 'user', content: prompt }],
      files,
      maxTokens: 5000,
      recordInput: { name, url, notes, hasPdf: !!state.parsedPdf }
    }, out, { onTitle: () => `Whitepaper · ${name || (state.parsedPdf ? state.parsedPdf.name : 'projet')}` });
    toast('Scan terminé', 'success');
  } catch {}
}
