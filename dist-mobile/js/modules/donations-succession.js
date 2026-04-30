// Donations & Succession Planner FR — calculs locaux selon barèmes 2026
// Abattements & barèmes succession FR (réf. art. 779 et 777 CGI, valeurs 2024-2026)
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'donations-succession';

// Abattements (renouvelables tous les 15 ans pour les donations)
export const ABATEMENTS = {
  child:        100000,   // par enfant et par parent
  grandchild:    31865,
  greatGrandchild:5310,
  spouse:       Infinity, // exonération totale conjoint/PACS
  sibling:       15932,
  niece:          7967,
  other:          1594,
  disabled:     159325    // cumulable
};

// Barème ligne directe (parent <-> enfant) — taux progressifs sur tranches
export const BAREME_LIGNE_DIRECTE = [
  { upTo: 8072,    rate: 0.05 },
  { upTo: 12109,   rate: 0.10 },
  { upTo: 15932,   rate: 0.15 },
  { upTo: 552324,  rate: 0.20 },
  { upTo: 902838,  rate: 0.30 },
  { upTo: 1805677, rate: 0.40 },
  { upTo: Infinity,rate: 0.45 }
];

export const BAREME_FRERE_SOEUR = [
  { upTo: 24430,   rate: 0.35 },
  { upTo: Infinity,rate: 0.45 }
];

export const BAREME_AUTRE = [
  { upTo: Infinity, rate: 0.60 }
];

function applyBareme(taxable, bareme) {
  let tax = 0, prev = 0;
  for (const tier of bareme) {
    if (taxable <= prev) break;
    const slice = Math.min(taxable, tier.upTo) - prev;
    tax += slice * tier.rate;
    prev = tier.upTo;
  }
  return tax;
}

// Calcul droits de donation/succession en ligne directe enfant
export function computeDonationTax(amount, beneficiary = 'child', isDisabled = false) {
  const abat = (ABATEMENTS[beneficiary] || 0) + (isDisabled ? ABATEMENTS.disabled : 0);
  const taxable = Math.max(0, amount - abat);
  let bareme;
  switch (beneficiary) {
    case 'child': case 'grandchild': case 'greatGrandchild': case 'parent':
      bareme = BAREME_LIGNE_DIRECTE; break;
    case 'sibling':
      bareme = BAREME_FRERE_SOEUR; break;
    case 'spouse':
      return { tax: 0, abatement: amount, taxable: 0, effectiveRate: 0 };
    default:
      bareme = BAREME_AUTRE;
  }
  const tax = applyBareme(taxable, bareme);
  return {
    abatement: Math.min(amount, abat),
    taxable,
    tax: Math.round(tax),
    effectiveRate: amount > 0 ? (tax / amount) * 100 : 0
  };
}

// Démembrement temporaire — valeur usufruit selon barème fiscal art. 669 CGI
export const USUFRUIT_BAREME = [
  { ageMax: 20, usufruit: 90 }, { ageMax: 30, usufruit: 80 },
  { ageMax: 40, usufruit: 70 }, { ageMax: 50, usufruit: 60 },
  { ageMax: 60, usufruit: 50 }, { ageMax: 70, usufruit: 40 },
  { ageMax: 80, usufruit: 30 }, { ageMax: 90, usufruit: 20 },
  { ageMax: 999, usufruit: 10 }
];

export function valueUsufruit(fullValue, donorAge) {
  const tier = USUFRUIT_BAREME.find(t => donorAge < t.ageMax) || USUFRUIT_BAREME[USUFRUIT_BAREME.length - 1];
  const pct = tier.usufruit / 100;
  return {
    usufruit: Math.round(fullValue * pct),
    nuePropriete: Math.round(fullValue * (1 - pct)),
    pctNue: (1 - pct) * 100
  };
}

