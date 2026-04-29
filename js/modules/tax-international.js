// Module 22 — Tax Optimizer International (8 pays)
import { $, toast } from '../core/utils.js';
import { buildTaxPrompt, SUPPORTED_COUNTRIES, getCountryEnvelopes } from '../prompts/tax-international.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'tax-international';

const COUNTRY_FLAGS = {
  US: '🇺🇸', UK: '🇬🇧', BE: '🇧🇪', CH: '🇨🇭',
  ES: '🇪🇸', DE: '🇩🇪', IT: '🇮🇹', PT: '🇵🇹', FR: '🇫🇷'
};

const COUNTRY_CURRENCY = {
  US: '$', UK: '£', BE: '€', CH: 'CHF',
  ES: '€', DE: '€', IT: '€', PT: '€', FR: '€'
};

// Champs spécifiques par pays — rendus dynamiquement
const COUNTRY_FIELDS = {
  US: [
    { id: 'fed_bracket', label: 'Federal bracket %', type: 'select', opts: ['10','12','22','24','32','35','37'], default: '24' },
    { id: 'state', label: 'State (residence)', type: 'text', placeholder: 'CA, NY, TX, FL...' },
    { id: 'filing', label: 'Filing status', type: 'select', opts: ['Single','Married Filing Jointly','Married Filing Separately','Head of Household'], default: 'Single' },
    { id: 'env_401k', label: '401(k) Traditional ($)', type: 'number', step: 1000 },
    { id: 'env_401k_roth', label: '401(k) Roth ($)', type: 'number', step: 1000 },
    { id: 'env_ira', label: 'IRA ($)', type: 'number', step: 500 },
    { id: 'env_roth_ira', label: 'Roth IRA ($)', type: 'number', step: 500 },
    { id: 'env_hsa', label: 'HSA ($)', type: 'number', step: 100 },
    { id: 'env_brokerage', label: 'Brokerage ($)', type: 'number', step: 1000 },
    { id: 'pv_lt', label: 'Long-term capital gains realized YTD ($)', type: 'number', step: 100 },
    { id: 'pv_st', label: 'Short-term capital gains realized YTD ($)', type: 'number', step: 100 },
  ],
  UK: [
    { id: 'income_band', label: 'Income tax band', type: 'select', opts: ['Basic rate (20%)','Higher rate (40%)','Additional rate (45%)'], default: 'Higher rate (40%)' },
    { id: 'env_isa', label: 'ISA total (£)', type: 'number', step: 1000 },
    { id: 'isa_used', label: 'ISA contributions YTD (£)', type: 'number', step: 500 },
    { id: 'env_sipp', label: 'SIPP (£)', type: 'number', step: 1000 },
    { id: 'env_lisa', label: 'LISA (£)', type: 'number', step: 500 },
    { id: 'env_gia', label: 'GIA / brokerage (£)', type: 'number', step: 1000 },
    { id: 'pv_realized', label: 'CGT realized YTD (£)', type: 'number', step: 100 },
    { id: 'pv_latent', label: 'Latent gains GIA (£)', type: 'number', step: 100 },
    { id: 'div_income', label: 'Dividend income YTD (£)', type: 'number', step: 50 },
  ],
  BE: [
    { id: 'income_bracket', label: 'Tranche IPP marginale %', type: 'select', opts: ['25','40','45','50'], default: '50' },
    { id: 'region', label: 'Région', type: 'select', opts: ['Bruxelles','Wallonie','Flandre'], default: 'Bruxelles' },
    { id: 'env_pension', label: 'Épargne-pension (€)', type: 'number', step: 100 },
    { id: 'env_av_b21', label: 'AV branche 21 (€)', type: 'number', step: 1000 },
    { id: 'env_av_b23', label: 'AV branche 23 (€)', type: 'number', step: 1000 },
    { id: 'env_titres', label: 'Compte-titres (€)', type: 'number', step: 1000 },
    { id: 'tct', label: 'Total > 1M€ (TCT) ?', type: 'select', opts: ['Non','Oui'], default: 'Non' },
    { id: 'div_income', label: 'Dividendes / intérêts annuels (€)', type: 'number', step: 100 },
  ],
  CH: [
    { id: 'canton', label: 'Canton', type: 'select', opts: ['ZH','GE','VD','BE','BS','ZG','SZ','VS','TI','LU','Autre'], default: 'GE' },
    { id: 'permit', label: 'Permis / résidence', type: 'select', opts: ['Suisse / C','B (impôt source)','G (frontalier)','Autre'], default: 'Suisse / C' },
    { id: 'income', label: 'Revenu brut annuel (CHF)', type: 'number', step: 1000 },
    { id: 'env_3a', label: '3ème pilier A (CHF)', type: 'number', step: 1000 },
    { id: 'env_3b', label: '3ème pilier B / libre (CHF)', type: 'number', step: 1000 },
    { id: 'env_lpp', label: '2ème pilier LPP (CHF)', type: 'number', step: 1000 },
    { id: 'fortune', label: 'Fortune nette (CHF)', type: 'number', step: 10000 },
    { id: 'titres', label: 'Dépôt titres (CHF)', type: 'number', step: 1000 },
    { id: 'div_income', label: 'Dividendes annuels (CHF)', type: 'number', step: 100 },
  ],
  ES: [
    { id: 'irpf_bracket', label: 'Tramo IRPF %', type: 'select', opts: ['19','24','30','37','45','47'], default: '37' },
    { id: 'autonomia', label: 'Comunidad Autónoma', type: 'select', opts: ['Madrid','Cataluña','Andalucía','Valencia','País Vasco','Otra'], default: 'Madrid' },
    { id: 'env_pension', label: 'Plan Pensiones (€)', type: 'number', step: 500 },
    { id: 'env_pias', label: 'PIAS (€)', type: 'number', step: 500 },
    { id: 'env_fondos', label: 'Fondos de inversión (€)', type: 'number', step: 1000 },
    { id: 'env_etfs', label: 'ETFs (€)', type: 'number', step: 1000 },
    { id: 'pv_realized', label: 'Plusvalías mobiliarias YTD (€)', type: 'number', step: 100 },
    { id: 'div_income', label: 'Dividendos YTD (€)', type: 'number', step: 100 },
    { id: 'beckham', label: 'Régimen Beckham ?', type: 'select', opts: ['No','Sí'], default: 'No' },
  ],
  DE: [
    { id: 'einkommen', label: 'Bruttoeinkommen (€/an)', type: 'number', step: 1000 },
    { id: 'steuerklasse', label: 'Steuerklasse', type: 'select', opts: ['I','II','III','IV','V','VI'], default: 'I' },
    { id: 'kirchensteuer', label: 'Kirchensteuer ?', type: 'select', opts: ['Nein','Ja (8%)','Ja (9%)'], default: 'Nein' },
    { id: 'bundesland', label: 'Bundesland', type: 'select', opts: ['Bayern','BW','NRW','Berlin','Hessen','Andere'], default: 'Bayern' },
    { id: 'env_riester', label: 'Riester (€/an)', type: 'number', step: 100 },
    { id: 'env_ruerup', label: 'Rürup (€/an)', type: 'number', step: 1000 },
    { id: 'env_bav', label: 'bAV (€/an)', type: 'number', step: 100 },
    { id: 'depot', label: 'Depot total (€)', type: 'number', step: 1000 },
    { id: 'pv_realized', label: 'Capital gains YTD (€)', type: 'number', step: 100 },
    { id: 'div_income', label: 'Dividenden YTD (€)', type: 'number', step: 100 },
  ],
  IT: [
    { id: 'irpef_bracket', label: 'Tranche IRPEF %', type: 'select', opts: ['23','35','43'], default: '35' },
    { id: 'regime', label: 'Regime fiscale', type: 'select', opts: ['Ordinario','Forfettario 15%','Forfettario 5%'], default: 'Ordinario' },
    { id: 'env_pir', label: 'PIR (€)', type: 'number', step: 1000 },
    { id: 'env_pension', label: 'Fondi pensione (€)', type: 'number', step: 1000 },
    { id: 'env_tfr', label: 'TFR accumulato (€)', type: 'number', step: 1000 },
    { id: 'dossier', label: 'Dossier titoli (€)', type: 'number', step: 1000 },
    { id: 'env_btp', label: 'BTP / Treasury (€)', type: 'number', step: 1000 },
    { id: 'env_etf', label: 'ETF (€)', type: 'number', step: 1000 },
    { id: 'pv_realized', label: 'Capital gains YTD (€)', type: 'number', step: 100 },
    { id: 'estero', label: 'Conti / asset all\'estero ?', type: 'select', opts: ['No','Sí (IVAFE)','Sí (IVIE immo)'], default: 'No' },
  ],
  PT: [
    { id: 'irs_bracket', label: 'Escalão IRS %', type: 'select', opts: ['13.25','18','23','26','32.75','37','43.5','45','48'], default: '37' },
    { id: 'nhr', label: 'Status NHR / RNH ?', type: 'select', opts: ['Não','Sim (ativo)','Em transição'], default: 'Não' },
    { id: 'env_ppr', label: 'PPR (€)', type: 'number', step: 500 },
    { id: 'carteira', label: 'Carteira / Brokerage (€)', type: 'number', step: 1000 },
    { id: 'env_etfs', label: 'ETFs / OICVM (€)', type: 'number', step: 1000 },
    { id: 'env_immo', label: 'Imobiliário (€)', type: 'number', step: 10000 },
    { id: 'env_crypto', label: 'Crypto (€)', type: 'number', step: 500 },
    { id: 'crypto_holding', label: 'Crypto holding > 1 an ?', type: 'select', opts: ['Não','Sim','Mixte'], default: 'Sim' },
    { id: 'pv_realized', label: 'Mais-valias YTD (€)', type: 'number', step: 100 },
  ]
};

