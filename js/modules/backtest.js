// Backtest Module — simule DCA / lump-sum / rebalancing avec données historiques embarquées (1990-2025)
import { $ } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'backtest';

// Returns annuels historiques (% total return en USD/EUR mix, source publique : Wikipedia / S&P, MSCI factsheets, CAC 40 GR)
// Approximations arrondies à 0.1% — pour démo / éducatif uniquement
export const HISTORICAL_RETURNS = {
  sp500: { // S&P 500 Total Return (USD)
    label: 'S&P 500',
    returns: { 1990:-3.1,1991:30.5,1992:7.6,1993:10.1,1994:1.3,1995:37.6,1996:23.0,1997:33.4,1998:28.6,1999:21.0,
      2000:-9.1,2001:-11.9,2002:-22.1,2003:28.7,2004:10.9,2005:4.9,2006:15.8,2007:5.5,2008:-37.0,2009:26.5,
      2010:15.1,2011:2.1,2012:16.0,2013:32.4,2014:13.7,2015:1.4,2016:12.0,2017:21.8,2018:-4.4,2019:31.5,
      2020:18.4,2021:28.7,2022:-18.1,2023:26.3,2024:25.0,2025:8.0 }
  },
  msci_world: {
    label: 'MSCI World',
    returns: { 1990:-17.0,1991:18.3,1992:-5.2,1993:22.5,1994:5.1,1995:20.7,1996:13.5,1997:15.8,1998:24.3,1999:24.9,
      2000:-13.2,2001:-16.8,2002:-19.9,2003:33.1,2004:14.7,2005:9.5,2006:20.1,2007:9.0,2008:-40.7,2009:30.0,
      2010:11.8,2011:-5.5,2012:15.8,2013:26.7,2014:4.9,2015:-0.9,2016:7.5,2017:22.4,2018:-8.7,2019:27.7,
      2020:15.9,2021:21.8,2022:-18.1,2023:23.8,2024:18.7,2025:6.0 }
  },
  cac40_gr: {
    label: 'CAC 40 GR',
    returns: { 1990:-15.0,1991:11.4,1992:5.3,1993:22.2,1994:-17.1,1995:-0.5,1996:23.7,1997:29.5,1998:31.5,1999:51.1,
      2000:-0.5,2001:-22.0,2002:-33.7,2003:16.1,2004:7.4,2005:23.4,2006:17.5,2007:1.3,2008:-42.7,2009:22.3,
      2010:-3.3,2011:-16.9,2012:15.2,2013:18.0,2014:-0.5,2015:8.5,2016:4.9,2017:9.3,2018:-11.0,2019:26.4,
      2020:-7.1,2021:28.9,2022:-9.5,2023:16.5,2024:-2.2,2025:5.5 }
  },
  bonds_eu: {
    label: 'Bonds Eurozone (Agg)',
    returns: { 1990:8.0,1991:9.8,1992:9.4,1993:10.1,1994:-3.8,1995:13.2,1996:8.1,1997:5.9,1998:8.8,1999:-2.3,
      2000:5.4,2001:5.6,2002:9.0,2003:4.0,2004:7.6,2005:5.4,2006:-0.5,2007:1.6,2008:9.1,2009:4.5,
      2010:1.0,2011:3.3,2012:11.2,2013:2.2,2014:11.1,2015:1.0,2016:3.3,2017:0.7,2018:0.4,2019:6.0,
      2020:4.0,2021:-2.9,2022:-17.2,2023:7.2,2024:2.5,2025:1.5 }
  },
  bitcoin: {
    label: 'Bitcoin (BTC)',
    returns: { 2011:1473,2012:186,2013:5507,2014:-58,2015:35,2016:125,2017:1331,2018:-73,2019:95,
      2020:303,2021:60,2022:-65,2023:155,2024:121,2025:35 }
  }
};

const DEFAULT_PORTFOLIOS = {
  '100_world':   { label: { fr: '100% MSCI World', en: '100% MSCI World' }, weights: { msci_world: 1 } },
  '60_40':       { label: { fr: '60/40 (Actions/Obligations)', en: '60/40 (Stocks/Bonds)' }, weights: { msci_world: 0.6, bonds_eu: 0.4 } },
  '80_20':       { label: { fr: '80/20 dynamique', en: '80/20 growth' }, weights: { msci_world: 0.8, bonds_eu: 0.2 } },
  'sp500_pure':  { label: { fr: '100% S&P 500', en: '100% S&P 500' }, weights: { sp500: 1 } },
  'cac_pure':    { label: { fr: '100% CAC 40 GR', en: '100% CAC 40 GR' }, weights: { cac40_gr: 1 } },
  'world_btc':   { label: { fr: '90% World + 10% BTC', en: '90% World + 10% BTC' }, weights: { msci_world: 0.9, bitcoin: 0.1 } }
};

// === Engine ===

