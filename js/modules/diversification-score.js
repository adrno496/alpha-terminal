// F3 — Score de diversification 0-100 : algo local pur (HHI + secteurs + géo + classes)
import { $ } from '../core/utils.js';
import { listWealth, WEALTH_CATEGORIES, getEffectiveValue } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { diversificationGauge } from '../ui/charts.js';

const MODULE_ID = 'diversification-score';

// Mapping category → assetClass macro (pour le scoring)
const CATEGORY_TO_CLASS = {
  stocks:     'equity',
  etf:        'equity',
  crypto:     'crypto',
  cash:       'cash',
  bonds:      'bonds',
  retirement: 'equity',
  real_estate:'real_estate',
  commodities:'gold',
  private:    'equity',
  other:      'other'
};

// Heuristique géo basée sur ticker/nom — minimaliste, l'utilisateur peut surcharger via champ `geography`
function inferGeography(holding) {
  if (holding.geography) return holding.geography;
  const t = (holding.ticker || '').toUpperCase();
  if (/\.PA$|\.FR$/.test(t)) return 'france';
  if (/\.DE$|\.MI$|\.AS$|\.MC$|\.SW$/.test(t)) return 'europe';
  if (/\.L$/.test(t)) return 'uk';
  if (/\.HK$|\.SS$|\.SZ$|\.T$|\.KS$/.test(t)) return 'asia';
  if (holding.category === 'crypto') return 'global';
  if (holding.category === 'real_estate') return 'france';
  // ETF World/All-World
  if (/IWDA|VWCE|CW8|EWLD/.test(t)) return 'global';
  if (/EIMI|AEEM/.test(t)) return 'emerging';
  if (/CSPX|VUAA|PE500/.test(t)) return 'us';
  if (/MEUD|ESE/.test(t)) return 'europe';
  // Default : US si rien (action en €/$ sans ticker spécifique)
  return holding.currency === 'USD' ? 'us' : 'unknown';
}

// Heuristique secteur — minimaliste
function inferSector(holding) {
  if (holding.sector) return holding.sector;
  const t = (holding.ticker || '').toUpperCase();
  const tech = ['AAPL','MSFT','GOOGL','GOOG','META','NVDA','TSLA','AMZN','NFLX','AMD','CRM','ORCL','DSY.PA','STMPA.PA','CAP.PA'];
  const finance = ['BNP.PA','GLE.PA','ACA.PA','CS.PA','JPM','BAC','GS','C','MS','V','MA'];
  const healthcare = ['SAN.PA','JNJ','PFE','MRK','UNH','LLY','ABBV'];
  const consumer = ['MC.PA','OR.PA','RMS.PA','KER.PA','DG.PA','EL.PA','RI.PA','MCD','KO','PEP'];
  const energy = ['TTE.PA','XOM','CVX','SHEL'];
  const industrial = ['AIR.PA','SAF.PA','HO.PA','SU.PA','ML.PA','VIE.PA','ENGI.PA'];
  if (tech.includes(t)) return 'tech';
  if (finance.includes(t)) return 'finance';
  if (healthcare.includes(t)) return 'healthcare';
  if (consumer.includes(t)) return 'consumer';
  if (energy.includes(t)) return 'energy';
  if (industrial.includes(t)) return 'industrial';
  if (holding.category === 'crypto') return 'crypto';
  if (holding.category === 'real_estate') return 'real_estate';
  if (holding.category === 'bonds') return 'bonds';
  if (holding.category === 'commodities') return 'commodities';
  if (/IWDA|VWCE|CW8|EWLD|CSPX|VUAA|PE500|EIMI|AEEM|MEUD|ESE/.test(t)) return 'diversified_etf';
  return 'unknown';
}

// === SCORING ===