export function renderTaxInternationalView(viewEl) {
  const state = { country: 'US' };

  viewEl.innerHTML = `
    ${moduleHeader('🌍 Tax Optimizer International', 'Optimisation fiscale pour 8 pays : USA, UK, Belgique, Suisse, Espagne, Allemagne, Italie, Portugal.', { moduleId: MODULE_ID })}
    <div class="alert alert-warning" style="margin-bottom:14px;">⚠️ Educational analysis. Any operation > €/$ 10k must be validated with a licensed tax advisor in your jurisdiction.</div>

    <div class="card">
      <div class="card-title">Country selection</div>
      <div class="field">
        <label class="field-label">Country / Pays</label>
        <select id="ti-country" class="input">
          ${SUPPORTED_COUNTRIES.filter(c => c.code !== 'FR').map(c => `<option value="${c.code}">${COUNTRY_FLAGS[c.code]} ${c.label}</option>`).join('')}
        </select>
        <div class="field-hint">Pour la France, utilise le module dédié <a href="#tax-optimizer-fr">Tax Optimizer FR</a> (plus complet).</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Foyer / Personal</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Statut / Marital status</label><select id="ti-status" class="input"><option>Single</option><option>Married / Couple</option><option>Divorced</option></select></div>
        <div class="field"><label class="field-label">Dependents</label><input id="ti-deps" class="input" type="number" value="0" /></div>
        <div class="field"><label class="field-label">Annual savings capacity</label><input id="ti-savings" class="input" type="number" step="1000" value="20000" /></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Country-specific data <span id="ti-country-flag" style="float:right;font-size:18px;"></span></div>
      <div id="ti-country-fields" class="field-row-3"></div>
    </div>

    <div class="card">
      <div class="card-title">Additional notes</div>
      <textarea id="ti-notes" class="textarea" rows="3" placeholder="Multi-country exposure, expatriation plans, special situations..."></textarea>
    </div>

    <button id="ti-run" class="btn-primary">Generate tax strategy</button>
    <div id="ti-output" style="margin-top:18px;"></div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);
  $('#ti-country').addEventListener('change', () => { state.country = $('#ti-country').value; renderCountryFields(state.country); });
  $('#ti-run').addEventListener('click', () => run(state));
  renderCountryFields(state.country);
}

function renderCountryFields(country) {
  const flagEl = $('#ti-country-flag');
  if (flagEl) flagEl.textContent = COUNTRY_FLAGS[country] || '';
  const fields = COUNTRY_FIELDS[country] || [];
  const grid = $('#ti-country-fields');
  grid.innerHTML = fields.map(f => {
    if (f.type === 'select') {
      return `<div class="field"><label class="field-label">${f.label}</label>
        <select id="ti-${f.id}" class="input">
          ${f.opts.map(o => `<option ${o===f.default?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    }
    return `<div class="field"><label class="field-label">${f.label}</label>
      <input id="ti-${f.id}" class="input" type="${f.type}" ${f.step ? 'step="'+f.step+'"' : ''} ${f.placeholder ? 'placeholder="'+f.placeholder+'"' : ''} /></div>`;
  }).join('');
}

async function run(state) {
  const out = $('#ti-output');
  const country = state.country;
  const fields = COUNTRY_FIELDS[country] || [];
  const data = {
    country,
    flag: COUNTRY_FLAGS[country],
    currency: COUNTRY_CURRENCY[country],
    status: $('#ti-status').value,
    deps: $('#ti-deps').value,
    savings: $('#ti-savings').value,
    notes: $('#ti-notes').value.trim()
  };
  const countryData = {};
  for (const f of fields) {
    const el = document.getElementById('ti-' + f.id);
    if (el) countryData[f.id] = el.value;
  }
  data.countryData = countryData;

  const fieldsRecap = fields.map(f => `- ${f.label} : ${countryData[f.id] || '?'}`).join('\n');

  const userMsg = `Tax situation to optimize — Country: ${data.flag} ${country}

**Foyer / Personal**
- Status: ${data.status}
- Dependents: ${data.deps}
- Annual savings capacity: ${data.savings} ${data.currency}

**Country-specific data**
${fieldsRecap}

**Additional notes**
${data.notes || 'none'}

Generate the full tax optimization strategy according to your format. Reference ${country}-specific envelopes and rules.`;

  try {
    await runAnalysis(MODULE_ID, {
      system: buildTaxPrompt(country),
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      recordInput: data
    }, out, { onTitle: () => `Tax · ${data.flag} ${country} · ${data.status}` });
    toast('Tax strategy generated', 'success');
  } catch {}
}
