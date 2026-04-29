// Comparaison côte-à-côte de 2 analyses (sélection depuis l'historique)
import { listAnalyses, getAnalysis } from '../core/storage.js';
import { fmtRelative, escHtml } from '../core/utils.js';
import { showGenericModal } from './modal.js';
import { getModuleById } from './sidebar.js';

export async function openComparePicker() {
  const all = await listAnalyses({ limit: 200 });
  const html = `
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">
      Sélectionne 2 analyses à comparer côte-à-côte.
    </p>
    <div class="cmp-pickers">
      <div>
        <label class="field-label">Analyse A</label>
        <select id="cmp-a" class="input" size="8">
          ${all.map(a => `<option value="${a.id}">${escHtml((getModuleById(a.module)?.label || a.module) + ' · ' + (a.title || '').slice(0, 40))} (${fmtRelative(a.createdAt)})</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">Analyse B</label>
        <select id="cmp-b" class="input" size="8">
          ${all.map(a => `<option value="${a.id}">${escHtml((getModuleById(a.module)?.label || a.module) + ' · ' + (a.title || '').slice(0, 40))} (${fmtRelative(a.createdAt)})</option>`).join('')}
        </select>
      </div>
    </div>
    <button id="cmp-go" class="btn-primary" style="margin-top:14px;">Comparer →</button>
  `;
  showGenericModal('⚔️ Comparer 2 analyses', html, { wide: true });
  document.getElementById('cmp-go').addEventListener('click', async () => {
    const a = document.getElementById('cmp-a').value;
    const b = document.getElementById('cmp-b').value;
    if (!a || !b) return;
    const [recA, recB] = await Promise.all([getAnalysis(a), getAnalysis(b)]);
    showCompareView(recA, recB);
  });
}

function showCompareView(a, b) {
  const ma = getModuleById(a.module), mb = getModuleById(b.module);
  const renderMd = (md) => window.marked ? window.marked.parse(md) : `<pre>${md}</pre>`;
  const html = `
    <div class="cmp-grid">
      <div class="cmp-col">
        <div class="cmp-col-meta">${ma?.label || a.module} · ${new Date(a.createdAt).toLocaleString('fr-FR')}</div>
        <h3 style="font-size:14px;margin-bottom:8px;">${escHtml(a.title || '')}</h3>
        <div class="cmp-content">${renderMd(a.output)}</div>
      </div>
      <div class="cmp-col">
        <div class="cmp-col-meta">${mb?.label || b.module} · ${new Date(b.createdAt).toLocaleString('fr-FR')}</div>
        <h3 style="font-size:14px;margin-bottom:8px;">${escHtml(b.title || '')}</h3>
        <div class="cmp-content">${renderMd(b.output)}</div>
      </div>
    </div>
  `;
  showGenericModal(`⚔️ Compare`, html, { wide: true });
}
