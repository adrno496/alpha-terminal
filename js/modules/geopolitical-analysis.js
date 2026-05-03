// Analyse géopolitique — module LLM-augmented avec web search préférentiel.
// Couvre : risques régionaux, impact marché, hedges, surveillance court terme.
import { $, toast } from '../core/utils.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { SYSTEM_GEOPOLITICAL_ANALYSIS, buildGeopoliticalPrompt } from '../prompts/geopolitical-analysis.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'geopolitical-analysis';

const REGIONS = [
  { id: 'global',         label: { fr: '🌍 Global / multi-régions',  en: '🌍 Global / multi-region' } },
  { id: 'europe',         label: { fr: '🇪🇺 Europe',                  en: '🇪🇺 Europe' } },
  { id: 'usa',            label: { fr: '🇺🇸 États-Unis',              en: '🇺🇸 United States' } },
  { id: 'china',          label: { fr: '🇨🇳 Chine',                   en: '🇨🇳 China' } },
  { id: 'middle_east',    label: { fr: '🕌 Moyen-Orient',             en: '🕌 Middle East' } },
  { id: 'russia',         label: { fr: '🇷🇺 Russie / CEI',            en: '🇷🇺 Russia / CIS' } },
  { id: 'india',          label: { fr: '🇮🇳 Inde / Asie du Sud',      en: '🇮🇳 India / South Asia' } },
  { id: 'asia_pacific',   label: { fr: '🌏 Asie-Pacifique',           en: '🌏 Asia-Pacific' } },
  { id: 'latam',          label: { fr: '🌎 Amérique latine',          en: '🌎 Latin America' } },
  { id: 'africa',         label: { fr: '🌍 Afrique',                  en: '🌍 Africa' } }
];

const QUICK_TOPICS = {
  fr: [
    'Tensions Taïwan / Mer de Chine du Sud',
    'Conflit Ukraine-Russie : impact énergétique 2026',
    'Élections US 2026 : impact policies tech / chinois',
    'Iran / Israël / régionalisation Moyen-Orient',
    'BRICS+ et désdollarisation des échanges',
    'Sanctions semi-conducteurs Chine',
    'Risque dette souveraine zone euro (Italie / France)',
    'Routes maritimes : Suez / Hormuz / Malacca'
  ],
  en: [
    'Taiwan / South China Sea tensions',
    'Ukraine-Russia: energy impact 2026',
    'US 2026 elections: impact on tech/China policies',
    'Iran / Israel / Middle East regionalization',
    'BRICS+ and trade de-dollarization',
    'China semiconductor sanctions',
    'Eurozone sovereign debt risk (Italy / France)',
    'Shipping lanes: Suez / Hormuz / Malacca'
  ]
};

export function renderGeopoliticalAnalysisView(viewEl) {
  const isEN = getLocale() === 'en';
  const lang = isEN ? 'en' : 'fr';

  viewEl.innerHTML = `
    ${moduleHeader('🌍 ' + t('mod.geopolitical-analysis.label'), t('mod.geopolitical-analysis.desc'), { example: t('mod.geopolitical-analysis.example'), moduleId: MODULE_ID })}

    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;margin-bottom:12px;">
        <label>${isEN ? 'Region focus' : 'Région ciblée'}
          <select id="geo-region" class="input">
            ${REGIONS.map(r => `<option value="${r.id}">${r.label[lang]}</option>`).join('')}
          </select>
        </label>
        <label>${isEN ? 'Time horizon' : 'Horizon'}
          <select id="geo-horizon" class="input">
            <option value="short">${isEN ? 'Short term (0-3 months)' : 'Court terme (0-3 mois)'}</option>
            <option value="mid" selected>${isEN ? 'Both (0-12 months)' : 'Combiné (0-12 mois)'}</option>
            <option value="long">${isEN ? 'Long term (12+ months)' : 'Long terme (12+ mois)'}</option>
          </select>
        </label>
      </div>

      <label style="font-size:13px;">${isEN ? 'Specific topic / question' : 'Sujet / question spécifique'}
        <textarea id="geo-input" class="textarea" rows="3" placeholder="${isEN ? 'Ex: Will the Taiwan tensions lead to a tech sell-off? Should I hedge my US tech exposure?' : 'Ex: Les tensions Taïwan vont-elles déclencher un sell-off tech ? Dois-je hedger mon exposition tech US ?'}"></textarea>
      </label>

      <div style="margin-top:10px;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${isEN ? 'Quick topics' : 'Sujets rapides'} :</div>
        <div id="geo-quick-topics" style="display:flex;flex-wrap:wrap;gap:6px;">
          ${QUICK_TOPICS[lang].map(q => `<button class="btn-ghost" data-quick="${q.replace(/"/g, '&quot;')}" style="font-size:11px;padding:4px 10px;">${q}</button>`).join('')}
        </div>
      </div>

      <button id="geo-run" class="btn-primary" style="margin-top:14px;">${isEN ? '🌍 Run geopolitical analysis' : '🌍 Lancer l’analyse géopolitique'}</button>
    </div>

    <div id="geo-output"></div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);

  // Quick topics → fill input
  viewEl.querySelectorAll('[data-quick]').forEach(b => {
    b.addEventListener('click', () => { $('#geo-input').value = b.getAttribute('data-quick'); $('#geo-input').focus(); });
  });

  // Example button (in header)
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#geo-region').value = 'middle_east';
    $('#geo-input').value = isEN
      ? 'Middle East tensions escalation: oil price scenarios for next 90 days and impact on European industrials'
      : 'Escalation tensions Moyen-Orient : scénarios prix du pétrole 90 jours et impact sur industriels européens';
    run();
  });

  $('#geo-run').addEventListener('click', run);
}

async function run() {
  const out = $('#geo-output');
  const isEN = getLocale() === 'en';
  const region = $('#geo-region').value;
  const horizon = $('#geo-horizon').value;
  const input = $('#geo-input').value.trim();
  if (!input) {
    toast(isEN ? 'Please enter a topic or question' : 'Saisis un sujet ou une question', 'warning');
    return;
  }

  const lang = isEN ? 'English' : 'français';
  const sys = SYSTEM_GEOPOLITICAL_ANALYSIS.replace('${LANG}', lang);
  let userMsg = buildGeopoliticalPrompt(input, region);
  if (horizon === 'short') userMsg += '\n\nFOCUS : événements et catalyseurs des 0-3 prochains mois uniquement.';
  if (horizon === 'long') userMsg += '\n\nFOCUS : tendances structurelles 12+ mois. Donne aussi un scénario 5 ans.';

  await runAnalysis(MODULE_ID, {
    system: sys,
    messages: [{ role: 'user', content: userMsg }],
    recordInput: `${region} · ${input.slice(0, 80)}`,
    useWebSearch: true  // préfère les providers avec web search natif (Perplexity/Grok)
  }, out, {
    onTitle: (title) => { /* le router passera le titre dans la sauvegarde */ }
  });
}
