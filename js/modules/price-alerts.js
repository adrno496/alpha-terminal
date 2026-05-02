// Module UI : gestion des alertes prix (créées via YouTube ou manuellement) + déclenchements
import { $, uuid, toast } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';
import { listPriceAlerts, savePriceAlert, deletePriceAlert, checkPriceAlerts, dismissAlert, reactivateAlert } from '../core/price-alerts.js';
import { updateAlertBadge } from '../ui/alerts-banner.js';

const MODULE_ID = 'price-alerts';

export async function renderPriceAlertsView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🚨 Alertes prix', 'Alertes extraites des transcripts YouTube ou créées manuellement. Vérifiées automatiquement contre les cours live.', { moduleId: MODULE_ID })}

    <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div style="font-size:13px;color:var(--text-secondary);">
        <span id="pa-summary">⏳ ${isEN ? 'Loading…' : 'Chargement…'}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="pa-add" class="btn-secondary">+ ${isEN ? 'Manual alert' : 'Alerte manuelle'}</button>
        <button id="pa-check" class="btn-primary">🔄 ${isEN ? 'Check prices now' : 'Vérifier les cours'}</button>
      </div>
    </div>

    <div id="pa-triggered"></div>
    <div id="pa-active"></div>
    <div id="pa-dismissed"></div>
  `;

  $('#pa-add').addEventListener('click', () => openAlertEditor(viewEl));
  $('#pa-check').addEventListener('click', async () => {
    const btn = $('#pa-check');
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const r = await checkPriceAlerts({ progressCb: ({ ticker, i, total }) => {
        btn.textContent = `⏳ ${ticker} (${i}/${total})`;
      }});
      btn.disabled = false; btn.textContent = '🔄 ' + (isEN ? 'Check prices now' : 'Vérifier les cours');
      toast(`${r.triggered.length} ${isEN ? 'triggered' : 'déclenchée(s)'} · ${r.stillWaiting.length} ${isEN ? 'waiting' : 'en attente'}${r.errors.length ? ' · ' + r.errors.length + ' erreur(s)' : ''}`, r.triggered.length > 0 ? 'success' : 'info');
      await refresh(viewEl);
      await updateAlertBadge();
      window.dispatchEvent(new CustomEvent('app:alerts-updated'));
    } catch (e) {
      btn.disabled = false; btn.textContent = '🔄 ' + (isEN ? 'Check prices now' : 'Vérifier les cours');
      toast('Check : ' + e.message, 'error');
    }
  });

  await refresh(viewEl);
}

async function refresh(viewEl) {
  const isEN = getLocale() === 'en';
  const all = await listPriceAlerts();
  const triggered = all.filter(a => a.status === 'triggered');
  const active = all.filter(a => a.status === 'active');
  const dismissed = all.filter(a => a.status === 'dismissed');

  $('#pa-summary').textContent = `${triggered.length} ${isEN ? 'triggered' : 'déclenchée(s)'} · ${active.length} ${isEN ? 'active' : 'active(s)'} · ${dismissed.length} ${isEN ? 'dismissed' : 'ignorée(s)'}`;

  $('#pa-triggered').innerHTML = triggered.length ? `
    <div class="card" style="border-left:4px solid var(--accent-red);">
      <div class="card-title" style="color:var(--accent-red);">🚨 ${isEN ? 'Triggered' : 'Déclenchées'} (${triggered.length})</div>
      ${triggered.map(a => renderAlertRow(a, isEN, 'triggered')).join('')}
    </div>` : '';
  $('#pa-active').innerHTML = active.length ? `
    <div class="card">
      <div class="card-title">⏳ ${isEN ? 'Active (waiting)' : 'Actives (en attente)'} (${active.length})</div>
      ${active.map(a => renderAlertRow(a, isEN, 'active')).join('')}
    </div>` : `
    <div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">
      ${triggered.length === 0 && dismissed.length === 0 ? (isEN ? '✨ No alerts. Run a YouTube transcript analysis or create one manually.' : '✨ Aucune alerte. Lance une analyse YouTube ou crée-en une manuellement.') : ''}
    </div>`;
  $('#pa-dismissed').innerHTML = dismissed.length ? `
    <div class="card">
      <details><summary style="cursor:pointer;color:var(--text-muted);font-size:12px;">${isEN ? 'Dismissed' : 'Ignorées'} (${dismissed.length})</summary>
        <div style="margin-top:10px;">${dismissed.map(a => renderAlertRow(a, isEN, 'dismissed')).join('')}</div>
      </details>
    </div>` : '';

  // Bind actions
  document.querySelectorAll('.pa-dismiss').forEach(b => b.addEventListener('click', async () => {
    await dismissAlert(b.dataset.id);
    await refresh(viewEl);
    await updateAlertBadge();
    window.dispatchEvent(new CustomEvent('app:alerts-updated'));
  }));
  document.querySelectorAll('.pa-reactivate').forEach(b => b.addEventListener('click', async () => {
    await reactivateAlert(b.dataset.id);
    await refresh(viewEl);
    await updateAlertBadge();
    window.dispatchEvent(new CustomEvent('app:alerts-updated'));
  }));
  document.querySelectorAll('.pa-delete').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(isEN ? 'Delete this alert?' : 'Supprimer cette alerte ?')) return;
    await deletePriceAlert(b.dataset.id);
    await refresh(viewEl);
    await updateAlertBadge();
    window.dispatchEvent(new CustomEvent('app:alerts-updated'));
  }));
}

function renderAlertRow(a, isEN, status) {
  const sym = ({ USD: '$', EUR: '€', GBP: '£' })[a.currency] || a.currency;
  const arrow = a.direction === 'above' ? '↑' : '↓';
  const kindMap = { entry: isEN ? 'entry' : 'entrée', exit: isEN ? 'exit' : 'sortie', stop: 'stop' };
  const kindLabel = kindMap[a.kind] || a.kind;
  const sourceLabel = a.source?.type === 'youtube'
    ? `📺 ${a.source.videoTitle ? a.source.videoTitle.slice(0, 60) : 'YouTube'}`
    : (isEN ? 'Manual' : 'Manuel');
  const observed = a.lastObservedPrice ? `${a.lastObservedPrice.toFixed(2)}${sym}` : '—';
  const triggered = status === 'triggered';
  return `
    <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;${triggered ? 'background:rgba(255,51,85,0.05);' : ''}">
      <div style="flex:1;min-width:240px;">
        <div style="font-size:13.5px;font-weight:600;">
          ${triggered ? '🚨 ' : ''}<strong>${escape(a.ticker)}</strong> ${arrow} ${a.targetPrice}${sym}
          <span style="font-size:11px;color:var(--text-muted);font-weight:400;"> · ${kindLabel}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
          ${sourceLabel} · ${isEN ? 'observed' : 'observé'} : <strong>${observed}</strong>
          ${a.lastCheckedAt ? ' · ' + new Date(a.lastCheckedAt).toLocaleString() : ''}
        </div>
        ${a.source?.quote ? `<div style="font-size:11px;color:var(--text-secondary);font-style:italic;margin-top:4px;border-left:2px solid var(--border);padding-left:6px;">"${escape(a.source.quote.slice(0, 180))}"</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;">
        ${status === 'triggered' || status === 'active' ? `<button class="btn-ghost pa-dismiss" data-id="${a.id}" style="font-size:11px;">✕ ${isEN ? 'Dismiss' : 'Ignorer'}</button>` : ''}
        ${status === 'dismissed' ? `<button class="btn-secondary pa-reactivate" data-id="${a.id}" style="font-size:11px;">↩ ${isEN ? 'Reactivate' : 'Réactiver'}</button>` : ''}
        <button class="btn-ghost pa-delete" data-id="${a.id}" style="font-size:11px;color:var(--accent-red);">🗑</button>
      </div>
    </div>
  `;
}