// Assurance-vie clause bénéficiaire — primes versées avant 70 ans : abattement 152 500€/bénéficiaire
export function computeAVTransmission(amount, isBeforeAge70 = true, beneficiariesCount = 1) {
  if (isBeforeAge70) {
    const abatPerBenef = 152500;
    const totalAbat = abatPerBenef * beneficiariesCount;
    const remaining = Math.max(0, amount - totalAbat);
    const tax = remaining <= 700000 ? remaining * 0.20 : 700000 * 0.20 + (remaining - 700000) * 0.3125;
    return { abatement: Math.min(amount, totalAbat), taxable: remaining, tax: Math.round(tax), regime: 'art. 990 I CGI' };
  } else {
    // Primes versées après 70 ans : abattement global 30 500€ tous bénéficiaires confondus, puis droits de succession
    const abat = 30500;
    return { abatement: Math.min(amount, abat), taxable: Math.max(0, amount - abat), tax: 'Selon barème succession', regime: 'art. 757 B CGI' };
  }
}

function fmtEUR(n) {
  return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €';
}

export async function renderDonationsSuccessionView(viewEl) {
  const isEN = getLocale() === 'en';
  const wealth = await listWealth().catch(() => []);
  const totalWealth = wealth.reduce((s, h) => s + (h.value || 0), 0);

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.donations-succession.label'), t('mod.donations-succession.desc'), { example: t('mod.donations-succession.example'), moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">🎁 ${isEN ? 'Donation simulator' : 'Simulateur de donation'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;">
        <label>${isEN ? 'Amount' : 'Montant'} (€)
          <input type="number" id="don-amount" value="200000" />
        </label>
        <label>${isEN ? 'Beneficiary' : 'Bénéficiaire'}
          <select id="don-benef">
            <option value="child">${isEN ? 'Child (per parent)' : 'Enfant (par parent)'}</option>
            <option value="grandchild">${isEN ? 'Grandchild' : 'Petit-enfant'}</option>
            <option value="greatGrandchild">${isEN ? 'Great-grandchild' : 'Arrière-petit-enfant'}</option>
            <option value="spouse">${isEN ? 'Spouse / PACS' : 'Conjoint / PACS'}</option>
            <option value="sibling">${isEN ? 'Sibling' : 'Frère/Sœur'}</option>
            <option value="niece">${isEN ? 'Nephew/Niece' : 'Neveu/Nièce'}</option>
            <option value="other">${isEN ? 'Other (3rd party)' : 'Autre (tiers)'}</option>
          </select>
        </label>
        <label><input type="checkbox" id="don-disabled" /> ${isEN ? 'Disabled beneficiary (+159,325€)' : 'Bénéficiaire handicapé (+159 325€)'}</label>
        <label><input type="checkbox" id="don-dismembered" /> ${isEN ? 'Bare ownership only (donor keeps usufruit)' : 'Donation en nue-propriété (donateur garde usufruit)'}</label>
        <label>${isEN ? 'Donor age (for usufruit)' : 'Âge du donateur (pour usufruit)'}
          <input type="number" id="don-age" value="60" min="20" max="100" />
        </label>
      </div>
      <button class="btn-primary" id="don-compute" style="margin-top:12px;">${isEN ? 'Compute' : 'Calculer'}</button>
      <div id="don-result" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <div class="card-title">🏛️ ${isEN ? 'Succession simulator (your wealth)' : 'Simulateur de succession (ton patrimoine)'}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">
        ${isEN ? 'Total wealth detected' : 'Patrimoine total détecté'} : <strong>${fmtEUR(totalWealth)}</strong>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;font-size:13px;">
        <label>${isEN ? 'Children' : 'Enfants'}<input type="number" id="suc-children" value="2" min="0" /></label>
        <label>${isEN ? 'Spouse' : 'Conjoint'}<select id="suc-spouse"><option value="0">${isEN ? 'No' : 'Non'}</option><option value="1">${isEN ? 'Yes' : 'Oui'}</option></select></label>
        <label>${isEN ? 'AV before age 70' : 'AV avant 70 ans'} (€)<input type="number" id="suc-av" value="0" /></label>
      </div>
      <button class="btn-primary" id="suc-compute" style="margin-top:12px;">${isEN ? 'Simulate transmission' : 'Simuler transmission'}</button>
      <div id="suc-result" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <div class="card-title">📚 ${isEN ? 'Key rules (FR)' : 'Règles clés (FR)'}</div>
      <ul style="line-height:1.9;font-size:13px;">
        <li><strong>${isEN ? 'Child abatement' : 'Abattement enfant'}</strong> : 100 000 € ${isEN ? 'per parent and per child, renewable every 15 years' : 'par parent et par enfant, renouvelable tous les 15 ans'}</li>
        <li><strong>${isEN ? 'AV before 70' : 'AV avant 70 ans'}</strong> : 152 500 € ${isEN ? 'abatement per beneficiary (art. 990 I CGI)' : 'd\'abattement par bénéficiaire (art. 990 I CGI)'}</li>
        <li><strong>${isEN ? 'AV after 70' : 'AV après 70 ans'}</strong> : 30 500 € ${isEN ? 'global abatement (art. 757 B CGI)' : 'd\'abattement global (art. 757 B CGI)'}</li>
        <li><strong>${isEN ? 'Bare ownership donation' : 'Donation nue-propriété'}</strong> : ${isEN ? 'reduces taxable base based on donor age (younger = bigger discount)' : 'réduit la base taxable selon l\'âge du donateur (plus jeune = plus gros abattement)'}</li>
        <li><strong>${isEN ? 'Spouse/PACS' : 'Conjoint/PACS'}</strong> : ${isEN ? 'fully exempt for inheritance (since 2007)' : 'totalement exonéré pour succession (depuis 2007)'}</li>
      </ul>
    </div>
  `;

  // Donation handler
  $('#don-compute', viewEl).addEventListener('click', () => {
    const amount = Number($('#don-amount', viewEl).value) || 0;
    const benef = $('#don-benef', viewEl).value;
    const disabled = $('#don-disabled', viewEl).checked;
    const dismembered = $('#don-dismembered', viewEl).checked;
    const age = Number($('#don-age', viewEl).value) || 60;

    let baseAmount = amount;
    let dismembrInfo = '';
    if (dismembered) {
      const u = valueUsufruit(amount, age);
      baseAmount = u.nuePropriete;
      dismembrInfo = `
        <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;margin-bottom:10px;font-size:12px;">
          🔓 ${isEN ? 'Dismemberment' : 'Démembrement'} : ${isEN ? 'taxable base reduced to bare ownership' : 'base taxable réduite à la nue-propriété'} = <strong>${fmtEUR(u.nuePropriete)}</strong> (${u.pctNue.toFixed(0)}% ${isEN ? 'of full value' : 'de la valeur'})
        </div>`;
    }

    const r = computeDonationTax(baseAmount, benef, disabled);
    const saved = computeDonationTax(amount, benef, disabled).tax - r.tax;

    $('#don-result', viewEl).innerHTML = `
      ${dismembrInfo}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
        <div>${isEN ? 'Abatement applied' : 'Abattement appliqué'}</div><div style="text-align:right;font-family:var(--font-mono);">${fmtEUR(r.abatement)}</div>
        <div>${isEN ? 'Taxable base' : 'Base taxable'}</div><div style="text-align:right;font-family:var(--font-mono);">${fmtEUR(r.taxable)}</div>
        <div><strong>${isEN ? 'Tax due' : 'Droits dus'}</strong></div><div style="text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent-red);">${fmtEUR(r.tax)}</div>
        <div>${isEN ? 'Effective rate' : 'Taux effectif'}</div><div style="text-align:right;font-family:var(--font-mono);">${r.effectiveRate.toFixed(2)} %</div>
        ${dismembered && saved > 0 ? `<div style="color:var(--accent-green);">💰 ${isEN ? 'Saved vs full ownership' : 'Économisé vs pleine propriété'}</div><div style="text-align:right;font-family:var(--font-mono);color:var(--accent-green);font-weight:700;">${fmtEUR(saved)}</div>` : ''}
      </div>
    `;
  });

  // Succession handler
  $('#suc-compute', viewEl).addEventListener('click', () => {
    const children = Number($('#suc-children', viewEl).value) || 0;
    const spouseAlive = $('#suc-spouse', viewEl).value === '1';
    const avAmount = Number($('#suc-av', viewEl).value) || 0;
    const successionAmount = totalWealth - avAmount;

    // Hypothèse simplifiée : si conjoint, il prend l'usufruit (exonéré). Patrimoine répartit en nue-propriété aux enfants.
    let perChild = children > 0 ? successionAmount / children : 0;
    if (spouseAlive && children > 0) {
      // Conjoint usufruit : enfants reçoivent ~70% de la valeur en nue-propriété (hypothèse âge 60)
      perChild = (successionAmount * 0.6) / children;
    }
    const taxPerChild = computeDonationTax(perChild, 'child').tax;
    const totalTax = taxPerChild * children;

    const av = avAmount > 0 ? computeAVTransmission(avAmount, true, Math.max(1, children)) : null;

    $('#suc-result', viewEl).innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
        <div>${isEN ? 'Wealth (excl. AV)' : 'Patrimoine (hors AV)'}</div><div style="text-align:right;font-family:var(--font-mono);">${fmtEUR(successionAmount)}</div>
        <div>${isEN ? 'Per child (taxable)' : 'Par enfant (taxable)'}</div><div style="text-align:right;font-family:var(--font-mono);">${fmtEUR(perChild)}</div>
        <div>${isEN ? 'Tax per child' : 'Droits par enfant'}</div><div style="text-align:right;font-family:var(--font-mono);">${fmtEUR(taxPerChild)}</div>
        <div><strong>${isEN ? 'Total inheritance tax' : 'Total droits succession'}</strong></div><div style="text-align:right;font-family:var(--font-mono);color:var(--accent-red);font-weight:700;">${fmtEUR(totalTax)}</div>
        ${av ? `<div>AV (152 500 €/${isEN ? 'beneficiary' : 'bénéficiaire'})</div><div style="text-align:right;font-family:var(--font-mono);">${fmtEUR(av.abatement)} ${isEN ? 'tax-free' : 'exonérés'}</div>
        <div>${isEN ? 'AV tax (20% then 31.25%)' : 'Taxes AV (20% puis 31.25%)'}</div><div style="text-align:right;font-family:var(--font-mono);color:var(--accent-orange);">${fmtEUR(av.tax)}</div>` : ''}
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;">
        💡 ${isEN ? 'Tips' : 'Pistes d\'optimisation'} :
        <ul style="margin:6px 0 0 14px;line-height:1.8;">
          ${perChild > 100000 ? `<li>${isEN ? 'Donate now: each parent can give 100,000€/child every 15 years tax-free' : 'Donne dès maintenant : chaque parent peut donner 100 000€/enfant tous les 15 ans en exonération totale'}</li>` : ''}
          ${avAmount < 152500 * Math.max(1, children) ? `<li>${isEN ? `Max out AV before 70: ${fmtEUR(152500 * Math.max(1, children))} possible tax-free` : `Maxe l'AV avant 70 ans : ${fmtEUR(152500 * Math.max(1, children))} possibles en exonération`}</li>` : ''}
          <li>${isEN ? 'Consider bare ownership donation: -50% to -80% on taxable base' : 'Envisage donation nue-propriété : -50% à -80% sur la base taxable'}</li>
        </ul>
      </div>
    `;
  });

  // Example
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#don-amount', viewEl).value = 300000;
    $('#don-dismembered', viewEl).checked = true;
    $('#don-compute', viewEl).click();
  });
}
