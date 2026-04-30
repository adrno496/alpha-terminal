// C2 — Tax-Loss Harvesting : scan les holdings CTO en moins-value latente et propose
// les ventes optimales pour matérialiser des pertes (déductibles 10 ans en FR).
import { $, toast } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';

const MODULE_ID = 'tax-loss-harvesting';

// Détecte si un holding est sur CTO (pas PEA / pas AV / pas LDDS / pas PER)
function isCTO(holding) {
  const acc = (holding.account || '').toLowerCase();
  if (/pea|av|assurance.?vie|linxea|lucya|per|livret|ldds|lddss|cto.[a-z]/i.test(acc)) {
    // Si "CTO" mention explicite → vrai CTO
    if (/cto\b|compte.?titres/i.test(acc)) return true;
    return false;
  }
  // Catégories non-CTO
  if (['cash', 'bonds', 'real_estate', 'commodities', 'private', 'retirement'].includes(holding.category)) return false;
  // Stocks/ETF/Crypto sans account explicite → on suppose CTO par défaut
  return ['stocks', 'etf', 'crypto'].includes(holding.category);
}

// Calcule moins-value latente : (value - costBasis)
function unrealizedLoss(h) {
  const cost = Number(h.costBasis) || 0;
  const value = Number(h.value) || 0;
  if (!cost || !value) return null;
  return {
    cost,
    value,
    plMV: value - cost,             // P/L en valeur
    plPct: ((value - cost) / cost) * 100,
    isLoss: value < cost
  };
}

