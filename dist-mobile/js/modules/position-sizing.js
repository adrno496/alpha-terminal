// Module 10 — Position Sizing (Kelly) + simulation chart
import { $, toast } from '../core/utils.js';
import { SYSTEM_POSITION_SIZING } from '../prompts/position-sizing.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { kellySimulation } from '../ui/charts.js';
import { ttIcon } from '../ui/tooltips.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'position-sizing';
let chart = null;

export function renderPositionSizingView(viewEl) {
  if (chart) { try { chart.destroy(); } catch {} chart = null; }

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.position-sizing.label') + ' — Kelly', t('mod.position-sizing.desc'), { example: t('mod.btn.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">Inputs trade</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Win rate (%) ${ttIcon('winrate')}</label><input id="ps-winrate" class="input" type="number" min="1" max="99" step="1" value="55" /></div>
        <div class="field"><label class="field-label">Reward / Risk (R) ${ttIcon('reward_risk')}</label><input id="ps-r" class="input" type="number" min="0.1" step="0.1" value="2.0" /></div>
        <div class="field"><label class="field-label">Capital total (€)</label><input id="ps-capital" class="input" type="number" min="0" step="1000" value="100000" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Risque max / trade (%)</label><input id="ps-maxrisk" class="input" type="number" min="0.1" max="100" step="0.1" value="2.0" /></div>
        <div class="field"><label class="field-label">Stop loss (%)</label><input id="ps-stop" class="input" type="number" min="0.1" max="100" step="0.1" value="8" /></div>
        <div class="field"><label class="field-label">${t('mod.position-sizing.conviction')}</label><input id="ps-conviction" class="input" type="number" min="1" max="10" step="1" value="7" /></div>
      </div>
      <div class="field"><label class="field-label">${t('mod.position-sizing.correlation')}</label>
        <select id="ps-corr" class="input"><option value="faible">${t('mod.position-sizing.corr_low')}</option><option value="modérée" selected>${t('mod.position-sizing.corr_med')}</option><option value="forte">${t('mod.position-sizing.corr_high')}</option></select>
      </div>
      <div id="ps-preview" class="stat-grid"></div>
      <div class="chart-wrap" style="margin-top:14px;"><canvas id="ps-chart"></canvas></div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px;"><button id="ps-resim" class="btn-ghost">⟳ Re-simuler 100 trades</button></div>
      <button id="ps-run" class="btn-primary" style="margin-top:12px;">${t('mod.position-sizing.run')}</button>
    </div>
    <div id="ps-output"></div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);
  ['ps-winrate','ps-r','ps-capital','ps-maxrisk','ps-stop','ps-conviction'].forEach(id => $('#' + id).addEventListener('input', updatePreview));
  $('#ps-corr').addEventListener('change', updatePreview);
  $('#ps-resim').addEventListener('click', drawChart);
  $('#ps-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { $('#ps-winrate').value = 60; $('#ps-r').value = 2.5; $('#ps-conviction').value = 8; updatePreview(); });
  updatePreview();
}

function readInputs() {
  return {
    winrate: parseFloat($('#ps-winrate').value) / 100,
    r: parseFloat($('#ps-r').value),
    capital: parseFloat($('#ps-capital').value),
    maxrisk: parseFloat($('#ps-maxrisk').value) / 100,
    stop: parseFloat($('#ps-stop').value) / 100,
    conviction: parseInt($('#ps-conviction').value, 10),
    correlation: $('#ps-corr').value
  };
}
function kellyFraction(p, b) { const q = 1 - p; return (b * p - q) / b; }
function formatEur(n) { if (!isFinite(n)) return '∞'; return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'; }

function updatePreview() {
  const i = readInputs();
  const k = kellyFraction(i.winrate, i.r);
  $('#ps-preview').innerHTML = `
    <div class="stat"><div class="stat-label">Kelly fraction</div><div class="stat-value ${k>0?'green':'red'}">${(k*100).toFixed(2)}%</div></div>
    <div class="stat"><div class="stat-label">Full Kelly</div><div class="stat-value">${formatEur(Math.max(0,i.capital*k))}</div></div>
    <div class="stat"><div class="stat-label">Half Kelly</div><div class="stat-value green">${formatEur(Math.max(0,i.capital*k/2))}</div></div>
    <div class="stat"><div class="stat-label">Quarter Kelly</div><div class="stat-value">${formatEur(Math.max(0,i.capital*k/4))}</div></div>
    <div class="stat"><div class="stat-label">${t('mod.position-sizing.cap_risk')}</div><div class="stat-value amber">${formatEur(i.stop>0?(i.capital*i.maxrisk)/i.stop:Infinity)}</div></div>
    <div class="stat"><div class="stat-label">EV / trade</div><div class="stat-value ${i.winrate*i.r-(1-i.winrate)>0?'green':'red'}">${((i.winrate*i.r-(1-i.winrate))*100).toFixed(2)}%</div></div>
  `;
  drawChart();
}
function drawChart() {
  const i = readInputs();
  const k = kellyFraction(i.winrate, i.r);
  const canvas = document.getElementById('ps-chart');
  if (!canvas) return;
  if (chart) try { chart.destroy(); } catch {}
  if (k <= 0) return;
  chart = kellySimulation(canvas, { winrate: i.winrate, R: i.r, capital: i.capital, kelly: k, runs: 100 });
}

async function run() {
  const out = $('#ps-output');
  const i = readInputs();
  const k = kellyFraction(i.winrate, i.r);
  const userMsg = `Voici les paramètres du trade à analyser :

- Win rate estimé : ${(i.winrate*100).toFixed(1)}%
- Reward/Risk (R) : ${i.r}
- Capital total : ${i.capital.toLocaleString('fr-FR')} €
- Risque max par trade : ${(i.maxrisk*100).toFixed(2)}% (= ${(i.capital*i.maxrisk).toLocaleString('fr-FR')} €)
- Stop loss : ${(i.stop*100).toFixed(1)}%
- Conviction : ${i.conviction}/10
- Corrélation : ${i.correlation}

Calculs préliminaires :
- Kelly fraction : ${(k*100).toFixed(2)}%
- Full Kelly : ${(i.capital*k).toLocaleString('fr-FR')} €
- Half Kelly : ${(i.capital*k/2).toLocaleString('fr-FR')} €
- Quarter Kelly : ${(i.capital*k/4).toLocaleString('fr-FR')} €

Donne-moi l'analyse complète selon ton format.`;

  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_POSITION_SIZING,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 4096,
      recordInput: i
    }, out, {
      onTitle: () => `Sizing · ${i.winrate*100}% WR / ${i.r}R / conv ${i.conviction}`
    });
    toast('Analyse terminée', 'success');
  } catch {}
}
