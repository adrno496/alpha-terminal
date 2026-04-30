// Module Projection multi-scénarios sur 5/10/20 ans avec inflation-adjusted.
// Utilise patrimoine actuel + épargne mensuelle (depuis Budget) + 3 scénarios (pessimiste/médian/optimiste).
import { $ } from '../core/utils.js';
import { getTotals } from '../core/wealth.js';
import { listBudgetEntries, getMonthlyTotals } from './budget.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';

const MODULE_ID = 'projection';

const SCENARIOS = {
  pessimistic: { label_fr: '😟 Pessimiste', label_en: '😟 Pessimistic', returnPct: 3,  inflationPct: 4 },
  median:      { label_fr: '😐 Médian',     label_en: '😐 Median',      returnPct: 7,  inflationPct: 2.5 },
  optimistic:  { label_fr: '😎 Optimiste',  label_en: '😎 Optimistic',  returnPct: 10, inflationPct: 2 }
};

// Projection avec contributions mensuelles + inflation
//   PV : valeur actuelle
//   monthlyContrib : épargne mensuelle
//   annualReturn / annualInflation : décimaux (0.07 / 0.02)
//   years : horizon
// Retourne valeur nominale + valeur en € constants (déflatée)
function project(PV, monthlyContrib, annualReturn, annualInflation, years) {
  const months = years * 12;
  const r = annualReturn / 12;
  const futureCurrent = r === 0 ? PV : PV * Math.pow(1 + r, months);
  const futureContribs = monthlyContrib > 0
    ? (r === 0 ? monthlyContrib * months : monthlyContrib * (Math.pow(1 + r, months) - 1) / r)
    : 0;
  const nominal = futureCurrent + futureContribs;
  const real = nominal / Math.pow(1 + annualInflation, years);
  return { nominal, real };
}

export async function renderProjectionView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '📊 Wealth Projection' : '📊 Projection patrimoine',
      isEN ? 'Project your wealth over 5/10/20 years across 3 scenarios (pessimistic, median, optimistic) with inflation adjustment.' : 'Projette ton patrimoine sur 5/10/20 ans selon 3 scénarios (pessimiste, médian, optimiste) avec ajustement inflation.',
      { moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">${isEN ? '⚙️ Settings' : '⚙️ Paramètres'}</div>
      <div class="field-row">
        <div class="field"><label class="field-label">${isEN ? 'Current wealth (€)' : 'Patrimoine actuel (€)'}</label><input id="proj-pv" class="input" type="number" step="1000" /></div>
        <div class="field"><label class="field-label">${isEN ? 'Monthly contribution (€)' : 'Épargne mensuelle (€)'}</label><input id="proj-contrib" class="input" type="number" step="50" /></div>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin:0;">${isEN ? 'Auto-filled from your wealth + budget. Editable.' : 'Pré-rempli depuis ton patrimoine + budget. Modifiable.'}</p>
    </div>

    <div id="proj-table" class="card"></div>
    <div id="proj-scenario-table" class="card"></div>
  `;

  // Auto-fill from wealth + budget
  const totals = await getTotals('EUR').catch(() => ({ total: 0 }));
  $('#proj-pv').value = Math.round(totals.total) || 100000;
  const ym = (new Date()).getFullYear() + '-' + String((new Date()).getMonth() + 1).padStart(2, '0');
  const budget = await listBudgetEntries({ month: ym }).catch(() => []);
  const bt = getMonthlyTotals(budget);
  $('#proj-contrib').value = Math.round(bt.epargne) || 500;

  $('#proj-pv').addEventListener('input', refresh);
  $('#proj-contrib').addEventListener('input', refresh);
  refresh();

  function refresh() {
    const pv = parseFloat($('#proj-pv').value) || 0;
    const contrib = parseFloat($('#proj-contrib').value) || 0;
    const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
    const horizons = [5, 10, 20, 30];

    // Tableau récap par scénario
    $('#proj-table').innerHTML = `
      <div class="card-title">📈 ${isEN ? 'Projected wealth (3 scenarios)' : 'Patrimoine projeté (3 scénarios)'}</div>
      <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px;">${isEN ? 'Horizon' : 'Horizon'}</th>
          ${Object.entries(SCENARIOS).map(([k, s]) => `<th style="text-align:right;padding:6px;">${isEN ? s.label_en : s.label_fr}<br><span style="font-size:10px;color:var(--text-muted);font-weight:400;">${s.returnPct}% ret · ${s.inflationPct}% inf</span></th>`).join('')}
        </tr></thead>
        <tbody>
          ${horizons.map(y => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:6px;font-weight:600;">${y} ${isEN ? 'years' : 'ans'}</td>
              ${Object.entries(SCENARIOS).map(([k, s]) => {
                const r = project(pv, contrib, s.returnPct / 100, s.inflationPct / 100, y);
                return `<td style="padding:6px;text-align:right;font-family:var(--font-mono);">
                  <div style="font-weight:600;">${fmt(r.nominal)} €</div>
                  <div style="font-size:10px;color:var(--text-muted);">${fmt(r.real)} € ${isEN ? 'real' : 'réel'}</div>
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">
        ${isEN ? '<strong>Real value</strong> = inflation-adjusted, in today\'s purchasing power. Use this for honest comparison.' : '<strong>Valeur réelle</strong> = déflatée de l\'inflation, en pouvoir d\'achat d\'aujourd\'hui. Plus honnête pour comparer.'}
      </p>
    `;

    // Détail médian par année
    const median = SCENARIOS.median;
    $('#proj-scenario-table').innerHTML = `
      <div class="card-title">📊 ${isEN ? 'Year-by-year (median scenario)' : 'Année par année (scénario médian)'}</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px;">${isEN ? 'Year' : 'Année'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Nominal €' : 'Nominal €'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Real €' : 'Réel €'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Cumulated contributions €' : 'Versements cumulés €'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Gain €' : 'Plus-value €'}</th>
        </tr></thead>
        <tbody>
          ${Array.from({ length: 30 }, (_, i) => i + 1).map(y => {
            const r = project(pv, contrib, median.returnPct / 100, median.inflationPct / 100, y);
            const cumulContrib = contrib * y * 12;
            const totalIn = pv + cumulContrib;
            const gain = r.nominal - totalIn;
            return `<tr style="border-bottom:1px solid var(--border);${y % 5 === 0 ? 'background:var(--bg-tertiary);' : ''}">
              <td style="padding:5px;">${y}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${fmt(r.nominal)}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:var(--text-muted);">${fmt(r.real)}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${fmt(cumulContrib)}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:var(--accent-green);">+${fmt(gain)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }
}
