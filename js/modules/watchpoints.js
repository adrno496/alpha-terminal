// 📌 Mes points de surveillance — notes partagées entre tous les modules
import { $, toast } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import {
  listWatchpoints, saveWatchpoint, deleteWatchpoint, markDismissed, WATCHPOINT_TYPES
} from '../core/watchpoints.js';

const MODULE_ID = 'watchpoints';

function statusBadge(status) {
  const map = {
    active:    { label: 'Actif',     color: 'var(--accent-green)' },
    triggered: { label: '🔔 Déclenché', color: 'var(--accent-orange)' },
    dismissed: { label: 'Ignoré',    color: 'var(--text-muted)' },
    done:      { label: '✅ Fait',    color: 'var(--accent-blue)' }
  };
  const s = map[status] || map.active;
  return `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.05);color:${s.color};border:1px solid ${s.color};">${s.label}</span>`;
}

export function renderWatchpointsView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('📌 ' + t('mod.watchpoints.label'), t('mod.watchpoints.desc'), { moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">➕ ${isEN ? 'Add a watchpoint' : 'Ajouter un point de surveillance'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:13px;">
        <label>${isEN ? 'Type' : 'Type'}
          <select id="wp-type" class="input">
            ${WATCHPOINT_TYPES.map(x => `<option value="${x.id}">${x.label}</option>`).join('')}
          </select>
        </label>
        <label>${isEN ? 'Ticker / asset' : 'Ticker / actif'}<input type="text" id="wp-ticker" class="input" placeholder="AAPL, BTC, MC.PA..." /></label>
        <label>${isEN ? 'Target price' : 'Prix cible'}<input type="number" step="0.01" id="wp-target" class="input" placeholder="180.50" /></label>
        <label>${isEN ? 'Event date (IPO/event)' : 'Date événement'}<input type="date" id="wp-date" class="input" /></label>
        <label style="grid-column:1/-1;">${isEN ? 'Note / context' : 'Note / contexte'}<textarea id="wp-note" rows="2" class="textarea" placeholder="${isEN ? 'Why this matters, my thesis, source...' : 'Pourquoi c\\u2019est important, ma thèse, source...'}"></textarea></label>
      </div>
      <button id="wp-save" class="btn-primary" style="margin-top:10px;">${isEN ? 'Save watchpoint' : 'Enregistrer'}</button>
    </div>

    <div class="card">
      <div class="card-title">📋 ${isEN ? 'Active watchpoints' : 'Points de surveillance actifs'} (<span id="wp-count">0</span>)</div>
      <div style="margin-bottom:10px;font-size:12px;">
        <button class="btn-ghost" data-filter="active">${isEN ? 'Active' : 'Actifs'}</button>
        <button class="btn-ghost" data-filter="triggered">🔔 ${isEN ? 'Triggered' : 'Déclenchés'}</button>
        <button class="btn-ghost" data-filter="dismissed">${isEN ? 'Dismissed' : 'Ignorés'}</button>
        <button class="btn-ghost" data-filter="all">${isEN ? 'All' : 'Tous'}</button>
      </div>
      <div id="wp-list"></div>
    </div>

    <div class="card" style="border-left:3px solid var(--accent-blue);">
      <div class="card-title">💡 ${isEN ? 'How it works' : 'Comment ça marche'}</div>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;">
        ${isEN
          ? 'Each watchpoint is automatically scanned by the <strong>Daily Brief</strong>, <strong>Smart Alerts Center</strong>, and <strong>Today\\u2019s Actions</strong> modules. When a target is reached or an event approaches, you get notified directly there.'
          : 'Chaque point de surveillance est automatiquement scanné par les modules <strong>Daily Brief</strong>, <strong>Smart Alerts Center</strong> et <strong>Today\\u2019s Actions</strong>. Quand une cible est atteinte ou qu\\u2019un événement approche, tu es prévenu directement.'}
      </p>
    </div>
  `;

  let currentFilter = 'active';
  async function refresh() {
    const all = await listWatchpoints();
    $('#wp-count').textContent = all.filter(w => w.status === 'active').length;
    const filtered = currentFilter === 'all' ? all : all.filter(w => w.status === currentFilter);
    if (!filtered.length) {
      $('#wp-list').innerHTML = `<div style="color:var(--text-muted);padding:14px;text-align:center;">${isEN ? 'No watchpoint yet. Add your first one above.' : 'Aucun point. Ajoute le premier ci-dessus.'}</div>`;
      return;
    }
    $('#wp-list').innerHTML = filtered.map(w => {
      const typ = WATCHPOINT_TYPES.find(x => x.id === w.type) || { label: w.type };
      const meta = [];
      if (w.target) meta.push(`<span style="font-family:var(--font-mono);">cible : <strong>${w.target}</strong></span>`);
      if (w.eventDate) meta.push(`<span style="font-family:var(--font-mono);">${isEN ? 'date' : 'date'} : <strong>${w.eventDate}</strong></span>`);
      if (w.triggeredAt) meta.push(`<span style="color:var(--accent-orange);font-size:11px;">déclenché le ${w.triggeredAt.slice(0, 10)}</span>`);
      return `
        <div style="border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
                ${statusBadge(w.status)}
                <span style="font-size:12px;color:var(--text-muted);">${typ.label}</span>
                ${w.ticker ? `<strong style="font-family:var(--font-mono);">${w.ticker}</strong>` : ''}
              </div>
              <div style="font-size:13px;margin-bottom:4px;">${meta.join(' · ')}</div>
              ${w.note ? `<div style="font-size:13px;color:var(--text-secondary);">${w.note}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${w.status === 'active' ? `<button class="btn-ghost btn-xs" data-dismiss="${w.id}">${isEN ? 'Dismiss' : 'Ignorer'}</button>` : ''}
              <button class="btn-ghost btn-xs" data-del="${w.id}" aria-label="${isEN ? 'Delete' : 'Supprimer'}">×</button>
            </div>
          </div>
        </div>`;
    }).join('');

    $('#wp-list').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      await deleteWatchpoint(b.dataset.del);
      refresh();
    }));
    $('#wp-list').querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', async () => {
      await markDismissed(b.dataset.dismiss);
      refresh();
    }));
  }

  viewEl.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    currentFilter = b.dataset.filter;
    refresh();
  }));

  $('#wp-save').addEventListener('click', async () => {
    const w = {
      type: $('#wp-type').value,
      ticker: $('#wp-ticker').value.trim().toUpperCase(),
      target: Number($('#wp-target').value) || null,
      eventDate: $('#wp-date').value || null,
      note: $('#wp-note').value.trim()
    };
    if (!w.note && !w.ticker) {
      toast(isEN ? 'Fill at least ticker or note' : 'Renseigne au moins ticker ou note', 'warning');
      return;
    }
    await saveWatchpoint(w);
    ['wp-ticker', 'wp-target', 'wp-date', 'wp-note'].forEach(id => $('#' + id).value = '');
    toast(isEN ? 'Watchpoint saved' : 'Point enregistré', 'success');
    refresh();
  });

  refresh();
}