export function computeDiversificationScore(holdings) {
  if (!holdings || holdings.length === 0) {
    return {
      total: 0,
      breakdown: { concentration: 0, sectors: 0, geography: 0, assetClasses: 0 },
      forces: [],
      weaknesses: ['Portefeuille vide'],
      recommendations: ['Ajoute tes premiers holdings dans Patrimoine pour calculer un score.'],
      stats: {}
    };
  }

  const totalValue = holdings.reduce((s, h) => s + getEffectiveValue(h), 0);
  if (totalValue === 0) {
    return {
      total: 0,
      breakdown: { concentration: 0, sectors: 0, geography: 0, assetClasses: 0 },
      forces: [],
      weaknesses: ['Toutes les positions ont une valeur nulle'],
      recommendations: ['Renseigne les valeurs de tes holdings pour calculer un score.'],
      stats: {}
    };
  }

  const weights = holdings.map(h => getEffectiveValue(h) / totalValue);

  // 1. CONCENTRATION (40 pts) — HHI + max position
  const hhi = weights.reduce((s, w) => s + w * w, 0); // 0..1
  const maxWeight = Math.max(...weights);
  let concentration = Math.max(0, Math.min(40, 40 - (hhi - 0.05) * 200));
  if (maxWeight > 0.30) concentration -= 10;
  if (maxWeight > 0.50) concentration -= 20;
  concentration = Math.max(0, Math.round(concentration));

  // 2. SECTEURS (20 pts)
  const bySector = {};
  for (const h of holdings) {
    const s = inferSector(h);
    bySector[s] = (bySector[s] || 0) + getEffectiveValue(h);
  }
  const sectorWeights = Object.values(bySector).map(v => v / totalValue);
  const maxSector = sectorWeights.length ? Math.max(...sectorWeights) : 1;
  let sectors;
  if (maxSector < 0.30) sectors = 20;
  else if (maxSector < 0.40) sectors = 15;
  else if (maxSector < 0.50) sectors = 10;
  else if (maxSector < 0.60) sectors = 5;
  else sectors = 0;

  // 3. GEOGRAPHY (20 pts)
  const byGeo = {};
  for (const h of holdings) {
    const g = inferGeography(h);
    byGeo[g] = (byGeo[g] || 0) + getEffectiveValue(h);
  }
  const numRegions = Object.keys(byGeo).length;
  const geoWeights = Object.values(byGeo).map(v => v / totalValue);
  const maxRegion = geoWeights.length ? Math.max(...geoWeights) : 1;
  let geography;
  if (numRegions >= 4 && maxRegion < 0.60) geography = 20;
  else if (numRegions >= 3) geography = 15;
  else if (numRegions >= 2) geography = 10;
  else geography = 5;

  // 4. ASSET CLASSES (20 pts)
  const byClass = {};
  for (const h of holdings) {
    const c = CATEGORY_TO_CLASS[h.category] || 'other';
    byClass[c] = (byClass[c] || 0) + getEffectiveValue(h);
  }
  const classKeys = Object.keys(byClass);
  const numClasses = classKeys.length;
  let assetClasses;
  if (numClasses >= 5) assetClasses = 20;
  else if (numClasses >= 4) assetClasses = 15;
  else if (numClasses >= 3) assetClasses = 10;
  else if (numClasses >= 2) assetClasses = 5;
  else assetClasses = 0;
  // Bonus défensifs
  const bondsW = (byClass.bonds || 0) / totalValue;
  const goldW = (byClass.gold || 0) / totalValue;
  if (bondsW > 0.10) assetClasses += 3;
  if (goldW > 0.05) assetClasses += 2;
  assetClasses = Math.min(20, assetClasses);

  const total = concentration + sectors + geography + assetClasses;

  // === Forces / Faiblesses / Recos ===
  const forces = [];
  const weaknesses = [];
  const recommendations = [];

  if (numClasses >= 5) forces.push('✓ Multi-classes d\'actifs (' + numClasses + ')');
  if (maxWeight < 0.20) forces.push('✓ Position max < 20%');
  if (goldW > 0.05) forces.push('✓ Exposition or présente');
  if (bondsW > 0.10) forces.push('✓ Allocation défensive bonds');
  if (numRegions >= 4 && maxRegion < 0.60) forces.push('✓ Diversification géographique correcte');

  if (maxWeight > 0.30) weaknesses.push('✗ Position dominante : ' + (maxWeight * 100).toFixed(0) + '% — risque idiosyncrasique majeur');
  if (maxSector > 0.50) {
    const dom = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0];
    weaknesses.push('✗ Trop concentré secteur ' + dom[0] + ' (' + (maxSector * 100).toFixed(0) + '%)');
  }
  if (numClasses < 3) weaknesses.push('✗ Seulement ' + numClasses + ' classe(s) d\'actifs');
  if (bondsW < 0.05 && goldW < 0.03) weaknesses.push('✗ Aucun actif défensif (bonds/or)');
  if (numRegions < 2) weaknesses.push('✗ Concentration géographique extrême');
  const frPct = (byGeo.france || 0) / totalValue;
  if (frPct > 0.60) weaknesses.push('✗ Biais domestique (FR ' + (frPct * 100).toFixed(0) + '%)');

  if (maxWeight > 0.30) recommendations.push('Réduire la position dominante en dessous de 25%.');
  if (maxSector > 0.40) {
    const dom = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0];
    recommendations.push('Diversifier hors du secteur ' + dom[0] + ' (cible < 30%).');
  }
  if (frPct > 0.60) recommendations.push('Ajouter ETF MSCI World / All-World pour réduire le biais domestique.');
  if (bondsW < 0.10 && goldW < 0.03 && numClasses < 4) recommendations.push('Considérer 5-15% obligataire (AGGH, EUNA) ou or (SGLD) selon profil.');
  if (numClasses < 4) recommendations.push('Diversifier en classes d\'actifs (immobilier via SCPI, obligations, or).');

  return {
    total,
    breakdown: { concentration, sectors, geography, assetClasses },
    forces,
    weaknesses,
    recommendations,
    stats: {
      totalValue, hhi, maxWeight,
      bySector, byGeo, byClass,
      numRegions, numClasses,
      frPct
    }
  };
}