export async function renderTaxLossHarvestingView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '🧮 Tax-Loss Harvesting' : '🧮 Tax-Loss Harvesting',
      isEN ? 'Detect unrealized losses on your CTO (non-tax-sheltered) holdings and identify optimal sells to materialize losses (deductible 10 years in FR, $3000/year US).' : 'Détecte les moins-values latentes sur tes positions CTO et identifie les ventes optimales pour matérialiser des pertes (déductibles 10 ans en FR, jusqu\'à $3000/an aux US).',
      { moduleId: MODULE_ID })}

    <div id="tlh-summary" class="card">${isEN ? '⏳ Loading…' : '⏳ Chargement…'}</div>
    <div id="tlh-positions" class="card"></div>
    <div id="tlh-strategy" class="card"></div>
    <div id="tlh-warnings" class="card" style="border-left:3px solid var(--accent-orange);background:rgba(255,170,0,0.04);"></div>
  `;

  const holdings = await listWealth().catch(() => []);
  const cto = holdings.filter(isCTO);

  if (cto.length === 0) {
    $('#tlh-summary').innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:30px;">${isEN ? 'No CTO holdings detected (or all your stocks are in PEA/life-insurance — those have their own tax rules).' : 'Aucune position CTO détectée (ou toutes tes actions sont en PEA/AV — ces enveloppes ont leurs propres règles fiscales).'}</p>`;
    return;
  }

  const withPL = cto.map(h => ({ h, m: unrealizedLoss(h) })).filter(x => x.m);
  const losses = withPL.filter(x => x.m.isLoss);
  const gains = withPL.filter(x => !x.m.isLoss);

  const totalLatentLoss = losses.reduce((s, x) => s + Math.abs(x.m.plMV), 0);
  const totalLatentGain = gains.reduce((s, x) => s + x.m.plMV, 0);
  const harvestable = Math.min(totalLatentLoss, totalLatentGain); // ce qu'on peut compenser cette année
  const carriedForward = Math.max(0, totalLatentLoss - totalLatentGain); // reste reportable 10 ans

  // Économie d'impôt estimée selon TMI :
  //   FR CTO : PFU 30% (12.8% IR + 17.2% PS)
  //   Économie immédiate sur la part PFU si on matérialise loss qui compense gains de l'année
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

  $('#tlh-summary').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'Latent P/L on your CTO' : 'P/L latent sur ton CTO'}</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${isEN ? 'CTO holdings' : 'Positions CTO'}</div><div class="stat-value">${cto.length}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Total latent loss' : 'Moins-values latentes'}</div><div class="stat-value red">-${fmt(totalLatentLoss)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Total latent gain' : 'Plus-values latentes'}</div><div class="stat-value green">+${fmt(totalLatentGain)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Net latent' : 'Net latent'}</div><div class="stat-value ${totalLatentGain - totalLatentLoss >= 0 ? 'green' : 'red'}">${(totalLatentGain - totalLatentLoss) >= 0 ? '+' : ''}${fmt(totalLatentGain - totalLatentLoss)} €</div></div>
    </div>
    ${harvestable > 0 ? `
      <div style="margin-top:14px;padding:12px;background:rgba(0,255,136,0.08);border-radius:6px;font-size:13px;">
        💰 <strong>${isEN ? 'Harvest opportunity' : 'Opportunité de harvesting'} : ${fmt(harvestable)} €</strong> ${isEN ? 'of losses can offset gains this year' : 'de pertes compensables cette année'}
        <br>${isEN ? 'Estimated tax saving' : 'Économie d\'impôt estimée'} (PFU 30%) : <strong>${fmt(harvestable * 0.30)} €</strong>
        ${carriedForward > 0 ? `<br>${isEN ? 'Plus' : 'Plus'} <strong>${fmt(carriedForward)} €</strong> ${isEN ? 'carried forward 10 years' : 'reportable 10 ans'} (${fmt(carriedForward * 0.30)} € ${isEN ? 'future tax saving' : 'd\'économie future'})</div>` : ''}
      </div>
    ` : (totalLatentLoss > 0 ? `
      <div style="margin-top:14px;padding:12px;background:var(--bg-tertiary);border-radius:6px;font-size:12.5px;">
        ${isEN ? 'No latent gains to offset this year, but materializing the' : 'Pas de plus-values à compenser cette année, mais matérialiser les'} <strong>${fmt(totalLatentLoss)} €</strong> ${isEN ? 'of losses creates a tax credit usable for the next 10 years (FR).' : 'de pertes crée un crédit fiscal utilisable les 10 prochaines années (FR).'}
      </div>
    ` : '')}
  `;

  // Liste des moins-values
  $('#tlh-positions').innerHTML = `
    <div class="card-title">📋 ${isEN ? 'Positions in the red (candidates for harvest)' : 'Positions en moins-value (candidates au harvesting)'}</div>
    ${losses.length === 0 ? `<p style="color:var(--text-muted);text-align:center;padding:14px;font-size:12.5px;">${isEN ? '✅ No latent loss — all your CTO positions are profitable.' : '✅ Aucune moins-value latente — tes positions CTO sont toutes en profit.'}</p>` : `
      <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px;">${isEN ? 'Holding' : 'Position'}</th>
          <th style="text-align:left;padding:6px;">${isEN ? 'Account' : 'Compte'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Cost' : 'Coût'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Value' : 'Valeur'}</th>
          <th style="text-align:right;padding:6px;">P/L</th>
          <th style="text-align:right;padding:6px;">%</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Tax saving' : 'Économie fiscale'}</th>
        </tr></thead>
        <tbody>
          ${losses.sort((a, b) => a.m.plMV - b.m.plMV).map(({ h, m }) => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:6px;"><strong>${escape(h.name)}</strong>${h.ticker ? ` <code style="font-size:10px;">${escape(h.ticker)}</code>` : ''}</td>
              <td style="padding:6px;color:var(--text-muted);">${escape(h.account || '—')}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${fmt(m.cost)}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${fmt(m.value)}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${fmt(m.plMV)}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${m.plPct.toFixed(1)}%</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);color:var(--accent-green);">${fmt(Math.abs(m.plMV) * 0.30)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}
  `;

  // Stratégie
  if (losses.length > 0 && gains.length > 0) {
    $('#tlh-strategy').innerHTML = `
      <div class="card-title">🎯 ${isEN ? 'Recommended strategy' : 'Stratégie recommandée'}</div>
      <ol style="margin:0;padding-left:18px;line-height:1.9;font-size:13px;">
        <li>${isEN ? 'Sell the worst-performing holdings to materialize losses (priority: oldest losses first to avoid capital gains tax bracket drift).' : 'Vendre les pires performances pour matérialiser des pertes (priorité : pertes les plus anciennes pour éviter l\'effet seuil).'}</li>
        <li>${isEN ? 'Realize gains on appreciated positions up to the loss amount: those gains are tax-free this year (offset).' : 'Matérialiser des gains sur les positions appréciées jusqu\'à hauteur des pertes : ces gains sont sans impôt cette année (compensation).'}</li>
        <li>${isEN ? 'Wait 30 days minimum before re-buying the same security (FR: pas de wash-sale rule explicite mais bonne pratique vs IFI/contrôle fiscal).' : 'Attendre 30 jours minimum avant de racheter le même titre (pas de wash-sale rule FR explicite mais bonne pratique).'}</li>
        <li>${isEN ? 'Replace with a similar-but-different ETF/stock to maintain market exposure (e.g., IWDA → VWCE, both World).' : 'Remplacer par un ETF/action similaire mais différent pour maintenir l\'exposition (ex IWDA → VWCE, tous deux World).'}</li>
      </ol>
    `;
  } else {
    $('#tlh-strategy').innerHTML = '';
  }

  // Warnings
  $('#tlh-warnings').innerHTML = `
    <div class="card-title">⚠️ ${isEN ? 'Important warnings' : 'Warnings importants'}</div>
    <ul style="margin:0;padding-left:18px;line-height:1.7;font-size:12.5px;">
      <li>${isEN ? '<strong>FR specific</strong> : losses are deductible against gains on the same fiscal year, then carry forward 10 years. They do NOT offset salary income.' : '<strong>FR</strong> : les moins-values sont déductibles des plus-values de la même année, puis reportables 10 ans. Elles ne compensent PAS le revenu salarial.'}</li>
      <li>${isEN ? '<strong>Crypto FR</strong> : losses on crypto are SEPARATE — they only offset crypto gains, not stock gains.' : '<strong>Crypto FR</strong> : les moins-values crypto sont SÉPARÉES — elles ne compensent que les plus-values crypto, pas celles des actions.'}</li>
      <li>${isEN ? 'PEA/life-insurance: tax-loss harvesting is irrelevant — you\'re already in tax-sheltered envelopes.' : 'PEA/AV : le tax-loss harvesting est sans intérêt — tu es déjà en enveloppe fiscale optimisée.'}</li>
      <li>${isEN ? 'This module gives an estimate. For real tax filing, consult a CGP or your tax advisor.' : 'Ce module donne une estimation. Pour la déclaration réelle, consulte un CGP ou ton conseiller fiscal.'}</li>
      <li>${isEN ? 'The 30-day waiting period is good practice, not a strict legal requirement in France.' : 'Le délai de 30 jours est une bonne pratique, pas une exigence légale stricte en France.'}</li>
    </ul>
  `;
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
