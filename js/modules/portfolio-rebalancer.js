// Module 5 — Portfolio Rebalancer + pie allocation chart
import { $, toast } from '../core/utils.js';
import { SYSTEM_PORTFOLIO } from '../prompts/portfolio-rebalancer.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { pieAllocation } from '../ui/charts.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'portfolio-rebalancer';
const ASSET_CLASSES = ['Equity US','Equity EU','Equity EM','Tech / Growth','Value / Defensive','Bonds Sov.','Bonds HY','Gold','Commodities','Real Estate','Crypto','Cash','Autre'];
const CURRENCIES = ['EUR','USD','GBP','CHF','JPY','Autre'];

function defaultPositions() {
  return [
    { asset: 'CW8 (MSCI World)', class: 'Equity US', amount: 30000, currency: 'EUR', conviction: 7 },
    { asset: 'NVDA', class: 'Tech / Growth', amount: 15000, currency: 'USD', conviction: 8 },
    { asset: 'OAT 10Y', class: 'Bonds Sov.', amount: 10000, currency: 'EUR', conviction: 5 },
    { asset: 'BTC', class: 'Crypto', amount: 5000, currency: 'USD', conviction: 9 },
    { asset: 'Cash livret', class: 'Cash', amount: 8000, currency: 'EUR', conviction: 5 },
  ];
}

let chart = null;

export function renderPortfolioRebalancerView(viewEl) {
  if (chart) { try { chart.destroy(); } catch {} chart = null; }
  const state = { positions: defaultPositions() };

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.portfolio-rebalancer.label'), t('mod.portfolio-rebalancer.desc'), { example: t('mod.portfolio-rebalancer.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">Profile & constraints</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">${t('mod.portfolio-rebalancer.risk')}</label><input id="pr-risk" class="input" type="number" min="1" max="5" value="3" /></div>
        <div class="field"><label class="field-label">Horizon (months)</label><input id="pr-horizon" class="input" type="number" min="1" value="60" /></div>
        <div class="field"><label class="field-label">Additional capital (€)</label><input id="pr-capital" class="input" type="number" min="0" step="1000" value="10000" /></div>
      </div>
      <div class="field"><label class="field-label">Objectifs / contraintes</label><textarea id="pr-goals" class="textarea"></textarea></div>
    </div>
    <div class="card">
      <div class="card-title">Positions actuelles</div>
      <table class="editable-grid" id="pr-grid"></table>
      <button id="pr-add" class="btn-secondary">+ Ajouter</button>
      <span id="pr-total" style="margin-left:14px;font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);"></span>
      <div class="chart-wrap" style="margin-top:14px;"><canvas id="pr-pie"></canvas></div>
    </div>
    <button id="pr-run" class="btn-primary">${t('mod.portfolio-rebalancer.run')}</button>
    <div id="pr-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  drawGrid(state);
  $('#pr-add').addEventListener('click', () => { state.positions.push({ asset: '', class: 'Equity US', amount: 0, currency: 'EUR', conviction: 5 }); drawGrid(state); });
  $('#pr-run').addEventListener('click', () => run(state));
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { state.positions = defaultPositions(); drawGrid(state); toast('Portfolio chargé', 'success'); });
}

function drawGrid(state) {
  const grid = $('#pr-grid');
  grid.innerHTML = `
    <thead><tr><th style="width:30%">Actif</th><th>Classe</th><th>Montant</th><th>Devise</th><th>Conviction</th><th></th></tr></thead>
    <tbody>${state.positions.map((p,i) => `
      <tr>
        <td><input data-i="${i}" data-f="asset" value="${escAttr(p.asset)}" /></td>
        <td><select data-i="${i}" data-f="class">${ASSET_CLASSES.map(c => `<option ${c===p.class?'selected':''}>${c}</option>`).join('')}</select></td>
        <td><input data-i="${i}" data-f="amount" type="number" min="0" step="100" value="${p.amount}" /></td>
        <td><select data-i="${i}" data-f="currency">${CURRENCIES.map(c => `<option ${c===p.currency?'selected':''}>${c}</option>`).join('')}</select></td>
        <td><input data-i="${i}" data-f="conviction" type="number" min="1" max="10" value="${p.conviction}" /></td>
        <td><button class="row-del" data-i="${i}" aria-label="Supprimer la ligne">×</button></td>
      </tr>`).join('')}
    </tbody>
  `;
  grid.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', e => {
      const i = +e.target.getAttribute('data-i'), f = e.target.getAttribute('data-f'), v = e.target.value;
      state.positions[i][f] = (f === 'amount' || f === 'conviction') ? +v : v;
      updateTotal(state);
    });
  });
  grid.querySelectorAll('.row-del').forEach(b => b.addEventListener('click', () => { state.positions.splice(+b.getAttribute('data-i'), 1); drawGrid(state); }));
  updateTotal(state);
}
function updateTotal(state) {
  const total = state.positions.reduce((s, p) => s + (+p.amount || 0), 0);
  $('#pr-total').textContent = `Total : ${total.toLocaleString('fr-FR')}`;
  drawPie(state);
}
function drawPie(state) {
  const canvas = document.getElementById('pr-pie'); if (!canvas) return;
  if (chart) try { chart.destroy(); } catch {}
  const byClass = {};
  state.positions.forEach(p => { if (!p.amount) return; byClass[p.class] = (byClass[p.class] || 0) + (+p.amount); });
  const items = Object.entries(byClass).map(([label, value]) => ({ label, value }));
  if (!items.length) return;
  chart = pieAllocation(canvas, items);
}
function escAttr(s) { return String(s ?? '').replace(/"/g, '&quot;'); }

async function run(state) {
  const out = $('#pr-output');
  const risk = $('#pr-risk').value, horizon = $('#pr-horizon').value, capital = $('#pr-capital').value, goals = $('#pr-goals').value.trim();
  const total = state.positions.reduce((s, p) => s + (+p.amount || 0), 0);
  const tableMd = ['| Actif | Classe | Montant | Devise | % | Conviction |','|---|---|---|---|---|---|',
    ...state.positions.map(p => {
      const pct = total ? (((+p.amount) / total) * 100).toFixed(1) : '0';
      return `| ${p.asset} | ${p.class} | ${(+p.amount).toLocaleString('fr-FR')} | ${p.currency} | ${pct}% | ${p.conviction}/10 |`;
    })].join('\n');
  const userMsg = `Portefeuille à analyser et rebalancer :

**Profil**
- Profil de risque : ${risk}/5 · Horizon : ${horizon} mois · Capital additionnel : ${capital} €
- Objectifs : ${goals || 'aucun spécifié'}

**Positions actuelles** (total : ${total.toLocaleString('fr-FR')})
${tableMd}

Génère l'analyse complète selon ton format.`;
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_PORTFOLIO,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      recordInput: { positions: state.positions, risk, horizon, capital, goals }
    }, out, { onTitle: () => `Rebalancing · ${state.positions.length} positions · profil ${risk}/5` });
    toast('Analyse terminée', 'success');
  } catch {}
}