function openAlertEditor(viewEl) {
  const isEN = getLocale() === 'en';
  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:480px;width:100%;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>+ ${isEN ? 'Manual price alert' : 'Alerte prix manuelle'}</strong>
        <button class="btn-ghost" data-close aria-label="${isEN ? 'Close' : 'Fermer'}">×</button>
      </div>
      <div class="field"><label class="field-label">Ticker</label><input id="ne-ticker" class="input" placeholder="AAPL, BTC, MC.PA…" /></div>
      <div class="field-row">
        <div class="field"><label class="field-label">${isEN ? 'Direction' : 'Direction'}</label>
          <select id="ne-dir" class="input"><option value="above">${isEN ? 'Price ↑ above target' : 'Prix ↑ au-dessus'}</option><option value="below">${isEN ? 'Price ↓ below target' : 'Prix ↓ en-dessous'}</option></select>
        </div>
        <div class="field"><label class="field-label">${isEN ? 'Target price' : 'Prix cible'}</label><input id="ne-price" class="input" type="number" step="0.01" min="0" /></div>
        <div class="field"><label class="field-label">${isEN ? 'Currency' : 'Devise'}</label><select id="ne-ccy" class="input"><option>USD</option><option>EUR</option><option>GBP</option></select></div>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Type' : 'Type'}</label>
        <select id="ne-kind" class="input"><option value="entry">${isEN ? 'Entry' : 'Entrée'}</option><option value="exit">${isEN ? 'Exit / Target' : 'Sortie / Objectif'}</option><option value="stop">${isEN ? 'Stop-loss' : 'Stop-loss'}</option></select>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Note (optional)' : 'Note (optionnelle)'}</label><input id="ne-note" class="input" /></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn-ghost" data-close>${isEN ? 'Cancel' : 'Annuler'}</button>
        <button id="ne-save" class="btn-primary">${isEN ? 'Save' : 'Enregistrer'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(w);
  const close = () => { try { document.body.removeChild(w); } catch {} };
  w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  w.addEventListener('click', (e) => { if (e.target === w) close(); });

  w.querySelector('#ne-save').addEventListener('click', async () => {
    const ticker = w.querySelector('#ne-ticker').value.trim().toUpperCase();
    const price = parseFloat(w.querySelector('#ne-price').value);
    if (!ticker || !price || price <= 0) { toast(isEN ? 'Fill ticker + price' : 'Remplis ticker + prix', 'error'); return; }
    await savePriceAlert({
      id: uuid(),
      ticker, name: ticker,
      direction: w.querySelector('#ne-dir').value,
      targetPrice: price,
      currency: w.querySelector('#ne-ccy').value,
      kind: w.querySelector('#ne-kind').value,
      source: { type: 'manual', quote: w.querySelector('#ne-note').value.trim() || null },
      status: 'active',
      createdAt: new Date().toISOString()
    });
    close();
    await refresh(viewEl);
    await updateAlertBadge();
    toast(isEN ? 'Saved' : 'Enregistré', 'success');
  });
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
