// Module 2 — Macro Dashboard (web search ON par défaut)
import { $, toast } from '../core/utils.js';
import { SYSTEM_MACRO } from '../prompts/macro-dashboard.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'macro-dashboard';

const FIELDS = [
  { id: 'fed', label: 'Fed Funds (%)', val: '4.25' },
  { id: 'ecb', label: 'ECB Deposit (%)', val: '2.75' },
  { id: 'cpiUS', label: 'CPI US YoY (%)', val: '2.7' },
  { id: 'cpiEU', label: 'CPI EU YoY (%)', val: '2.4' },
  { id: 'us2y', label: 'US 2Y (%)', val: '4.05' },
  { id: 'us10y', label: 'US 10Y (%)', val: '4.40' },
  { id: 'dxy', label: 'DXY', val: '105' },
  { id: 'gold', label: 'Gold ($/oz)', val: '3200' },
  { id: 'oil', label: 'WTI Oil ($)', val: '72' },
  { id: 'vix', label: 'VIX', val: '15' },
  { id: 'btc', label: 'BTC ($)', val: '95000' },
  { id: 'sp500', label: 'S&P 500', val: '5800' },
  { id: 'hyOAS', label: 'HY OAS (bps)', val: '320' },
  { id: 'unemp', label: 'US Unemp (%)', val: '4.1' }
];

export function renderMacroDashboardView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.macro-dashboard.label'), t('mod.macro-dashboard.desc'), { example: t('mod.macro-dashboard.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">Mode</div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="mc-mode" value="auto" checked /> ${t('mod.macro-dashboard.mode_auto')}</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="mc-mode" value="manual" /> ${t('mod.macro-dashboard.mode_manual')}</label>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Macro inputs (manual mode)</div>
      <div id="mc-grid" class="field-row-3"></div>
      <div class="field" style="margin-top:8px;"><label class="field-label">${t('common.notes')}</label><textarea id="mc-notes" class="textarea" rows="2"></textarea></div>
    </div>
    <button id="mc-run" class="btn-primary">${t('mod.macro-dashboard.run')}</button>
    <div id="mc-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#mc-grid').innerHTML = FIELDS.map(f => `
    <div class="field"><label class="field-label">${f.label}</label><input class="input" id="mc-${f.id}" value="${f.val}" /></div>
  `).join('');
  $('#mc-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { document.querySelector('input[name="mc-mode"][value="auto"]').checked = true; run(); });
}

async function run() {
  const out = $('#mc-output');
  const mode = document.querySelector('input[name="mc-mode"]:checked').value;
  const useWeb = mode === 'auto';
  const d = { notes: $('#mc-notes').value.trim() };
  FIELDS.forEach(f => d[f.id] = $('#mc-' + f.id).value);

  let userMsg;
  if (useWeb) {
    userMsg = `Analyse le régime macro actuel (mondial). Utilise web search pour récupérer les niveaux les plus récents :
- Fed Funds, ECB Deposit, CPI YoY US/EU, US 2Y/10Y yields
- DXY, Gold, WTI oil, VIX, S&P 500, BTC
- HY OAS (bps), US unemployment

Une fois ces data récupérées, génère l'analyse complète selon ton format.${d.notes ? '\nNotes utilisateur : ' + d.notes : ''}`;
  } else {
    userMsg = `Données macro :
- Fed Funds : ${d.fed}% · ECB : ${d.ecb}%
- CPI US : ${d.cpiUS}% · CPI EU : ${d.cpiEU}%
- US 2Y : ${d.us2y}% · 10Y : ${d.us10y}% · Spread : ${(parseFloat(d.us10y)-parseFloat(d.us2y)).toFixed(2)}%
- DXY : ${d.dxy} · Gold : $${d.gold} · WTI : $${d.oil}
- VIX : ${d.vix} · BTC : $${d.btc} · S&P : ${d.sp500}
- HY OAS : ${d.hyOAS} bps · Unemp : ${d.unemp}%
Notes : ${d.notes || 'aucune'}

Génère l'analyse complète selon ton format.`;
  }

  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_MACRO,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      useWebSearch: useWeb,
      recordInput: { mode, ...d }
    }, out, { onTitle: () => useWeb ? `Macro · auto-fetch · ${new Date().toLocaleDateString('fr-FR')}` : `Macro · 2y/10y ${(parseFloat(d.us10y)-parseFloat(d.us2y)).toFixed(2)}` });
    toast('Analyse terminée', 'success');
  } catch {}
}
