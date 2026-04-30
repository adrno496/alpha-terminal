// C6 — Optimiseur d'enveloppe fiscale FR par âge.
// Recommande la meilleure répartition entre PEA / AV / PER / CTO selon âge + TMI + objectifs.
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { getUserProfile } from '../core/user-profile.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';

const MODULE_ID = 'envelope-optimizer';

// Allocation cible par enveloppe selon âge + TMI
function getTargetAllocation(age, tmi, profile = 'balanced') {
  // Pourcentages cibles par enveloppe (sur l'épargne investie, hors résidence principale + cash précaution)
  let targets = { pea: 0, av: 0, per: 0, cto: 0 };

  if (age < 30) {
    // Jeune actif : priorité PEA pour exonération à 5 ans + AV pour démarrer l'horloge 8 ans
    targets = { pea: 50, av: 30, per: 10, cto: 10 };
  } else if (age < 40) {
    // Actif : maxer PEA, ajouter PER si TMI haute, AV pour souplesse
    targets = { pea: 45, av: 25, per: 15, cto: 15 };
  } else if (age < 50) {
    // Pré-retraite : PER prend du poids (déduction IR + sortie retraite)
    targets = { pea: 35, av: 30, per: 25, cto: 10 };
  } else if (age < 60) {
    // Approche retraite : AV en force pour transmission, réduire CTO
    targets = { pea: 25, av: 40, per: 25, cto: 10 };
  } else {
    // Retraite : AV pour transmission/abattement, PER liquidation, peu de risque CTO
    targets = { pea: 15, av: 50, per: 20, cto: 15 };
  }

  // Adjust selon TMI
  if (tmi >= 30) {
    // Boost PER (déduction IR plus rentable)
    targets.per += 5;
    targets.cto -= 5;
  }
  if (tmi <= 11) {
    // PER moins intéressant (peu de déduction)
    targets.per -= 5;
    targets.cto += 5;
  }
  if (tmi === 0) {
    targets.per = Math.max(0, targets.per - 10);
    targets.cto += 10;
  }

  return targets;
}

function detectEnvelope(holding) {
  const acc = (holding.account || '').toLowerCase();
  if (/\bpea\b/.test(acc)) return 'pea';
  if (/\bper\b/.test(acc)) return 'per';
  if (/av\b|assurance.?vie|linxea|lucya|fortuneo vie|boursorama vie/i.test(acc)) return 'av';
  if (holding.category === 'real_estate') return 'real_estate';
  if (holding.category === 'cash' || holding.category === 'bonds') return 'cash';
  if (['stocks', 'etf', 'crypto'].includes(holding.category)) return 'cto';
  return 'other';
}

