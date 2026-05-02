// Module 21 — Knowledge Base personnelle (RAG client-side) — bilingue via t()
import { $, toast, fmtRelative, escHtml } from '../core/utils.js';
import { listKnowledge, getKnowledge, deleteKnowledge, indexDocument, retrieve } from '../core/rag.js';
import { hasEmbeddingProvider } from '../core/embeddings.js';
import { parsePdf } from '../core/pdf-parser.js';
import { moduleHeader } from './_shared.js';
import { t } from '../core/i18n.js';
import { showTutorialIfFirstOpen } from '../ui/module-tutorials.js';

const MODULE_ID = 'knowledge-base';

export async function renderKnowledgeBaseView(viewEl) {
  try { showTutorialIfFirstOpen('knowledge-base'); } catch {}
  const noEmbed = !hasEmbeddingProvider();

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.knowledge-base.label'), t('kb.desc'), { moduleId: MODULE_ID })}

    ${noEmbed ? `<div class="alert alert-warning">${t('kb.no_embed')}</div>` : ''}

    <div class="card">
      <div class="card-title">${t('kb.add_content')}</div>
      <div class="kb-add-tabs">
        <button class="kb-tab active" data-tab="note">${t('kb.tab_note')}</button>
        <button class="kb-tab" data-tab="pdf">${t('kb.tab_pdf')}</button>
      </div>
      <div id="kb-add-content"></div>
    </div>

    <div class="card">
      <div class="card-title">${t('kb.test_retrieval')}</div>
      <p style="color:var(--text-secondary);font-size:12.5px;margin-bottom:8px;">${t('kb.test_search')}</p>
      <div style="display:flex;gap:8px;">
        <input id="kb-search" class="input" placeholder="${t('kb.search_placeholder')}" />
        <button id="kb-search-btn" class="btn-primary">${t('common.search')}</button>
      </div>
      <div id="kb-search-results"></div>
    </div>

    <div class="card">
      <div class="card-title">${t('kb.docs')}</div>
      <div id="kb-list"></div>
    </div>
  `;

  renderAddTab('note');
  document.querySelectorAll('.kb-tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.kb-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderAddTab(b.getAttribute('data-tab'));
  }));

  $('#kb-search-btn').addEventListener('click', doSearch);
  $('#kb-search').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  await renderList();
}

function renderAddTab(which) {
  const c = $('#kb-add-content');
  if (which === 'note') {
    c.innerHTML = `
      <div class="field"><label class="field-label">${t('kb.note.title')}</label><input id="kb-note-title" class="input" placeholder="${t('kb.note_title_placeholder')}" /></div>
      <div class="field"><label class="field-label">${t('kb.note.content')}</label><textarea id="kb-note-content" class="textarea" rows="10" placeholder="${t('kb.note_content_placeholder')}"></textarea></div>
      <div class="field"><label class="field-label">${t('kb.note.tags')}</label><input id="kb-note-tags" class="input" placeholder="nvda, ai, semis" /></div>
      <button id="kb-note-save" class="btn-primary">${t('kb.note.save')}</button>
      <span id="kb-note-status" style="margin-left:10px;font-family:var(--font-mono);font-size:11.5px;"></span>
    `;
    $('#kb-note-save').addEventListener('click', async () => {
      const title = $('#kb-note-title').value.trim();
      const content = $('#kb-note-content').value.trim();
      const tags = $('#kb-note-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      const status = $('#kb-note-status');
      if (!title || !content) { toast(t('kb.title_required'), 'warning'); return; }
      status.textContent = '⏳ ' + t('kb.indexing');
      try {
        await indexDocument({ type: 'note', title, content, tags });
        status.textContent = '✓ ' + t('kb.indexed');
        status.style.color = 'var(--accent-green)';
        toast(t('kb.note_indexed'), 'success');
        $('#kb-note-title').value = ''; $('#kb-note-content').value = ''; $('#kb-note-tags').value = '';
        renderList();
      } catch (e) {
        status.textContent = '✗ ' + e.message; status.style.color = 'var(--accent-red)';
      }
    });
  } else if (which === 'pdf') {
    c.innerHTML = `
      <div class="dropzone" id="kb-drop">
        <div class="dropzone-title">${t('kb.pdf.drop_title')}</div>
        <div class="dropzone-hint">${t('kb.pdf.drop_hint')}</div>
        <div id="kb-pdf-status" class="dropzone-file"></div>
        <input id="kb-pdf-input" type="file" accept="application/pdf" hidden />
      </div>
      <div class="field"><label class="field-label">${t('kb.pdf.title_label')}</label><input id="kb-pdf-title" class="input" /></div>
      <div class="field"><label class="field-label">${t('kb.pdf.tags')}</label><input id="kb-pdf-tags" class="input" /></div>
    `;
    const drop = $('#kb-drop'), input = $('#kb-pdf-input');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async e => {
      e.preventDefault(); drop.classList.remove('dragover');
      const f = e.dataTransfer.files[0]; if (f) await handlePdf(f);
    });
    input.addEventListener('change', async e => { const f = e.target.files[0]; if (f) await handlePdf(f); });
  }
}

async function handlePdf(file) {
  const status = $('#kb-pdf-status');
  status.textContent = `📄 ${file.name} · ${t('kb.parsing')}`;
  try {
    const parsed = await parsePdf(file, { withText: true, withBase64: false, pageLimit: 500 });
    status.textContent = `📄 ${file.name} · ${parsed.pages} pages · ${t('kb.indexing')}`;
    const title = $('#kb-pdf-title').value.trim() || parsed.name;
    const tags = $('#kb-pdf-tags').value.split(',').map(s => s.trim()).filter(Boolean);
    await indexDocument({ type: 'pdf', title, content: parsed.text, tags });
    status.textContent = '✓ ' + t('kb.indexed') + ' · ' + parsed.name;
    toast(t('kb.pdf_indexed'), 'success');
    renderList();
  } catch (e) {
    status.textContent = '✗ ' + e.message;
  }
}

async function renderList() {
  const list = await listKnowledge();
  const container = $('#kb-list');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<div class="alert alert-info">${t('kb.no_docs')}</div>`;
    return;
  }
  container.innerHTML = list.map(d => `
    <div class="kb-item">
      <span class="kb-icon">${d.type === 'pdf' ? '📄' : '📝'}</span>
      <div class="kb-info">
        <div class="kb-title">${escHtml(d.title)}</div>
        <div class="kb-meta">${d.chunkCount} chunks · ${fmtRelative(d.createdAt)}${d.tags?.length ? ' · ' + d.tags.map(tg => '#' + tg).join(' ') : ''}</div>
      </div>
      <button class="btn-danger" data-rm="${d.id}" aria-label="Supprimer">×</button>
    </div>
  `).join('');
  container.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(t('kb.delete_confirm'))) return;
    await deleteKnowledge(b.getAttribute('data-rm'));
    renderList();
    toast(t('kb.deleted'), 'success');
  }));
}

async function doSearch() {
  const q = $('#kb-search').value.trim();
  if (!q) return;
  const out = $('#kb-search-results');
  out.innerHTML = `<div class="loading"><span class="spinner"></span> <span>${t('kb.searching')}</span></div>`;
  const res = await retrieve(q, { topK: 6 });
  if (!res.length) {
    out.innerHTML = `<div class="alert alert-info">${t('kb.no_results')}</div>`;
    return;
  }
  out.innerHTML = res.map(r => `
    <div class="kb-result">
      <div class="kb-result-meta">${escHtml(r.docTitle)} · score ${(r.score*100).toFixed(0)}%</div>
      <div class="kb-result-text">${escHtml(r.text.slice(0, 400))}${r.text.length > 400 ? '…' : ''}</div>
    </div>
  `).join('');
}