function blendedAnnualReturn(weights, year) {
  let r = 0, totalW = 0;
  for (const [key, w] of Object.entries(weights)) {
    const ret = HISTORICAL_RETURNS[key]?.returns?.[year];
    if (ret === undefined) continue; // si pas de data, on skip cette portion
    r += (ret / 100) * w;
    totalW += w;
  }
  return totalW > 0 ? r * (1 / totalW) : 0; // normalisation si data partielle
}

// Backtest DCA mensuel : depositMonthly chaque mois, compose au taux annuel divisé en 12
export function backtestDCA({ weights, startYear, endYear, monthlyAmount, initialCapital = 0 }) {
  let value = initialCapital;
  let invested = initialCapital;
  const yearlyHistory = [];
  for (let year = startYear; year <= endYear; year++) {
    const annR = blendedAnnualReturn(weights, year);
    const monthlyR = Math.pow(1 + annR, 1 / 12) - 1;
    for (let m = 0; m < 12; m++) {
      value = value * (1 + monthlyR) + monthlyAmount;
      invested += monthlyAmount;
    }
    yearlyHistory.push({ year, value: Math.round(value), invested: Math.round(invested), annualReturn: annR * 100 });
  }
  return {
    finalValue: Math.round(value),
    invested: Math.round(invested),
    gain: Math.round(value - invested),
    cagr: invested > 0 ? (Math.pow(value / invested, 1 / (endYear - startYear + 1)) - 1) * 100 : 0,
    multiple: invested > 0 ? value / invested : 0,
    history: yearlyHistory
  };
}

// Lump sum : place tout au début, ne réinvestit pas
export function backtestLumpSum({ weights, startYear, endYear, capital }) {
  let value = capital;
  const yearlyHistory = [];
  for (let year = startYear; year <= endYear; year++) {
    const annR = blendedAnnualReturn(weights, year);
    value = value * (1 + annR);
    yearlyHistory.push({ year, value: Math.round(value), annualReturn: annR * 100 });
  }
  return {
    finalValue: Math.round(value),
    invested: capital,
    gain: Math.round(value - capital),
    cagr: capital > 0 ? (Math.pow(value / capital, 1 / (endYear - startYear + 1)) - 1) * 100 : 0,
    multiple: value / capital,
    history: yearlyHistory
  };
}

