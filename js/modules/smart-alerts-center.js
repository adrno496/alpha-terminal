// 🔔 Smart Alerts Center — vue centralisée de toutes les alertes : prix, watchpoints, événements
import { $ } from '../core/utils.js';
import { listWatchpoints, markDismissed } from '../core/watchpoints.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { openWithMinVersion } from '../core/db-open.js';

const MODULE_ID = 'smart-alerts-center';

async function gatherAlerts() {
  const out = [];
  // 1. Watchpoints triggered
  try {
    const wps = await listWatchpoints({ status: 'triggered' });
    for (const w of wps) {
      out.push({
        id: 'wp-' + w.id,
        source: 'watchpoint',
        priority: 'high',
        icon: '🔔',
        title: `${w.ticker || ''} : ${w.note || w.type}`,
        desc: `Cible ${w.target} · déclenché ${w.triggeredAt?.slice(0, 10)}`,
        timestamp: w.triggeredAt,
        actions: [{ id: 'dismiss', label: 'Ignorer', _wpId: w.id }]
      });
    }
  } catch {}
  // 2. Watchpoints actifs (rappel)
  try {
    const active = await listWatchpoints({ status: 'active' });
    for (const w of active) {
      out.push({
        id: 'wpa-' + w.id,
        source: 'watchpoint',
        priority: 'medium',
        icon: w.type === 'ipo' ? '🚀' : w.type === 'event' ? '📅' : '📌',
        title: `${w.ticker || ''} ${w.target ? `cible ${w.target}` : ''}`,
        desc: w.note || w.type,
        timestamp: w.createdAt
      });
    }
  } catch {}
  // 3. Price alerts depuis IDB price_alerts
  try {
    const db = await openWithMinVersion('alpha-terminal', 10, () => {});
    if (db.objectStoreNames.contains('price_alerts')) {
      const store = db.transaction('price_alerts').objectStore('price_alerts');
      const all = await new Promise((res, rej) => {
        const acc = []; const c = store.openCursor();
        c.onsuccess = (e) => {
          const cur = e.target.result;
          if (!cur) return res(acc);
          acc.push(cur.value); cur.continue();
        };
        c.onerror = () => rej(c.error);
      });
      for (const a of all) {
        if (a.status === 'dismissed' || a.status === 'done') continue;
        out.push({
          id: 'pa-' + a.id,
          source: 'price-alert',
          priority: a.status === 'triggered' ? 'high' : 'medium',
          icon: a.status === 'triggered' ? '🚨' : '🚨',
          title: `${a.ticker || ''} ${a.type || ''} ${a.price || ''}`,
          desc: a.note || a.source || '',
          timestamp: a.createdAt
        });
      }
    }
  } catch {}
  // Tri : haute priorité d'abord, puis date desc
  const order = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => {
    const p = (order[a.priority] || 9) - (order[b.priority] || 9);
    if (p !== 0) return p;
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });
  return out;
}

function badge(p) {
  const x = ({ high: ['var(--accent-red)', 'URGENT'], medium: ['var(--accent-orange)', 'IMPORTANT'], low: ['var(--accent-blue)', 'INFO'] })[p] || ['var(--text-muted)', '-'];
  return `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${x[0]};color:#000;font-weight:700;">${x[1]}</span>`;
}

export async function renderSmartAlertsCenterView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🔔 ' + t('mod.smart-alerts-center.label'), t('mod.smart-alerts-center.desc'), { moduleId: MODULE_ID })}
    <div id="sac-list" class="card"><div style="color:var(--text-muted);">${isEN ? 'Loading alerts...' : 'Chargement...'}</div></div>
  `;
  async function refresh() {
    const alerts = await gatherAlerts();
    const counts = alerts.reduce((acc, a) => { acc[a.priority] = (acc[a.priority] || 0) + 1; return acc; }, {});
    $('#sac-list').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <strong style="font-size:14px;">${alerts.length} ${isEN ? 'alert(s)' : 'alerte(s)'}</strong>
        <span style="font-size:12px;color:var(--text-muted);">
          ${counts.high ? `🔴 ${counts.high} urgent` : ''}
          ${counts.medium ? ` 🟠 ${counts.medium}` : ''}
          ${counts.low ? ` 🔵 ${counts.low}` : ''}
        </span>
      </div>
      ${alerts.length === 0
        ? `<div style="color:var(--text-muted);padding:20px;text-align:center;">${isEN ? '🎉 No alert. Add watchpoints / price alerts to be notified.' : '🎉 Aucune alerte. Ajoute des points de surveillance / alertes prix pour être prévenu.'}</div>`
        : alerts.map(a => `
          <div style="display:flex;gap:10px;padding:10px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;align-items:flex-start;">
            <div style="font-size:20px;">${a.icon}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px;">
                ${badge(a.priority)}
                <span style="font-size:11px;color:var(--text-muted);">[${a.source}]</span>
              </div>
              <div style="font-size:14px;font-weight:600;">${a.title}</div>
              ${a.desc ? `<div style="font-size:12px;color:var(--text-secondary);">${a.desc}</div>` : ''}
            </div>
            ${a.actions ? a.actions.map(ac => `<button class="btn-ghost btn-xs" data-act="${ac.id}" data-id="${ac._wpId || ''}">${ac.label}</button>`).join('') : ''}
          </div>
        `).join('')}
    `;
    $('#sac-list').querySelectorAll('[data-act="dismiss"]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id;
      if (id) await markDismissed(id);
      refresh();
    }));
  }
  refresh();
}
