// Module 8 — Sentiment Tracker (web search) + gauge chart
import { $, toast } from '../core/utils.js';
import { SYSTEM_SENTIMENT } from '../prompts/sentiment-tracker.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { gaugeSentiment } from '../ui/charts.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'sentiment-tracker';
let chart = null;

export function renderSentimentTrackerView(viewEl) {
  if (chart) { try { chart.destroy(); } catch {} chart = null; }
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.sentiment-tracker.label'), t('mod.sentiment-tracker.desc'), { example: t('mod.sentiment-tracker.example'), moduleId: MODULE_ID })}
    <div class="alert alert-info">${t('mod.sentiment-tracker.info')}</div>
    <div class="card">
      <div class="card-title">${t('mod.sentiment-tracker.target')}</div>
      <div class="field-row">
        <div class="field"><label class="field-label">Symbole</label><input id="st-ticker" class="input" value="NVDA" /></div>
        <div class="field"><label class="field-label">Type</label><select id="st-type" class="input"><option value="stock">Stock</option><option value="crypto">Crypto</option><option value="etf">ETF / index</option></select></div>
      </div>
      <div class="field"><label class="field-label">Contexte additionnel</label><textarea id="st-ctx" class="textarea" rows="2"></textarea></div>
    </div>
    <button id="st-run" class="btn-primary">${t('mod.sentiment-tracker.run')}</button>
    <div id="st-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#st-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { $('#st-ticker').value = 'NVDA'; run(); });
}

function extractScore(md) {
  const m = md.match(/sentiment\s*score\s*global\s*[:=]?\s*\**\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

async function run() {
  const out = $('#st-output');
  const ticker = $('#st-ticker').value.trim().toUpperCase();
  const type = $('#st-type').value;
  const ctx = $('#st-ctx').value.trim();
  if (!ticker) { out.innerHTML = '<div class="alert alert-danger">Indique un ticker.</div>'; return; }
  const subreddits = type === 'crypto' ? 'r/cryptocurrency, r/Bitcoin, r/ethfinance' : 'r/wallstreetbets, r/stocks, r/investing';
  const userMsg = `Ticker : **${ticker}** (${type})

Cherche le sentiment des 7 derniers jours sur :
- Reddit : ${subreddits}
- X/Twitter (FinTwit)
- Titres news majeurs

${ctx ? 'Contexte : ' + ctx + '\n\n' : ''}Génère l'analyse contrarian complète selon ton format.`;
  try {
    const result = await runAnalysis(MODULE_ID, {
      system: SYSTEM_SENTIMENT,
      messages: [{ role: 'user', content: userMsg }],
      useWebSearch: true,
      maxTokens: 5000,
      recordInput: { ticker, type, ctx }
    }, out, { onTitle: () => `Sentiment · ${ticker}` });

    if (!result) return; // missing keys / budget block / abort — runAnalysis a déjà géré l'UI
    const score = extractScore(result.text || '');
    if (score !== null) {
      // Détruit l'ancien gauge avant d'en créer un nouveau (évite la superposition).
      if (chart) { try { chart.destroy(); } catch {} chart = null; }
      const wrap = document.createElement('div');
      wrap.className = 'chart-wrap gauge';
      wrap.innerHTML = `<canvas id="st-gauge"></canvas><div class="gauge-overlay"><div class="gauge-score" style="color:${score<25?'#ff3355':score<45?'#ffaa00':score<55?'#888':score<75?'#88ee66':'#00ff88'}">${score}</div><div class="gauge-label">${ticker} sentiment</div></div>`;
      out.appendChild(wrap);
      chart = gaugeSentiment(document.getElementById('st-gauge'), score);
    }
    toast('Scan terminé', 'success');
  } catch (e) {
    console.error('[sentiment-tracker] run failed:', e);
  }
}
