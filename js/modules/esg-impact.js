// ESG / Impact Investing — score ESG par holding (heuristique embarquée + saisie manuelle)
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'esg-impact';

// Scores ESG approximatifs (sources publiques : MSCI ESG, Sustainalytics moyennes 2024)
// 0-100 : >70 leader, 50-70 average, <50 laggard
const ESG_DB = {
  // Tech
  AAPL: { e: 70, s: 75, g: 80, controversy: 'Low', carbon: 'Low' },
  MSFT: { e: 85, s: 80, g: 85, controversy: 'Low', carbon: 'Very low' },
  GOOGL:{ e: 75, s: 65, g: 70, controversy: 'Medium (antitrust)', carbon: 'Low' },
  META: { e: 55, s: 35, g: 50, controversy: 'High (data privacy)', carbon: 'Medium' },
  AMZN: { e: 50, s: 40, g: 60, controversy: 'High (labor)', carbon: 'High' },
  NVDA: { e: 70, s: 65, g: 70, controversy: 'Low', carbon: 'Medium' },
  TSLA: { e: 85, s: 45, g: 30, controversy: 'High (governance)', carbon: 'Very low (EVs)' },
  // Energy
  TTE:  { e: 30, s: 50, g: 65, controversy: 'High (oil)', carbon: 'Very high' },
  XOM:  { e: 25, s: 40, g: 55, controversy: 'High (oil)', carbon: 'Very high' },
  SHEL: { e: 35, s: 50, g: 60, controversy: 'High (oil)', carbon: 'Very high' },
  // Consumer FR
  MC:   { e: 60, s: 75, g: 70, controversy: 'Low', carbon: 'Medium' },
  OR:   { e: 75, s: 80, g: 75, controversy: 'Low', carbon: 'Low' },
  RMS:  { e: 65, s: 75, g: 70, controversy: 'Low', carbon: 'Low' },
  KER:  { e: 70, s: 75, g: 70, controversy: 'Low', carbon: 'Low' },
  // Banks
  BNP:  { e: 65, s: 60, g: 65, controversy: 'Medium (fossil financing)', carbon: 'Medium' },
  GLE:  { e: 60, s: 55, g: 60, controversy: 'Medium', carbon: 'Medium' },
  // Industrial
  AIR:  { e: 55, s: 60, g: 65, controversy: 'Medium (defense)', carbon: 'Medium' },
  SAF:  { e: 50, s: 60, g: 60, controversy: 'Medium (defense)', carbon: 'Medium' },
  // ETF World ~ moyenne marché
  IWDA: { e: 60, s: 60, g: 65, controversy: 'Mixed', carbon: 'Medium' },
  VWCE: { e: 60, s: 60, g: 65, controversy: 'Mixed', carbon: 'Medium' },
  CW8:  { e: 60, s: 60, g: 65, controversy: 'Mixed', carbon: 'Medium' }
};

function lookupESG(ticker) {
  const tk = (ticker || '').toUpperCase().replace(/\.[A-Z]+$/, '');
  return ESG_DB[tk] || null;
}

function classify(score) {
  if (score >= 70) return { label: 'Leader', color: 'var(--accent-green)' };
  if (score >= 50) return { label: 'Average', color: 'var(--accent-orange)' };
  return { label: 'Laggard', color: 'var(--accent-red)' };
}

export async function renderEsgImpactView(viewEl) {
  const isEN = getLocale() === 'en';
  const wealth = await listWealth().catch(() => []);
  const stocks = wealth.filter(h => h.ticker && (h.category === 'stocks' || h.category === 'etf'));

  const rows = stocks.map(h => {
    const esg = lookupESG(h.ticker);
    if (!esg) return { ticker: h.ticker, name: h.name, value: h.value || 0, total: null, esg: null };
    const total = Math.round((esg.e + esg.s + esg.g) / 3);
    return { ticker: h.ticker, name: h.name, value: h.value || 0, total, esg };
  });

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const weightedAvg = totalValue > 0 ? rows.filter(r => r.total).reduce((s, r) => s + r.total * (r.value / totalValue), 0) : 0;
  const fossilExposure = rows.filter(r => r.esg && r.esg.carbon.includes('Very high')).reduce((s, r) => s + r.value, 0);
  const fossilPct = totalValue > 0 ? (fossilExposure / totalValue) * 100 : 0;

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.esg-impact.label'), t('mod.esg-impact.desc'), { example: '', moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">🌍 ${isEN ? 'Portfolio ESG snapshot' : 'Aperçu ESG du portefeuille'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:13px;margin-bottom:14px;">
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Weighted ESG score' : 'Score ESG pondéré'}</div><div style="font-size:24px;font-weight:700;font-family:var(--font-mono);color:${classify(weightedAvg).color};">${weightedAvg.toFixed(0)}/100</div><div style="font-size:11px;">${classify(weightedAvg).label}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Fossil exposure' : 'Exposition fossile'}</div><div style="font-size:24px;font-weight:700;font-family:var(--font-mono);color:${fossilPct > 5 ? 'var(--accent-red)' : 'var(--accent-green)'};">${fossilPct.toFixed(1)}%</div><div style="font-size:11px;">${fossilPct > 5 ? (isEN ? 'High' : 'Élevée') : (isEN ? 'Low' : 'Faible')}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:6px;"><div style="color:var(--text-muted);font-size:11px;">${isEN ? 'Coverage' : 'Couverture'}</div><div style="font-size:24px;font-weight:700;font-family:var(--font-mono);">${rows.filter(r => r.total).length}/${rows.length}</div><div style="font-size:11px;">${isEN ? 'positions analyzed' : 'positions analysées'}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📋 ${isEN ? 'Holdings detail' : 'Détail par position'}</div>
      <table style="width:100%;font-size:13px;">
        <thead><tr style="color:var(--text-muted);text-align:right;"><th style="text-align:left;">Ticker</th><th>E</th><th>S</th><th>G</th><th>Total</th><th>${isEN ? 'Carbon' : 'Carbone'}</th><th>${isEN ? 'Controversy' : 'Controverses'}</th></tr></thead>
        <tbody>
          ${rows.map(r => r.esg ?
            `<tr style="text-align:right;font-family:var(--font-mono);"><td style="text-align:left;font-family:var(--font-sans);"><strong>${r.ticker}</strong></td><td>${r.esg.e}</td><td>${r.esg.s}</td><td>${r.esg.g}</td><td style="font-weight:700;color:${classify(r.total).color};">${r.total}</td><td style="text-align:left;font-size:11px;">${r.esg.carbon}</td><td style="text-align:left;font-size:11px;">${r.esg.controversy}</td></tr>` :
            `<tr><td><strong>${r.ticker}</strong></td><td colspan="6" style="color:var(--text-muted);font-size:11px;">${isEN ? 'No ESG data — add SRI ETFs (e.g. SUSW) for verified coverage' : 'Pas de data ESG — ajoute des ETF ISR (ex: SUSW) pour couverture vérifiée'}</td></tr>`
          ).join('')}
        </tbody>
      </table>
      <div style="margin-top:10px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;">
        💡 ${isEN ? 'Source: heuristic averages from MSCI ESG, Sustainalytics 2024. SFDR-compliant funds (Art. 8/9) provide verified scores.' : 'Source : moyennes heuristiques MSCI ESG, Sustainalytics 2024. Les fonds Art. 8/9 SFDR fournissent des scores vérifiés.'}
      </div>
    </div>
  `;
}
