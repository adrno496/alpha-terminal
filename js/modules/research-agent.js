// Module 12 — Multi-Step Research Agent (THE wow factor)
import { $, toast } from '../core/utils.js';
import { SYSTEM_RESEARCH_AGENT } from '../prompts/research-agent.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'research-agent';

export function renderResearchAgentView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.research-agent.label'), t('mod.research-agent.desc'), { example: t('mod.research-agent.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.research-agent.title')}</div>
      <div class="field-row">
        <div class="field"><label class="field-label">Ticker / Name</label><input id="ra-ticker" class="input" placeholder="NVDA, AAPL, BTC, ETH..." /></div>
        <div class="field"><label class="field-label">Type</label><select id="ra-type" class="input"><option>Stock</option><option>Crypto</option><option>ETF / index</option><option>Forex</option><option>Commodity</option></select></div>
      </div>
      <div class="field"><label class="field-label">${t('mod.research-agent.ctx')}</label><textarea id="ra-ctx" class="textarea" rows="3"></textarea></div>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0;cursor:pointer;">
        <input type="checkbox" id="ra-web" checked /> ${t('mod.research-agent.web')}
      </label>
      <button id="ra-run" class="btn-primary">${t('mod.research-agent.run')}</button>
      <p style="font-size:11.5px;color:var(--text-muted);margin-top:8px;">${t('mod.research-agent.cost_hint')}</p>
    </div>
    <div id="ra-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#ra-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { $('#ra-ticker').value = 'NVDA'; run(); });
}

async function run() {
  const out = $('#ra-output');
  const ticker = $('#ra-ticker').value.trim();
  const type = $('#ra-type').value;
  const ctx = $('#ra-ctx').value.trim();
  const useWeb = $('#ra-web').checked;
  if (!ticker) { out.innerHTML = '<div class="alert alert-danger">Indique un ticker.</div>'; return; }
  const userMsg = `Cible : **${ticker}** (${type})\n${ctx ? 'Contexte : ' + ctx : ''}\n\nLance l'analyse complète multi-angle selon ton format.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_RESEARCH_AGENT,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 8000,
      useWebSearch: useWeb,
      recordInput: { ticker, type, ctx, useWeb }
    }, out, { onTitle: () => `Research Agent · ${ticker}` });
    toast('Analyse complète terminée', 'success');
  } catch {}
}
