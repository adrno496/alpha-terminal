// Vue Historique v2 — preview, starred, full-text search, ré-exec
import { $, fmtRelative, escHtml, debounce, toast } from '../core/utils.js';
import { listAnalyses, deleteAnalysis, getAnalysis, saveAnalysis } from '../core/storage.js';
import { downloadMarkdown, copyToClipboard } from '../core/export.js';
import { getModuleById, MODULES } from './sidebar.js';
import { t } from '../core/i18n.js';

export async function renderHistoryView(viewEl, { onOpen }) {
  viewEl.innerHTML = `
    <div class="module-header">
      <h2>${t('history.title')}</h2>
      <div class="module-desc">${t('history.desc')}</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
      <input id="hist-search" class="input" style="max-width:340px;flex:1;" placeholder="${t('history.search')}" />
      <select id="hist-filter" class="input" style="max-width:200px;">
        <option value="">${t('history.all_modules')}</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer;">
        <input type="checkbox" id="hist-starred-only" /> ${t('history.starred_only')}
      </label>
    </div>
    <div id="hist-count" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:8px;"></div>
    <div id="hist-list"></div>
  `;

  const filter = $('#hist-filter');
  MODULES.forEach(m => filter.insertAdjacentHTML('beforeend', `<option value="${m.id}">${m.label}</option>`));

  let items = await listAnalyses({ limit: 1000 });

  const renderList = debounce(() => {
    const q = $('#hist-search').value.toLowerCase().trim();
    const f = filter.value;
    const starred = $('#hist-starred-only').checked;
    const list = items.filter(it => {
      if (f && it.module !== f) return false;
      if (starred && !it.starred) return false;
      if (!q) return true;
      const hay = (it.title || '') + ' ' + it.module + ' ' + (it.output || '');
      return hay.toLowerCase().includes(q);
    });
    $('#hist-count').textContent = `${list.length} analyse${list.length > 1 ? 's' : ''}`;
    if (!list.length) {
      $('#hist-list').innerHTML = `<div class="alert alert-info">Aucune analyse correspondante.</div>`;
      return;
    }
    $('#hist-list').innerHTML = list.map(it => {
      const mod = getModuleById(it.module);
      const preview = (it.output || '')
        .replace(/[#*`_>\-\|]/g, '')
        .replace(/\n+/g, ' ')
        .slice(0, 220);
      return `
        <div class="history-item-v2" data-id="${it.id}">
          <button class="history-star ${it.starred ? 'starred' : ''}" data-act="star" title="Favori">${it.starred ? '★' : '☆'}</button>
          <div class="history-content">
            <div class="history-content-top">
              <span class="history-module">${mod ? mod.num : '??'} · ${mod ? mod.label : it.module}</span>
              <span class="history-date">${fmtRelative(it.createdAt)}</span>
            </div>
            <div class="history-title">${escHtml(it.title || 'Analyse sans titre')}</div>
            <div class="history-preview">${escHtml(preview)}…</div>
          </div>
          <div class="history-actions">
            <button class="btn-ghost" data-act="open">${t('history.open')}</button>
            <button class="btn-ghost" data-act="md">.md</button>
            <button class="btn-ghost" data-act="copy">${t('common.copy')}</button>
            <button class="btn-ghost" data-act="del">×</button>
          </div>
        </div>`;
    }).join('');

    $('#hist-list').querySelectorAll('.history-item-v2').forEach(row => {
      const id = row.getAttribute('data-id');
      row.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const act = b.getAttribute('data-act');
          const rec = await getAnalysis(id);
          if (!rec) return;
          if (act === 'open') onOpen(rec);
          else if (act === 'md') downloadMarkdown(`${rec.module}-${id.slice(0,8)}.md`, rec.output);
          else if (act === 'copy') { await copyToClipboard(rec.output); toast('Copié', 'success'); }
          else if (act === 'star') {
            rec.starred = !rec.starred;
            await saveAnalysis(rec);
            const local = items.find(x => x.id === id);
            if (local) local.starred = rec.starred;
            renderList();
          }
          else if (act === 'del') {
            if (confirm('Supprimer cette analyse ?')) {
              await deleteAnalysis(id);
              items = items.filter(x => x.id !== id);
              renderList();
              toast('Supprimée', 'success');
            }
          }
        });
      });
    });
  }, 120);

  $('#hist-search').addEventListener('input', renderList);
  filter.addEventListener('change', renderList);
  $('#hist-starred-only').addEventListener('change', renderList);
  renderList();
}