// Drawdown max
function maxDrawdown(history) {
  let peak = 0, maxDD = 0;
  for (const h of history) {
    if (h.value > peak) peak = h.value;
    const dd = peak > 0 ? (peak - h.value) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function fmtEUR(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €'; }
function fmtPct(n) { return (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%'; }

export function renderBacktestView(viewEl) {
  const isEN = getLocale() === 'en';
  const lang = isEN ? 'en' : 'fr';

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.backtest.label'), t('mod.backtest.desc'), { example: t('mod.backtest.example'), moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">⚙️ ${isEN ? 'Strategy parameters' : 'Paramètres de stratégie'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-size:13px;">
        <label>${isEN ? 'Strategy' : 'Stratégie'}
          <select id="bt-strat">
            <option value="dca">${isEN ? 'DCA (monthly)' : 'DCA (mensuel)'}</option>
            <option value="lump">${isEN ? 'Lump sum (one-shot)' : 'Lump sum (one-shot)'}</option>
          </select>
        </label>
        <label>${isEN ? 'Portfolio' : 'Portefeuille'}
          <select id="bt-portfolio">
            ${Object.entries(DEFAULT_PORTFOLIOS).map(([k, p]) => `<option value="${k}">${p.label[lang]}</option>`).join('')}
          </select>
        </label>
        <label>${isEN ? 'Start year' : 'Année de début'}
          <input type="number" id="bt-start" value="2010" min="1990" max="2024" />
        </label>
        <label>${isEN ? 'End year' : 'Année de fin'}
          <input type="number" id="bt-end" value="2025" min="1991" max="2025" />
        </label>
        <label>${isEN ? 'Monthly amount (DCA)' : 'Montant mensuel (DCA)'}
          <input type="number" id="bt-monthly" value="200" />
        </label>
        <label>${isEN ? 'Initial capital' : 'Capital initial'}
          <input type="number" id="bt-initial" value="0" />
        </label>
      </div>
      <button class="btn-primary" id="bt-run" style="margin-top:12px;">${isEN ? 'Run backtest' : 'Lancer le backtest'}</button>
      <button class="btn-ghost" id="bt-compare" style="margin-top:12px;margin-left:8px;">${isEN ? 'Compare all portfolios' : 'Comparer tous les portefeuilles'}</button>
    </div>

    <div id="bt-result"></div>
  `;

  function runOne() {
    const strat = $('#bt-strat', viewEl).value;
    const portfolioKey = $('#bt-portfolio', viewEl).value;
    const startYear = Number($('#bt-start', viewEl).value);
    const endYear = Number($('#bt-end', viewEl).value);
    const monthly = Number($('#bt-monthly', viewEl).value) || 0;
    const initial = Number($('#bt-initial', viewEl).value) || 0;
    const portfolio = DEFAULT_PORTFOLIOS[portfolioKey];
    if (!portfolio || endYear < startYear) return;

    const r = strat === 'dca'
      ? backtestDCA({ weights: portfolio.weights, startYear, endYear, monthlyAmount: monthly, initialCapital: initial })
      : backtestLumpSum({ weights: portfolio.weights, startYear, endYear, capital: initial || monthly * 12 });
    const dd = maxDrawdown(r.history);

    $('#bt-result', viewEl).innerHTML = `
      <div class="card">
        <div class="card-title">📊 ${isEN ? 'Result' : 'Résultat'} — ${portfolio.label[lang]} (${startYear}–${endYear})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;font-size:13px;margin-bottom:14px;">
          <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Final value' : 'Valeur finale'}</div><div style="font-size:20px;font-weight:700;font-family:var(--font-mono);">${fmtEUR(r.finalValue)}</div></div>
          <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Invested' : 'Investi'}</div><div style="font-size:18px;font-family:var(--font-mono);">${fmtEUR(r.invested)}</div></div>
          <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Gain' : 'Gain'}</div><div style="font-size:18px;font-family:var(--font-mono);color:${r.gain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtEUR(r.gain)}</div></div>
          <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">CAGR</div><div style="font-size:18px;font-family:var(--font-mono);">${fmtPct(r.cagr)}</div></div>
          <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">Multiple</div><div style="font-size:18px;font-family:var(--font-mono);">×${r.multiple.toFixed(2)}</div></div>
          <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">Max DD</div><div style="font-size:18px;font-family:var(--font-mono);color:var(--accent-red);">-${dd.toFixed(1)}%</div></div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;font-size:12px;font-family:var(--font-mono);">
            <thead><tr style="color:var(--text-muted);text-align:right;"><th style="text-align:left;">${isEN ? 'Year' : 'Année'}</th><th>${isEN ? 'Annual return' : 'Perf annuelle'}</th><th>${isEN ? 'Invested' : 'Investi'}</th><th>${isEN ? 'Value' : 'Valeur'}</th></tr></thead>
            <tbody>
              ${r.history.map(h => `<tr style="text-align:right;"><td style="text-align:left;">${h.year}</td><td style="color:${h.annualReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(h.annualReturn)}</td><td>${fmtEUR(h.invested || 0)}</td><td><strong>${fmtEUR(h.value)}</strong></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function runCompare() {
    const strat = $('#bt-strat', viewEl).value;
    const startYear = Number($('#bt-start', viewEl).value);
    const endYear = Number($('#bt-end', viewEl).value);
    const monthly = Number($('#bt-monthly', viewEl).value) || 0;
    const initial = Number($('#bt-initial', viewEl).value) || 0;

    const rows = Object.entries(DEFAULT_PORTFOLIOS).map(([key, p]) => {
      const r = strat === 'dca'
        ? backtestDCA({ weights: p.weights, startYear, endYear, monthlyAmount: monthly, initialCapital: initial })
        : backtestLumpSum({ weights: p.weights, startYear, endYear, capital: initial || monthly * 12 });
      return { key, label: p.label[lang], ...r, dd: maxDrawdown(r.history) };
    }).sort((a, b) => b.finalValue - a.finalValue);

    $('#bt-result', viewEl).innerHTML = `
      <div class="card">
        <div class="card-title">🏆 ${isEN ? 'Portfolios comparison' : 'Comparaison des portefeuilles'} (${startYear}–${endYear})</div>
        <table style="width:100%;font-size:13px;font-family:var(--font-mono);">
          <thead><tr style="color:var(--text-muted);text-align:right;"><th style="text-align:left;">${isEN ? 'Portfolio' : 'Portefeuille'}</th><th>${isEN ? 'Final' : 'Final'}</th><th>Gain</th><th>CAGR</th><th>Max DD</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `<tr style="text-align:right;${i === 0 ? 'background:var(--bg-tertiary);' : ''}"><td style="text-align:left;">${i === 0 ? '🏆 ' : ''}${r.label}</td><td><strong>${fmtEUR(r.finalValue)}</strong></td><td style="color:${r.gain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtEUR(r.gain)}</td><td>${fmtPct(r.cagr)}</td><td style="color:var(--accent-red);">-${r.dd.toFixed(1)}%</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  $('#bt-run', viewEl).addEventListener('click', runOne);
  $('#bt-compare', viewEl).addEventListener('click', runCompare);

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#bt-strat', viewEl).value = 'dca';
    $('#bt-portfolio', viewEl).value = '100_world';
    $('#bt-start', viewEl).value = 2010;
    $('#bt-end', viewEl).value = 2025;
    $('#bt-monthly', viewEl).value = 200;
    runOne();
  });

  // Auto-run sur ouverture
  runOne();
}
