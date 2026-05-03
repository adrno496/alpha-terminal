// Portfolio Performance Attribution — décompose la perf en : allocation, sélection, devise
// Brinson model simplifié (allocation + selection effects)
import { listWealth, getEffectiveValue } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'performance-attribution';

// Benchmark sectoriel : poids cibles MSCI World et perf 12 mois (approx 2025)
const BENCHMARK = {
  tech:        { weight: 0.28, return: 0.32 },
  finance:     { weight: 0.15, return: 0.18 },
  healthcare:  { weight: 0.12, return: 0.05 },
  consumer:    { weight: 0.11, return: 0.12 },
  industrial:  { weight: 0.10, return: 0.15 },
  energy:      { weight: 0.05, return: -0.02 },
  bonds:       { weight: 0.00, return: 0.03 },
  crypto:      { weight: 0.00, return: 0.55 },
  real_estate: { weight: 0.05, return: 0.08 },
  other:       { weight: 0.14, return: 0.12 }
};

function inferSector(h) {
  if (h.category === 'crypto') return 'crypto';
  if (h.category === 'bonds') return 'bonds';
  if (h.category === 'real_estate') return 'real_estate';
  if (h.category === 'commodities') return 'other';
  const tk = (h.ticker || '').toUpperCase();
  const tech = ['AAPL','MSFT','GOOGL','GOOG','META','NVDA','TSLA','AMZN','NFLX','AMD','CRM','ORCL'];
  const finance = ['BNP.PA','GLE.PA','ACA.PA','CS.PA','JPM','BAC','GS','C','MS','V','MA'];
  const healthcare = ['SAN.PA','JNJ','PFE','MRK','UNH','LLY','ABBV'];
  const consumer = ['MC.PA','OR.PA','RMS.PA','KER.PA','MCD','KO','PEP'];
  const energy = ['TTE.PA','XOM','CVX','SHEL'];
  const industrial = ['AIR.PA','SAF.PA','HO.PA','SU.PA'];
  if (tech.includes(tk)) return 'tech';
  if (finance.includes(tk)) return 'finance';
  if (healthcare.includes(tk)) return 'healthcare';
  if (consumer.includes(tk)) return 'consumer';
  if (energy.includes(tk)) return 'energy';
  if (industrial.includes(tk)) return 'industrial';
  return 'other';
}

function fmtPct(n) { return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'; }

export async function renderPerformanceAttributionView(viewEl) {
  const isEN = getLocale() === 'en';
  const wealth = await listWealth().catch(() => []);

  const bySector = {};
  let total = 0;
  for (const h of wealth) {
    const s = inferSector(h);
    if (!bySector[s]) bySector[s] = { value: 0, cost: 0 };
    const ev = getEffectiveValue(h);
    bySector[s].value += ev;
    bySector[s].cost += (h.purchasePrice || 0) * (h.quantity || 0) || ev;
    total += ev;
  }

  // Compute portfolio return per sector vs benchmark
  const rows = [];
  let allocEffect = 0, selEffect = 0, totalReturn = 0;
  for (const [sector, agg] of Object.entries(bySector)) {
    const wPort = total > 0 ? agg.value / total : 0;
    const wBench = BENCHMARK[sector]?.weight ?? 0;
    const rBench = BENCHMARK[sector]?.return ?? 0;
    const rPort = agg.cost > 0 ? (agg.value - agg.cost) / agg.cost : 0;
    // Brinson : allocation = (wPort - wBench) × rBench ; selection = wPort × (rPort - rBench)
    const alloc = (wPort - wBench) * rBench;
    const sel = wPort * (rPort - rBench);
    allocEffect += alloc;
    selEffect += sel;
    totalReturn += wPort * rPort;
    rows.push({ sector, wPort, wBench, rPort, rBench, alloc, sel });
  }
  const benchReturn = Object.entries(BENCHMARK).reduce((s, [k, v]) => s + v.weight * v.return, 0);
  const totalAlpha = totalReturn - benchReturn;

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.performance-attribution.label'), t('mod.performance-attribution.desc'), { example: '', moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">🎯 ${isEN ? 'Brinson attribution (12-month TTM approx.)' : 'Attribution Brinson (perf 12 mois approx.)'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;font-size:13px;margin-bottom:14px;">
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Portfolio return' : 'Perf portefeuille'}</div><div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:${totalReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(totalReturn)}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Benchmark (MSCI World)' : 'Benchmark (MSCI World)'}</div><div style="font-size:22px;font-weight:700;font-family:var(--font-mono);">${fmtPct(benchReturn)}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">Alpha (${isEN ? 'excess' : 'écart'})</div><div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:${totalAlpha >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(totalAlpha)}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Allocation effect' : 'Effet allocation'}</div><div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${allocEffect >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(allocEffect)}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Selection effect' : 'Effet sélection'}</div><div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${selEffect >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(selEffect)}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📋 ${isEN ? 'By sector' : 'Par secteur'}</div>
      <table style="width:100%;font-size:13px;font-family:var(--font-mono);">
        <thead><tr style="color:var(--text-muted);text-align:right;"><th style="text-align:left;">${isEN ? 'Sector' : 'Secteur'}</th><th>w. Port</th><th>w. Bench</th><th>r. Port</th><th>r. Bench</th><th>Alloc</th><th>Sel</th></tr></thead>
        <tbody>
          ${rows.sort((a, b) => Math.abs(b.alloc + b.sel) - Math.abs(a.alloc + a.sel)).map(r => `<tr style="text-align:right;"><td style="text-align:left;font-family:var(--font-sans);">${r.sector}</td><td>${(r.wPort * 100).toFixed(1)}%</td><td>${(r.wBench * 100).toFixed(1)}%</td><td style="color:${r.rPort >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(r.rPort)}</td><td>${fmtPct(r.rBench)}</td><td style="color:${r.alloc >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(r.alloc)}</td><td style="color:${r.sel >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(r.sel)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:10px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;">
        💡 ${isEN ?
          '<strong>Allocation</strong>: did you over/under-weight the right sectors vs MSCI World? <strong>Selection</strong>: within each sector, did you pick winners vs the average?' :
          '<strong>Allocation</strong> : as-tu sur/sous-pondéré les bons secteurs vs MSCI World ? <strong>Sélection</strong> : dans chaque secteur, as-tu choisi les meilleurs vs la moyenne ?'}
      </div>
    </div>
  `;
}