// === RENDER ===

export function renderDiversificationScoreView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.diversification-score.label'), t('mod.diversification-score.desc'), { example: t('mod.diversification-score.example'), moduleId: MODULE_ID })}
    <div id="div-score-container">
      <div class="card" style="text-align:center;padding:30px;">
        <p style="color:var(--text-secondary);">⏳ ${isEN ? 'Computing your score…' : 'Calcul du score…'}</p>
      </div>
    </div>
  `;

  // Example loader
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => renderScore(viewEl, exampleHoldings()));

  // Compute from real wealth
  listWealth().then(holdings => renderScore(viewEl, holdings)).catch(() => renderScore(viewEl, []));
}

function renderScore(viewEl, holdings) {
  const isEN = getLocale() === 'en';
  const result = computeDiversificationScore(holdings);
  const container = viewEl.querySelector('#div-score-container');

  const colorClass = result.total < 30 ? 'red' : result.total < 50 ? 'orange' : result.total < 70 ? 'green-light' : 'green';
  const badge = result.total < 30 ? '🚨 Critique' : result.total < 50 ? '⚠️ À améliorer' : result.total < 70 ? '👍 Correct' : '🏆 Excellent';

  container.innerHTML = `
    <div class="card" style="display:flex;gap:30px;align-items:center;flex-wrap:wrap;">
      <div style="flex:0 0 220px;height:140px;position:relative;">
        <canvas id="div-gauge"></canvas>
        <div style="position:absolute;left:0;right:0;bottom:18px;text-align:center;">
          <div style="font-size:42px;font-weight:700;font-family:var(--font-mono);">${result.total}</div>
          <div style="font-size:11px;color:var(--text-muted);">/ 100</div>
        </div>
      </div>
      <div style="flex:1;min-width:240px;">
        <div style="font-size:18px;font-weight:600;margin-bottom:8px;">${badge}</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:6px 14px;font-size:13px;">
          <span>${isEN ? 'Concentration' : 'Concentration'}</span><strong>${result.breakdown.concentration} / 40</strong>
          <span>${isEN ? 'Sectors' : 'Secteurs'}</span><strong>${result.breakdown.sectors} / 20</strong>
          <span>${isEN ? 'Geography' : 'Géographie'}</span><strong>${result.breakdown.geography} / 20</strong>
          <span>${isEN ? 'Asset classes' : 'Classes d\'actifs'}</span><strong>${result.breakdown.assetClasses} / 20</strong>
        </div>
      </div>
    </div>

    ${result.forces.length ? `
    <div class="card">
      <div class="card-title" style="color:var(--accent-green);">✅ ${isEN ? 'Strengths' : 'Forces'}</div>
      <ul style="margin:0;padding-left:18px;line-height:1.9;">${result.forces.map(f => `<li>${f}</li>`).join('')}</ul>
    </div>` : ''}

    ${result.weaknesses.length ? `
    <div class="card">
      <div class="card-title" style="color:var(--accent-red);">⚠️ ${isEN ? 'Weaknesses' : 'À améliorer'}</div>
      <ul style="margin:0;padding-left:18px;line-height:1.9;">${result.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>
    </div>` : ''}

    ${result.recommendations.length ? `
    <div class="card">
      <div class="card-title">💡 ${isEN ? 'Recommendations' : 'Recommandations'}</div>
      <ol style="margin:0;padding-left:20px;line-height:1.9;">${result.recommendations.map(r => `<li>${r}</li>`).join('')}</ol>
    </div>` : ''}

    ${result.stats.totalValue ? `
    <div class="card">
      <div class="card-title">📊 ${isEN ? 'Breakdown' : 'Répartition'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:12px;">
        <div>
          <div style="font-weight:600;margin-bottom:6px;">${isEN ? 'By sector' : 'Par secteur'}</div>
          ${Object.entries(result.stats.bySector).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, v]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${s}</span><span style="font-family:var(--font-mono);color:var(--text-muted);">${(v / result.stats.totalValue * 100).toFixed(1)}%</span></div>`).join('')}
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:6px;">${isEN ? 'By region' : 'Par région'}</div>
          ${Object.entries(result.stats.byGeo).sort((a, b) => b[1] - a[1]).map(([g, v]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${g}</span><span style="font-family:var(--font-mono);color:var(--text-muted);">${(v / result.stats.totalValue * 100).toFixed(1)}%</span></div>`).join('')}
        </div>
      </div>
    </div>` : ''}
  `;

  // Render gauge
  const gaugeCanvas = document.getElementById('div-gauge');
  if (gaugeCanvas) {
    try { diversificationGauge(gaugeCanvas, result.total); } catch (e) { console.warn('Chart not loaded:', e); }
  }
}

function exampleHoldings() {
  // Portefeuille démo : 3 actions tech US + 1 ETF World, pas de défensif → score moyen
  return [
    { id: 'ex1', name: 'Apple', ticker: 'AAPL', category: 'stocks', value: 25000, currency: 'USD' },
    { id: 'ex2', name: 'Microsoft', ticker: 'MSFT', category: 'stocks', value: 22000, currency: 'USD' },
    { id: 'ex3', name: 'Nvidia', ticker: 'NVDA', category: 'stocks', value: 18000, currency: 'USD' },
    { id: 'ex4', name: 'iShares MSCI World', ticker: 'IWDA', category: 'etf', value: 35000, currency: 'EUR' },
    { id: 'ex5', name: 'Cash', ticker: '', category: 'cash', value: 8000, currency: 'EUR' }
  ];
}
