// Asset Correlation Matrix — corrélations approchées par classe d'actifs / secteur sur historique typique
import { listWealth, getEffectiveValue } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'correlation-matrix';

// Matrice de corrélation type entre classes d'actifs (moyennes long terme, sources : MSCI, BlackRock, Vanguard)
const CLASS_CORR = {
  equity_us:    { equity_us: 1.00, equity_eu: 0.85, equity_em: 0.78, bonds: -0.10, gold: 0.05, crypto: 0.40, real_estate: 0.55 },
  equity_eu:    { equity_us: 0.85, equity_eu: 1.00, equity_em: 0.80, bonds: -0.05, gold: 0.10, crypto: 0.35, real_estate: 0.50 },
  equity_em:    { equity_us: 0.78, equity_eu: 0.80, equity_em: 1.00, bonds:  0.05, gold: 0.15, crypto: 0.45, real_estate: 0.45 },
  bonds:        { equity_us:-0.10, equity_eu:-0.05, equity_em: 0.05, bonds:  1.00, gold: 0.25, crypto: -0.05, real_estate: 0.20 },
  gold:         { equity_us: 0.05, equity_eu: 0.10, equity_em: 0.15, bonds:  0.25, gold: 1.00, crypto: 0.20, real_estate: 0.15 },
  crypto:       { equity_us: 0.40, equity_eu: 0.35, equity_em: 0.45, bonds: -0.05, gold: 0.20, crypto: 1.00, real_estate: 0.25 },
  real_estate:  { equity_us: 0.55, equity_eu: 0.50, equity_em: 0.45, bonds:  0.20, gold: 0.15, crypto: 0.25, real_estate: 1.00 }
};

const CLASS_LABELS = { equity_us: 'Actions US', equity_eu: 'Actions Europe', equity_em: 'Émergents', bonds: 'Obligations', gold: 'Or/Métaux', crypto: 'Crypto', real_estate: 'Immobilier' };

function holdingClass(h) {
  if (h.category === 'crypto') return 'crypto';
  if (h.category === 'bonds') return 'bonds';
  if (h.category === 'commodities') return 'gold';
  if (h.category === 'real_estate') return 'real_estate';
  const tk = (h.ticker || '').toUpperCase();
  if (/CSPX|VUAA|SPY|QQQ|VOO|IVV|PE500/.test(tk)) return 'equity_us';
  if (/MEUD|ESE|EUE/.test(tk)) return 'equity_eu';
  if (/EIMI|VWO|AEEM/.test(tk)) return 'equity_em';
  if (/IWDA|VWCE|CW8/.test(tk)) return 'equity_us'; // World ~70% US
  if (/\.PA$|\.DE$|\.MI$/.test(tk)) return 'equity_eu';
  if (/\.HK$|\.SS$|\.SZ$/.test(tk)) return 'equity_em';
  return 'equity_us';
}

function corrColor(c) {
  if (c >= 0.7) return '#ff5555';
  if (c >= 0.4) return '#ff8c42';
  if (c >= 0.1) return '#ffd166';
  if (c >= -0.1) return '#aaaaaa';
  return '#06d6a0';
}

export async function renderCorrelationMatrixView(viewEl) {
  const isEN = getLocale() === 'en';
  const wealth = await listWealth().catch(() => []);
  // Group portfolio by class
  const byClass = {};
  let total = 0;
  for (const h of wealth) {
    const c = holdingClass(h);
    const v = getEffectiveValue(h);
    byClass[c] = (byClass[c] || 0) + v;
    total += v;
  }
  const classes = Object.keys(byClass).filter(c => byClass[c] > 0);
  // Average portfolio correlation (weighted)
  let avgCorr = 0, weightSum = 0;
  for (const a of classes) {
    for (const b of classes) {
      if (a === b) continue;
      const wA = byClass[a] / total, wB = byClass[b] / total;
      avgCorr += (CLASS_CORR[a]?.[b] ?? 0) * wA * wB;
      weightSum += wA * wB;
    }
  }
  const avgPortfolioCorr = weightSum > 0 ? avgCorr / weightSum : 0;

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.correlation-matrix.label'), t('mod.correlation-matrix.desc'), { example: '', moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">🌡️ ${isEN ? 'Heatmap (long-term)' : 'Heatmap (long terme)'}</div>
      <div style="overflow-x:auto;">
        <table style="border-collapse:collapse;font-family:var(--font-mono);font-size:12px;">
          <thead><tr><th></th>${Object.keys(CLASS_CORR).map(c => `<th style="padding:6px;color:var(--text-muted);">${CLASS_LABELS[c]}</th>`).join('')}</tr></thead>
          <tbody>
            ${Object.keys(CLASS_CORR).map(a => `<tr><td style="padding:6px;color:var(--text-muted);font-weight:600;">${CLASS_LABELS[a]}</td>${Object.keys(CLASS_CORR).map(b => { const v = CLASS_CORR[a][b]; return `<td style="padding:8px;text-align:center;background:${corrColor(v)};color:#000;font-weight:700;border:1px solid var(--border);">${v.toFixed(2)}</td>`; }).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">
        ${isEN ? 'Source: long-term averages (MSCI, BlackRock, Vanguard). Real correlations vary by period — they spike to ~1.0 in market crashes.' : 'Source : moyennes long terme (MSCI, BlackRock, Vanguard). Les corrélations réelles varient selon la période — elles tendent vers 1.0 en krach.'}
      </div>
    </div>
    ${classes.length > 0 ? `
    <div class="card">
      <div class="card-title">📈 ${isEN ? 'Your portfolio average correlation' : 'Corrélation moyenne de ton portefeuille'}</div>
      <div style="font-size:32px;font-family:var(--font-mono);font-weight:700;color:${corrColor(avgPortfolioCorr)};">${avgPortfolioCorr.toFixed(2)}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">
        ${avgPortfolioCorr > 0.7 ? (isEN ? '🚨 Highly correlated — your assets move together. Limited diversification.' : '🚨 Très corrélé — tes actifs bougent ensemble. Diversification limitée.') :
          avgPortfolioCorr > 0.4 ? (isEN ? '⚠️ Moderately correlated. Add bonds, gold or alternative assets for true diversification.' : '⚠️ Corrélation modérée. Ajoute obligations, or ou alternatifs pour vraie diversification.') :
          (isEN ? '✅ Well diversified — assets behave independently in most regimes.' : '✅ Bien diversifié — les actifs réagissent indépendamment dans la plupart des régimes.')}
      </div>
      <div style="margin-top:10px;font-size:13px;">
        ${classes.map(c => `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${CLASS_LABELS[c]}</span><span style="font-family:var(--font-mono);color:var(--text-muted);">${(byClass[c] / total * 100).toFixed(1)}%</span></div>`).join('')}
      </div>
    </div>` : ''}
  `;
}
