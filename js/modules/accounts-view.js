// Vue agrégée par compte bancaire / courtier — utilise le champ `account` du wealth holding.
import { $ } from '../core/utils.js';
import { listWealth, WEALTH_CATEGORIES } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';

const MODULE_ID = 'accounts-view';

export async function renderAccountsViewView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '🏦 Accounts View' : '🏦 Vue par compte',
      isEN ? 'Aggregate view of your wealth grouped by bank account / broker.' : 'Vue agrégée du patrimoine groupé par compte bancaire / courtier.',
      { moduleId: MODULE_ID })}

    <div id="acc-summary" class="card">${isEN ? '⏳ Loading…' : '⏳ Chargement…'}</div>
    <div id="acc-list"></div>
  `;

  const list = await listWealth().catch(() => []);
  const grouped = {};
  let totalWealth = 0;
  for (const h of list) {
    const acc = (h.account || '').trim() || (isEN ? '(unspecified)' : '(non renseigné)');
    grouped[acc] = grouped[acc] || { total: 0, holdings: [], byCategory: {} };
    const v = Number(h.value) || 0;
    grouped[acc].total += v;
    grouped[acc].holdings.push(h);
    const cat = h.category || 'other';
    grouped[acc].byCategory[cat] = (grouped[acc].byCategory[cat] || 0) + v;
    totalWealth += v;
  }
  const accounts = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);

  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  $('#acc-summary').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'Summary' : 'Synthèse'}</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${isEN ? 'Accounts/Brokers' : 'Comptes/Courtiers'}</div><div class="stat-value">${accounts.length}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Total holdings' : 'Total positions'}</div><div class="stat-value">${list.length}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Total wealth' : 'Patrimoine total'}</div><div class="stat-value green">${fmt(totalWealth)} €</div></div>
    </div>
  `;

  if (accounts.length === 0) {
    $('#acc-list').innerHTML = `<div class="card" style="text-align:center;color:var(--text-muted);padding:30px;">${isEN ? 'No holdings yet.' : 'Aucune position.'}</div>`;
    return;
  }

  $('#acc-list').innerHTML = accounts.map(([accName, data]) => {
    const pct = totalWealth > 0 ? (data.total / totalWealth * 100) : 0;
    const catBreakdown = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).map(([catId, v]) => {
      const cat = WEALTH_CATEGORIES.find(c => c.id === catId);
      return `${cat?.icon || '·'} ${cat?.label || catId} : <strong>${fmt(v)} €</strong>`;
    }).join(' · ');
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:14px;font-weight:600;">🏦 ${escape(accName)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${data.holdings.length} ${isEN ? 'holdings' : 'positions'} · ${pct.toFixed(1)}% ${isEN ? 'of total wealth' : 'du patrimoine'}</div>
          </div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--accent-green);">${fmt(data.total)} €</div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">${catBreakdown}</div>
        <details style="margin-top:8px;font-size:12px;">
          <summary style="cursor:pointer;color:var(--text-muted);">${isEN ? 'Show holdings' : 'Voir les positions'}</summary>
          <ul style="margin:6px 0 0 18px;line-height:1.7;">
            ${data.holdings.sort((a, b) => (b.value || 0) - (a.value || 0)).map(h => {
              const cat = WEALTH_CATEGORIES.find(c => c.id === h.category);
              return `<li>${cat?.icon || '·'} <strong>${escape(h.name)}</strong>${h.ticker ? ` <code>${escape(h.ticker)}</code>` : ''} : ${fmt(h.value || 0)} ${({USD:'$',EUR:'€',GBP:'£'})[h.currency] || h.currency || '€'}</li>`;
            }).join('')}
          </ul>
        </details>
      </div>
    `;
  }).join('');
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
