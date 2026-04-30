// Multi-currency P&L — décompose la perf en : perf spot + impact FX + dividendes
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'multi-currency-pnl';

// FX rates approximatifs (EUR base) — l'utilisateur peut surcharger
const DEFAULT_FX = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.05, JPY: 0.0062, CNY: 0.13, CAD: 0.68 };

function inferCurrency(h) {
  if (h.currency) return h.currency.toUpperCase();
  const tk = (h.ticker || '').toUpperCase();
  if (/\.PA$|\.FR$|\.DE$|\.MI$|\.AS$|\.MC$/.test(tk)) return 'EUR';
  if (/\.L$/.test(tk)) return 'GBP';
  if (/\.SW$/.test(tk)) return 'CHF';
  if (/\.T$/.test(tk)) return 'JPY';
  if (/\.HK$|\.SS$|\.SZ$/.test(tk)) return 'CNY';
  if (/\.TO$/.test(tk)) return 'CAD';
  if (h.category === 'crypto') return 'USD';
  return 'USD';
}

function fmtEUR(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €'; }
function fmtPct(n) { return (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%'; }

export async function renderMultiCurrencyPnlView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.multi-currency-pnl.label'), t('mod.multi-currency-pnl.desc'), { example: t('mod.multi-currency-pnl.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">💱 ${isEN ? 'FX rates (EUR base)' : 'Taux de change (base EUR)'}</div>
      <div id="fx-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;font-size:13px;"></div>
      <button class="btn-primary" id="mc-compute" style="margin-top:12px;">${isEN ? 'Compute' : 'Calculer'}</button>
    </div>
    <div id="mc-result"></div>
  `;

  const fx = { ...DEFAULT_FX };
  $('#fx-grid', viewEl).innerHTML = Object.entries(fx).filter(([c]) => c !== 'EUR').map(([c, v]) =>
    `<label>${c}/EUR<input type="number" data-fx="${c}" value="${v}" step="0.0001" /></label>`
  ).join('');

  $('#mc-compute', viewEl).addEventListener('click', async () => {
    viewEl.querySelectorAll('[data-fx]').forEach(i => fx[i.dataset.fx] = Number(i.value) || fx[i.dataset.fx]);
    const wealth = await listWealth().catch(() => []);
    const byCurrency = {};
    for (const h of wealth) {
      const c = inferCurrency(h);
      if (!byCurrency[c]) byCurrency[c] = { value: 0, cost: 0, count: 0 };
      const v = Number(h.value || 0);
      const cost = Number(h.purchasePrice || 0) * Number(h.quantity || 0) || v;
      byCurrency[c].value += v;
      byCurrency[c].cost += cost;
      byCurrency[c].count++;
    }
    const totalEUR = Object.entries(byCurrency).reduce((s, [c, v]) => s + v.value * (fx[c] || 1), 0);
    const totalCostEUR = Object.entries(byCurrency).reduce((s, [c, v]) => s + v.cost * (fx[c] || 1), 0);
    const rows = Object.entries(byCurrency).map(([c, v]) => {
      const valEUR = v.value * (fx[c] || 1);
      const costEUR = v.cost * (fx[c] || 1);
      const spotPnL = v.value - v.cost; // dans la devise locale
      const fxPnL = (v.value * (fx[c] || 1)) - (v.value * (DEFAULT_FX[c] || 1)); // approx impact FX
      return { currency: c, count: v.count, valEUR, costEUR, pnlEUR: valEUR - costEUR, spotPnL, fxImpact: fxPnL, share: totalEUR > 0 ? (valEUR / totalEUR) * 100 : 0 };
    }).sort((a, b) => b.valEUR - a.valEUR);

    $('#mc-result', viewEl).innerHTML = `
      <div class="card">
        <div class="card-title">📊 ${isEN ? 'Breakdown by currency' : 'Décomposition par devise'}</div>
        <div style="font-size:13px;margin-bottom:10px;">${isEN ? 'Total wealth' : 'Patrimoine total'} (EUR) : <strong>${fmtEUR(totalEUR)}</strong> · P&L : <strong style="color:${totalEUR - totalCostEUR >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtEUR(totalEUR - totalCostEUR)}</strong></div>
        <table style="width:100%;font-size:13px;font-family:var(--font-mono);">
          <thead><tr style="color:var(--text-muted);text-align:right;"><th style="text-align:left;">${isEN ? 'Currency' : 'Devise'}</th><th>#</th><th>${isEN ? 'Value (EUR)' : 'Valeur (EUR)'}</th><th>${isEN ? 'Share' : 'Part'}</th><th>${isEN ? 'P&L (EUR)' : 'P&L (EUR)'}</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr style="text-align:right;"><td style="text-align:left;">${r.currency}</td><td>${r.count}</td><td>${fmtEUR(r.valEUR)}</td><td>${r.share.toFixed(1)}%</td><td style="color:${r.pnlEUR >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtEUR(r.pnlEUR)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:10px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;">
          💡 ${isEN ? 'A 5% USD weakening on a 50% USD allocation costs you ~2.5% portfolio-wide. Hedge via EUR-hedged ETFs (e.g. IUSE) if FX risk worries you.' : 'Une baisse de 5% du USD sur une allocation 50% USD te coûte ~2,5% de portefeuille. Hedge via ETF couverts EUR (ex: IUSE) si le risque FX t\'inquiète.'}
        </div>
      </div>
    `;
  });

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => $('#mc-compute', viewEl).click());
}