export async function renderEnvelopeOptimizerView(viewEl) {
  const isEN = getLocale() === 'en';
  const profile = getUserProfile() || {};
  const age = Number(profile.age) || 35;
  const tmi = Number(profile.tmiPct) || 30;

  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '🇫🇷 Tax-envelope Optimizer' : '🇫🇷 Optimiseur d\'enveloppe fiscale',
      isEN ? 'Recommended split between PEA / AV / PER / CTO based on your age and marginal tax bracket. FR-specific.' : 'Répartition recommandée entre PEA / AV / PER / CTO selon ton âge et ta tranche marginale d\'imposition. FR.',
      { moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">⚙️ ${isEN ? 'Your inputs' : 'Tes paramètres'}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;">
        <div class="field" style="margin:0;">
          <label class="field-label">${isEN ? 'Age' : 'Âge'}</label>
          <input id="env-age" class="input" type="number" min="18" max="100" value="${age}" style="max-width:100px;" />
        </div>
        <div class="field" style="margin:0;">
          <label class="field-label">TMI %</label>
          <select id="env-tmi" class="input" style="max-width:100px;">
            <option value="0" ${tmi === 0 ? 'selected' : ''}>0%</option>
            <option value="11" ${tmi === 11 ? 'selected' : ''}>11%</option>
            <option value="30" ${tmi === 30 ? 'selected' : ''}>30%</option>
            <option value="41" ${tmi === 41 ? 'selected' : ''}>41%</option>
            <option value="45" ${tmi === 45 ? 'selected' : ''}>45%</option>
          </select>
        </div>
        <button id="env-recompute" class="btn-primary">🎯 ${isEN ? 'Compute' : 'Calculer'}</button>
      </div>
    </div>

    <div id="env-current" class="card"></div>
    <div id="env-target" class="card"></div>
    <div id="env-actions" class="card"></div>
  `;

  $('#env-recompute').addEventListener('click', () => render(viewEl));
  render(viewEl);
}

async function render(viewEl) {
  const isEN = getLocale() === 'en';
  const age = parseInt($('#env-age').value, 10) || 35;
  const tmi = parseInt($('#env-tmi').value, 10) || 30;

  const list = await listWealth().catch(() => []);
  const investable = list.filter(h => detectEnvelope(h) !== 'real_estate' && h.category !== 'cash' || (h.category === 'cash' && (Number(h.value) || 0) > 6 * 1500)); // exclut RP + 6 mois épargne précaution

  const totalInvested = investable.reduce((s, h) => s + (Number(h.value) || 0), 0);
  const byEnv = { pea: 0, av: 0, per: 0, cto: 0, real_estate: 0, cash: 0, other: 0 };
  for (const h of list) {
    const env = detectEnvelope(h);
    byEnv[env] = (byEnv[env] || 0) + (Number(h.value) || 0);
  }

  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const targets = getTargetAllocation(age, tmi);

  // Current allocation (only investable assets, excludes RP + cash précaution)
  const investableTotal = byEnv.pea + byEnv.av + byEnv.per + byEnv.cto;
  const currentPct = {};
  for (const k of ['pea', 'av', 'per', 'cto']) currentPct[k] = investableTotal > 0 ? (byEnv[k] / investableTotal * 100) : 0;

  const labels = { pea: 'PEA', av: 'Assurance-Vie (AV)', per: 'PER', cto: 'CTO' };
  const colors = { pea: '#00ff88', av: '#4488ff', per: '#aa88ff', cto: '#ffaa00' };

  $('#env-current').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'Your current allocation' : 'Ta répartition actuelle'}</div>
    <div style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">${isEN ? 'Investable assets (excluding main residence + emergency cash)' : 'Actifs investis (hors résidence principale + épargne précaution)'} : <strong>${fmt(investableTotal)} €</strong></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:12px;">
      ${['pea', 'av', 'per', 'cto'].map(k => `
        <div style="border:1px solid var(--border);border-radius:6px;padding:10px;border-left:3px solid ${colors[k]};">
          <div style="font-weight:600;font-size:13px;">${labels[k]}</div>
          <div style="font-family:var(--font-mono);font-size:18px;color:${colors[k]};margin:4px 0;">${currentPct[k].toFixed(0)}%</div>
          <div style="font-size:11px;color:var(--text-muted);">${fmt(byEnv[k])} €</div>
        </div>
      `).join('')}
    </div>
  `;

  $('#env-target').innerHTML = `
    <div class="card-title">🎯 ${isEN ? 'Recommended for your profile' : 'Recommandé pour ton profil'} (${age} ${isEN ? 'years' : 'ans'} · TMI ${tmi}%)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:12px;">
      ${['pea', 'av', 'per', 'cto'].map(k => {
        const diff = currentPct[k] - targets[k];
        const status = Math.abs(diff) < 5 ? '✅' : (diff > 0 ? '⬇️ ' + isEN ? 'over' : 'sur-pondéré' : '⬆️ ' + isEN ? 'under' : 'sous-pondéré');
        const targetEur = (targets[k] / 100) * investableTotal;
        const deltaEur = targetEur - byEnv[k];
        return `
          <div style="border:1px solid var(--border);border-radius:6px;padding:10px;border-left:3px solid ${colors[k]};">
            <div style="font-weight:600;font-size:13px;">${labels[k]}</div>
            <div style="font-family:var(--font-mono);font-size:18px;color:${colors[k]};margin:4px 0;">${targets[k]}%</div>
            <div style="font-size:11px;color:var(--text-muted);">${fmt(targetEur)} €</div>
            <div style="font-size:11px;font-weight:600;color:${Math.abs(deltaEur) < 1000 ? 'var(--accent-green)' : (deltaEur > 0 ? 'var(--accent-orange)' : 'var(--accent-red)')};margin-top:4px;">
              ${deltaEur >= 0 ? '+' : ''}${fmt(deltaEur)} €
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Actions recommandées
  const actions = [];
  if (currentPct.pea < targets.pea - 5 && byEnv.pea < 150000) {
    const delta = (targets.pea - currentPct.pea) / 100 * investableTotal;
    actions.push(`📈 <strong>${isEN ? 'Boost your PEA' : 'Booster ton PEA'}</strong> (${isEN ? 'add' : 'verser'} ~${fmt(delta)} €) — ${isEN ? '5+ years = income tax exempt on capital gains. Cap €150,000.' : '5+ ans = exonération IR sur plus-values. Plafond 150 000 €.'}`);
  }
  if (currentPct.av < targets.av - 5) {
    const delta = (targets.av - currentPct.av) / 100 * investableTotal;
    actions.push(`🛡️ <strong>${isEN ? 'Boost your life-insurance' : 'Booster ton AV'}</strong> (${isEN ? 'add' : 'verser'} ~${fmt(delta)} €) — ${isEN ? '8+ years = €4,600/year tax allowance + estate planning friendly.' : '8+ ans = abattement 4 600 €/an + transmission optimisée.'}`);
  }
  if (tmi >= 30 && currentPct.per < targets.per - 5) {
    const delta = (targets.per - currentPct.per) / 100 * investableTotal;
    const taxSaving = delta * (tmi / 100);
    actions.push(`💰 <strong>${isEN ? 'Open/feed your PER' : 'Ouvrir/alimenter ton PER'}</strong> (${isEN ? 'add' : 'verser'} ~${fmt(delta)} €) — ${isEN ? `Immediate tax saving ~${fmt(taxSaving)} € (${tmi}% bracket)` : `Économie d'impôt immédiate ~${fmt(taxSaving)} € (TMI ${tmi}%)`}`);
  }
  if (currentPct.cto > targets.cto + 5) {
    const delta = (currentPct.cto - targets.cto) / 100 * investableTotal;
    actions.push(`🔄 <strong>${isEN ? 'Migrate from CTO to tax-sheltered envelopes' : 'Migrer du CTO vers les enveloppes fiscalisées'}</strong> (~${fmt(delta)} €) — ${isEN ? 'Use Tax-Loss Harvesting first to minimize tax on transfer.' : 'Utilise d\'abord le Tax-Loss Harvesting pour minimiser l\'impôt à la sortie.'}`);
  }
  if (age >= 50 && currentPct.av < 35) {
    actions.push(`📅 <strong>${isEN ? 'Open AV with 8-year clock running' : 'Multiplier les contrats AV'}</strong> — ${isEN ? 'Each contract has its own 8-year tax clock + €152,500/beneficiary inheritance allowance.' : 'Chaque contrat a son propre compteur 8 ans + abattement 152 500 €/bénéficiaire à la succession.'}`);
  }
  if (age >= 55 && tmi >= 30) {
    actions.push(`🎁 <strong>${isEN ? 'Consider donations to children' : 'Considérer des donations aux enfants'}</strong> — ${isEN ? '€100,000/child every 15 years (renewable allowance, FR).' : '100 000 €/enfant tous les 15 ans (abattement renouvelable).'}`);
  }

  $('#env-actions').innerHTML = `
    <div class="card-title">✅ ${isEN ? 'Recommended actions' : 'Actions recommandées'}</div>
    ${actions.length === 0 ? `<p style="color:var(--accent-green);font-size:13px;">🎉 ${isEN ? 'Your allocation is well aligned with the recommendation for your profile.' : 'Ta répartition est bien alignée avec la recommandation pour ton profil.'}</p>` : `<ol style="margin:0;padding-left:20px;line-height:1.9;font-size:13px;">${actions.map(a => `<li>${a}</li>`).join('')}</ol>`}
    <p style="font-size:11px;color:var(--text-muted);margin:14px 0 0;font-style:italic;">${isEN ? 'These targets are heuristics for a balanced FR profile. For complex situations (high net worth, expat, business owner), consult a CGP.' : 'Ces cibles sont des heuristiques pour un profil FR équilibré. Pour les cas complexes (high net worth, expat, dirigeant), consulte un CGP.'}</p>
  `;
}
