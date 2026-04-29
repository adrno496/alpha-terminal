// Module 15 — Trade Journal Analyzer
import { $, toast } from '../core/utils.js';
import { SYSTEM_TRADE_JOURNAL } from '../prompts/trade-journal.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'trade-journal';

export function renderTradeJournalView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.trade-journal.label'), t('mod.trade-journal.desc'), { example: t('mod.trade-journal.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.trade-journal.trades_title')}</div>
      <p style="color:var(--text-secondary);font-size:12.5px;margin-bottom:10px;">
        Format suggéré (CSV ou paragraphes libres) : <code>date | ticker | side | entrée | sortie | size | rationale</code>
      </p>
      <textarea id="tj-trades" class="textarea" rows="12" placeholder="2026-04-15 | NVDA | LONG | $135 | $148 | $5000 | breakout post-earnings"></textarea>
      <div class="field"><label class="field-label">${t('mod.trade-journal.period')}</label><input id="tj-period" class="input" /></div>
      <button id="tj-run" class="btn-primary">${t('mod.trade-journal.run')}</button>
    </div>
    <div id="tj-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  bindDraft(MODULE_ID, 'tj-trades');
  $('#tj-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#tj-trades').value = `2026-01-15 | NVDA | LONG | $135 | $148 | $5000 | breakout post-earnings — gain $370
2026-01-22 | TSLA | LONG | $410 | $385 | $8000 | dip buy mauvais timing — perte -$487
2026-02-03 | BTC | LONG | $98000 | $110000 | $3000 | trend following — gain $367
2026-02-12 | AAPL | SHORT | $230 | $232 | $4000 | overvaluation — petite perte
2026-02-20 | NVDA | LONG | $150 | $145 | $10000 | revenge trade après TSLA — perte -$333 (trop sizé)
2026-03-01 | MSFT | LONG | $410 | $445 | $5000 | swing 1 mois — gain $427
2026-03-10 | SOL | LONG | $190 | $215 | $2000 | momentum crypto — gain $263
2026-03-20 | META | SHORT | $580 | $610 | $3000 | thèse foirée — perte -$155
2026-04-01 | NVDA | LONG | $145 | $158 | $7000 | re-entry après pre-mortem — gain $627`;
    $('#tj-period').value = 'Q1 2026';
  });
}

async function run() {
  const out = $('#tj-output');
  const trades = $('#tj-trades').value.trim();
  const period = $('#tj-period').value.trim();
  if (!trades) { out.innerHTML = '<div class="alert alert-danger">Colle tes trades.</div>'; return; }
  const userMsg = `Période : ${period || 'non précisée'}\n\nTrades :\n${trades}\n\nApplique ton analyse complète.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_TRADE_JOURNAL,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 5000,
      recordInput: { trades, period }
    }, out, { onTitle: () => `Trade Journal · ${period || new Date().toLocaleDateString('fr-FR')}` });
    toast('Analyse terminée', 'success');
  } catch {}
}
