// Simulateur IFI (Impôt sur la Fortune Immobilière) — barème FR 2024.
// Calcul automatique depuis les biens immo du module Patrimoine.
import { $, toast } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';
import { computeRealEstateMetrics, normalizeLoans } from '../core/real-estate.js';

const MODULE_ID = 'ifi-simulator';

// Barème IFI 2024 (article 977 CGI) — par tranche de patrimoine net immobilier taxable
const IFI_BRACKETS = [
  { upTo: 800000,    rate: 0.000 },
  { upTo: 1300000,   rate: 0.005 }, // 0.5% — mais redevable à partir de 1.3M€ (calcul rétroactif depuis 800k)
  { upTo: 2570000,   rate: 0.007 }, // 0.7%
  { upTo: 5000000,   rate: 0.010 }, // 1.0%
  { upTo: 10000000,  rate: 0.0125 },// 1.25%
  { upTo: Infinity,  rate: 0.015 }  // 1.5%
];
const IFI_THRESHOLD = 1300000; // pas redevable en dessous

// Décote partielle entre 1.3M€ et 1.4M€ (article 977 al.4)
//   Si patrimoine entre 1.3M€ et 1.4M€ : décote = 17 500€ - (1.25% × patrimoine)
function ifiDecote(patrimoineNet) {
  if (patrimoineNet < IFI_THRESHOLD || patrimoineNet >= 1400000) return 0;
  return Math.max(0, 17500 - 0.0125 * patrimoineNet);
}

// Calcul IFI brut sur barème (pour patrimoine ≥ 1.3M€, le calcul démarre à 800k€)
export function computeIFI(patrimoineNetImmo) {
  if (patrimoineNetImmo < IFI_THRESHOLD) return { gross: 0, decote: 0, net: 0, marginalRate: 0, taxable: patrimoineNetImmo };
  let tax = 0, prev = 0;
  let marginalRate = 0;
  for (const b of IFI_BRACKETS) {
    if (patrimoineNetImmo <= prev) break;
    const slice = Math.min(patrimoineNetImmo, b.upTo) - prev;
    if (slice > 0) {
      tax += slice * b.rate;
      marginalRate = b.rate;
    }
    prev = b.upTo;
    if (patrimoineNetImmo <= b.upTo) break;
  }
  const decote = ifiDecote(patrimoineNetImmo);
  return {
    gross: tax,
    decote,
    net: Math.max(0, tax - decote),
    marginalRate,
    taxable: patrimoineNetImmo
  };
}

export async function renderIfiSimulatorView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '🇫🇷 IFI Simulator (French Real-Estate Wealth Tax)' : '🇫🇷 Simulateur IFI',
      isEN ? 'Auto-compute the French Impôt sur la Fortune Immobilière (IFI) from your real-estate holdings. 2024 brackets.' : 'Calcul automatique de l\'IFI 2024 depuis tes biens immobiliers du module Patrimoine.',
      { moduleId: MODULE_ID })}

    <div id="ifi-summary" class="card">${isEN ? '⏳ Loading…' : '⏳ Calcul…'}</div>
    <div id="ifi-detail" class="card"></div>
    <div id="ifi-bracket" class="card"></div>
    <div id="ifi-optim" class="card"></div>
  `;

  const holdings = await listWealth().catch(() => []);
  const properties = holdings.filter(h => h.category === 'real_estate');
  if (properties.length === 0) {
    $('#ifi-summary').innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:30px;">${isEN ? 'No real-estate holdings detected. Add some in the Patrimoine module first.' : 'Aucun bien immobilier détecté. Ajoute-en dans le module Patrimoine.'}</p>`;
    return;
  }

  let assetGross = 0, debtTotal = 0;
  const lines = [];
  for (const h of properties) {
    const m = computeRealEstateMetrics(h);
    const isPrincipal = h.propertyType === 'residence_principale';
    // Abattement 30% sur résidence principale (CGI art. 973)
    const taxableValue = isPrincipal ? m.currentValue * 0.70 : m.currentValue;
    const debt = m.remaining;
    assetGross += taxableValue;
    debtTotal += debt;
    lines.push({
      name: h.name,
      type: h.propertyType,
      currentValue: m.currentValue,
      taxableValue,
      debt,
      net: taxableValue - debt,
      isPrincipal
    });
  }
  const patrimoineNet = Math.max(0, assetGross - debtTotal);
  const ifi = computeIFI(patrimoineNet);

  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const sym = '€';

  $('#ifi-summary').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'IFI Summary' : 'Synthèse IFI'}</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${isEN ? 'Taxable assets (after 30% RP discount)' : 'Actifs taxables (après abattement 30% RP)'}</div><div class="stat-value">${fmt(assetGross)} ${sym}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Deductible debts' : 'Dettes déductibles'}</div><div class="stat-value red">-${fmt(debtTotal)} ${sym}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Net taxable wealth' : 'Patrimoine net taxable'}</div><div class="stat-value">${fmt(patrimoineNet)} ${sym}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'IFI due' : 'IFI à payer'}</div><div class="stat-value ${ifi.net > 0 ? 'red' : 'green'}">${fmt(ifi.net)} ${sym}</div></div>
    </div>
    ${ifi.net === 0 ? `<p style="margin-top:14px;color:var(--accent-green);font-size:13px;">✅ ${isEN ? `Below the €${IFI_THRESHOLD.toLocaleString('en-US')} threshold — not subject to IFI.` : `Sous le seuil de ${fmt(IFI_THRESHOLD)} € — non redevable de l'IFI.`}</p>` : `
    <div style="margin-top:14px;padding:10px;background:var(--bg-tertiary);border-radius:4px;font-size:13px;">
      ⚠️ <strong>${isEN ? 'Subject to IFI.' : 'Redevable de l\'IFI.'}</strong>
      ${isEN ? `Marginal rate: ${(ifi.marginalRate * 100).toFixed(2)}% · Decote: ${fmt(ifi.decote)} €` : `Taux marginal : ${(ifi.marginalRate * 100).toFixed(2)}% · Décote : ${fmt(ifi.decote)} €`}
    </div>`}
  `;

  $('#ifi-detail').innerHTML = `
    <div class="card-title">📋 ${isEN ? 'Per property' : 'Détail par bien'}</div>
    <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="text-align:left;padding:6px;">${isEN ? 'Property' : 'Bien'}</th>
        <th style="text-align:left;padding:6px;">${isEN ? 'Type' : 'Type'}</th>
        <th style="text-align:right;padding:6px;">${isEN ? 'Current value' : 'Valeur'}</th>
        <th style="text-align:right;padding:6px;">${isEN ? 'Taxable' : 'Taxable'}</th>
        <th style="text-align:right;padding:6px;">${isEN ? 'Debt' : 'Dette'}</th>
        <th style="text-align:right;padding:6px;">${isEN ? 'Net' : 'Net'}</th>
      </tr></thead>
      <tbody>
        ${lines.map(l => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">${escape(l.name)}</td>
            <td style="padding:6px;">${l.isPrincipal ? '🏠 RP (-30%)' : l.type === 'locatif' ? '🏘️ Locatif' : '🏖️ Secondaire'}</td>
            <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${fmt(l.currentValue)}</td>
            <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${fmt(l.taxableValue)}</td>
            <td style="padding:6px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${fmt(l.debt)}</td>
            <td style="padding:6px;text-align:right;font-family:var(--font-mono);font-weight:600;">${fmt(l.net)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Tableau du barème
  $('#ifi-bracket').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'IFI 2024 brackets' : 'Barème IFI 2024'}</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="text-align:left;padding:6px;">${isEN ? 'Bracket' : 'Tranche'}</th>
        <th style="text-align:right;padding:6px;">${isEN ? 'Rate' : 'Taux'}</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">≤ 800 000 €</td><td style="padding:6px;text-align:right;">0%</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">800 001 € → 1 300 000 €</td><td style="padding:6px;text-align:right;">0.50%</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">1 300 001 € → 2 570 000 €</td><td style="padding:6px;text-align:right;">0.70%</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">2 570 001 € → 5 000 000 €</td><td style="padding:6px;text-align:right;">1.00%</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">5 000 001 € → 10 000 000 €</td><td style="padding:6px;text-align:right;">1.25%</td></tr>
        <tr><td style="padding:6px;">> 10 000 000 €</td><td style="padding:6px;text-align:right;">1.50%</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">${isEN ? 'Threshold: €1,300,000 net taxable real-estate wealth. Decote between €1.3M and €1.4M = €17,500 - (1.25% × wealth).' : 'Seuil de redevabilité : 1 300 000 € de patrimoine net immobilier taxable. Décote entre 1.3M€ et 1.4M€ = 17 500 € - (1.25% × patrimoine).'}</p>
  `;

  // Optimisations
  if (ifi.net > 0) {
    const optims = [];
    if (lines.some(l => l.isPrincipal)) optims.push(isEN ? 'Already benefiting from the 30% main-residence discount.' : '✓ Tu bénéficies déjà de l\'abattement 30% sur la résidence principale.');
    if (debtTotal < assetGross * 0.3) optims.push(isEN ? 'Low leverage — IFI debt deduction is under-used. Refinancing to keep deductible debt active reduces taxable base.' : 'Endettement faible — la déduction des dettes IFI est sous-utilisée. Maintenir un prêt en cours réduit la base taxable.');
    if (lines.some(l => l.type === 'locatif')) optims.push(isEN ? 'Rental properties: explore SCPIs in life-insurance wrapper (lower IFI exposure than direct rentals).' : 'Locatif : explore les SCPI dans une AV (exposition IFI réduite vs détention directe).');
    optims.push(isEN ? 'Donations to children: a temporary usufruct gift (donation temporaire d\'usufruit) removes the bare ownership from your IFI base for the duration.' : 'Donation temporaire d\'usufruit aux enfants : la nue-propriété sort de ta base IFI pendant la durée.');
    optims.push(isEN ? 'Investment in forests, vineyards, art (works of art are exempt from IFI by default).' : 'Investissement forêts, vignobles, œuvres d\'art (exonérées d\'IFI par défaut).');

    $('#ifi-optim').innerHTML = `
      <div class="card-title">💡 ${isEN ? 'Optimization paths' : 'Pistes d\'optimisation'}</div>
      <ul style="margin:0;padding-left:18px;line-height:1.8;font-size:13px;">
        ${optims.map(o => `<li>${escape(o)}</li>`).join('')}
      </ul>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">${isEN ? 'Note: this simulator gives an estimate. For tax filing, consult a qualified advisor (CGP, notaire).' : 'Note : ce simulateur donne une estimation. Pour la déclaration fiscale réelle, consulte un CGP ou notaire.'}</p>
    `;
  } else {
    $('#ifi-optim').innerHTML = '';
  }
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
