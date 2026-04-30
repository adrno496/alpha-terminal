// F1 — Analyse des frais cachés : inventaire + impact 10/20/30 ans + alternatives + LLM
import { $, toast } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { feesImpact10y20y30y } from '../ui/charts.js';
import { SYSTEM_FEES_ANALYSIS, SYSTEM_FEES_ANALYSIS_EN } from '../prompts/fees-analysis.js';

const MODULE_ID = 'fees-analysis';
const HYPO_KEY = 'alpha-terminal:fees:hypotheses';

let _feesDb = null;
async function loadFeesDb() {
  if (_feesDb) return _feesDb;
  try {
    const r = await fetch('data/etf-fees-fr.json');
    _feesDb = await r.json();
  } catch {
    _feesDb = { etfs: {}, alternatives: {}, av_contracts: {}, brokers: {} };
  }
  return _feesDb;
}

export function calculateFeesImpact(capital, annualFee, annualReturn, years) {
  const withoutFees = capital * Math.pow(1 + annualReturn, years);
  const netReturn = annualReturn - annualFee;
  const withFees = capital * Math.pow(1 + netReturn, years);
  const lostToFees = withoutFees - withFees;
  return {
    capitalWithoutFees: withoutFees,
    capitalWithFees: withFees,
    totalLostToFees: lostToFees,
    feesPercentageOfGrowth: (withoutFees - capital) > 0 ? (lostToFees / (withoutFees - capital)) * 100 : 0
  };
}

function getHypotheses() {
  try {
    const stored = JSON.parse(localStorage.getItem(HYPO_KEY) || 'null');
    if (stored && typeof stored.rendementMoyen === 'number') return stored;
  } catch {}
  return { rendementMoyen: 0.07, horizonAnalyseDefaut: 30 };
}

function saveHypotheses(h) {
  localStorage.setItem(HYPO_KEY, JSON.stringify(h));
}

function findAlternatives(ticker, feesDb) {
  const etf = feesDb.etfs[ticker];
  if (!etf) return [];
  const alts = feesDb.alternatives[etf.type] || [];
  return alts.filter(t => t !== ticker).map(t => ({ ticker: t, ...feesDb.etfs[t] })).filter(a => a.ter < etf.ter);
}

export async function renderFeesAnalysisView(viewEl) {
  const isEN = getLocale() === 'en';
  const hypo = getHypotheses();
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.fees-analysis.label'), t('mod.fees-analysis.desc'), { example: t('mod.fees-analysis.example'), moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">⚙️ ${isEN ? 'Hypotheses' : 'Hypothèses'}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;">
        <div class="field" style="margin:0;">
          <label class="field-label">${isEN ? 'Annual return %' : 'Rendement annuel %'}</label>
          <input id="fee-return" class="input" type="number" step="0.5" value="${(hypo.rendementMoyen * 100).toFixed(1)}" style="max-width:120px;" />
        </div>
        <div class="field" style="margin:0;">
          <label class="field-label">${isEN ? 'Horizon (years)' : 'Horizon (années)'}</label>
          <input id="fee-horizon" class="input" type="number" step="1" min="5" max="50" value="${hypo.horizonAnalyseDefaut}" style="max-width:120px;" />
        </div>
        <button id="fee-recalc" class="btn-secondary">🔄 ${isEN ? 'Recompute' : 'Recalculer'}</button>
      </div>
    </div>

    <div id="fee-inventory" class="card"></div>
    <div id="fee-impact-card" class="card" style="height:300px;"><canvas id="fee-impact-chart"></canvas></div>
    <div id="fee-alternatives" class="card"></div>

    <div class="card">
      <div class="card-title">🤖 ${isEN ? 'AI synthesis & action plan' : 'Synthèse IA & plan d\'action'}</div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">${isEN ? 'Optional : have the AI summarize your fee analysis with a personalized action plan and tax warnings.' : 'Optionnel : laisse l\'IA synthétiser ton analyse avec un plan d\'action personnalisé et des warnings fiscaux.'}</p>
      <div id="fee-llm-out"></div>
      <button id="fee-llm-run" class="btn-primary">🤖 ${t('mod.fees-analysis.run')}</button>
    </div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => refresh(viewEl, exampleHoldings()));

  $('#fee-recalc').addEventListener('click', () => {
    const r = parseFloat($('#fee-return').value) / 100;
    const h = parseInt($('#fee-horizon').value, 10);
    saveHypotheses({ rendementMoyen: r, horizonAnalyseDefaut: h });
    listWealth().then(holdings => refresh(viewEl, holdings)).catch(() => refresh(viewEl, []));
  });

  const holdings = await listWealth().catch(() => []);
  refresh(viewEl, holdings);
}

async function refresh(viewEl, holdings) {
  const isEN = getLocale() === 'en';
  const feesDb = await loadFeesDb();
  const hypo = getHypotheses();
  const annualReturn = hypo.rendementMoyen;
  const horizon = hypo.horizonAnalyseDefaut;

  // Inventaire avec auto-fill TER depuis dataset
  const inventory = holdings.map(h => {
    const tk = (h.ticker || '').toUpperCase();
    const etf = feesDb.etfs[tk];
    const ter = h.ter != null ? Number(h.ter) / 100 : (etf ? etf.ter / 100 : null);
    return {
      ...h,
      tickerUp: tk,
      etfMatch: etf,
      ter,
      ticker: h.ticker
    };
  });

  // Impact total + détail
  let totalCapital = 0, annualFeeTotal = 0;
  const lines = [];
  for (const h of inventory) {
    const v = Number(h.value) || 0;
    if (v <= 0 || h.ter == null) continue;
    totalCapital += v;
    const annualFee = v * h.ter;
    annualFeeTotal += annualFee;
    const impact = calculateFeesImpact(v, h.ter, annualReturn, horizon);
    lines.push({ ...h, annualFee, impact });
  }

  // Inventory render
  $('#fee-inventory').innerHTML = `
    <div class="card-title">📋 ${isEN ? 'Fee inventory' : 'Inventaire des frais'}</div>
    ${inventory.length === 0 ? `<p style="color:var(--text-muted);">${isEN ? 'No holdings detected. Add some in the Wealth module.' : 'Aucun holding détecté. Ajoute des positions dans le module Patrimoine.'}</p>` : `
      <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px;">Ticker</th>
          <th style="text-align:left;padding:6px;">${isEN ? 'Name' : 'Nom'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Value €' : 'Valeur €'}</th>
          <th style="text-align:right;padding:6px;">TER %</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Annual cost' : 'Coût/an'}</th>
          <th style="text-align:right;padding:6px;">${horizon}y</th>
        </tr></thead>
        <tbody>
          ${inventory.map(h => {
            const v = Number(h.value) || 0;
            const annualFee = h.ter ? v * h.ter : 0;
            const impact = h.ter ? calculateFeesImpact(v, h.ter, annualReturn, horizon) : null;
            return `<tr style="border-bottom:1px solid var(--border);">
              <td style="padding:5px;font-family:var(--font-mono);">${escape(h.ticker || '—')}</td>
              <td style="padding:5px;">${escape(h.name || '')}${h.etfMatch ? ` <span style="color:var(--text-muted);font-size:10px;">${h.etfMatch.replication}</span>` : ''}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${fmt(v)}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${h.ter != null ? (h.ter * 100).toFixed(2) : '<span style="color:var(--text-muted);">?</span>'}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${annualFee ? fmt(annualFee) : '—'}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${impact ? fmt(impact.totalLostToFees) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top:14px;padding:10px;background:var(--bg-tertiary);border-radius:4px;font-size:13px;">
        💸 <strong>${isEN ? 'Total annual fees' : 'Frais payés cette année'}</strong> : <span style="color:var(--accent-red);font-family:var(--font-mono);">${fmt(annualFeeTotal)} €</span>
        · <strong>${isEN ? `Cumulated over ${horizon} years (with compounding)` : `Cumulés sur ${horizon} ans (avec composition)`}</strong> : <span style="color:var(--accent-red);font-family:var(--font-mono);">${fmt(lines.reduce((s, l) => s + l.impact.totalLostToFees, 0))} €</span>
      </div>
    `}
  `;

  // Impact chart
  if (lines.length > 0) {
    const scenarios = [
      {
        label: isEN ? 'Without fees' : 'Sans frais',
        points: [10, 20, 30].map(y => ({ years: y, value: totalCapital * Math.pow(1 + annualReturn, y) }))
      },
      {
        label: isEN ? 'With current fees' : 'Avec tes frais actuels',
        points: [10, 20, 30].map(y => {
          const weightedFee = lines.reduce((s, l) => s + (Number(l.value) || 0) * l.ter, 0) / totalCapital;
          return { years: y, value: totalCapital * Math.pow(1 + annualReturn - weightedFee, y) };
        })
      }
    ];
    const canvas = $('#fee-impact-chart');
    if (canvas) {
      try {
        if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }
        canvas._chart = feesImpact10y20y30y(canvas, scenarios);
      } catch (e) { console.warn(e); }
    }
  }

  // Alternatives
  const altsHtml = [];
  for (const h of inventory) {
    if (!h.etfMatch) continue;
    const alts = findAlternatives(h.tickerUp, feesDb);
    if (alts.length === 0) continue;
    const cheapest = alts.sort((a, b) => a.ter - b.ter)[0];
    const v = Number(h.value) || 0;
    const currentImpact = calculateFeesImpact(v, h.ter, annualReturn, horizon);
    const altImpact = calculateFeesImpact(v, cheapest.ter / 100, annualReturn, horizon);
    const saving = currentImpact.totalLostToFees - altImpact.totalLostToFees;
    altsHtml.push(`
      <div style="padding:10px;border-bottom:1px solid var(--border);font-size:12.5px;">
        <strong>${escape(h.tickerUp)}</strong> (TER ${(h.ter * 100).toFixed(2)}%) →
        <strong style="color:var(--accent-green);">${escape(cheapest.ticker)}</strong> (TER ${cheapest.ter.toFixed(2)}%)
        <br><span style="color:var(--text-muted);">${escape(cheapest.name)}</span>
        <br>💰 <strong>${isEN ? 'Saving' : 'Économie'} ${horizon} ${isEN ? 'years' : 'ans'}</strong> : <span style="color:var(--accent-green);font-family:var(--font-mono);">${fmt(saving)} €</span>
      </div>
    `);
  }
  $('#fee-alternatives').innerHTML = `
    <div class="card-title">🎯 ${isEN ? 'Cheaper alternatives' : 'Alternatives moins chères'}</div>
    ${altsHtml.length ? altsHtml.join('') : `<p style="color:var(--text-muted);font-size:12.5px;">${isEN ? 'No cheaper alternatives detected for your holdings (or TER not configured).' : 'Aucune alternative moins chère détectée (ou TER non renseigné). Saisis les TER de tes ETF dans le module Patrimoine pour activer cette fonction.'}</p>`}
  `;

  // LLM run
  $('#fee-llm-run').addEventListener('click', async () => {
    if (lines.length === 0) { toast(isEN ? 'No fee data to analyze' : 'Aucune donnée de frais à analyser', 'error'); return; }
    const out = $('#fee-llm-out');
    const totalLost = lines.reduce((s, l) => s + l.impact.totalLostToFees, 0);
    const userMsg = isEN
      ? `Analyze the fees on this portfolio:
- Total capital: €${fmt(totalCapital)}
- Total annual fees: €${fmt(annualFeeTotal)} (= ${(annualFeeTotal / totalCapital * 100).toFixed(2)}% weighted)
- Cumulative loss over ${horizon} years: €${fmt(totalLost)}
- Return assumption: ${(annualReturn * 100).toFixed(1)}%/year

Per-line breakdown:
${lines.map(l => `- ${l.ticker || l.name} (${(l.ter * 100).toFixed(2)}% TER): €${fmt(l.value)} → annual cost €${fmt(l.annualFee)}, lost over ${horizon}y €${fmt(l.impact.totalLostToFees)}`).join('\n')}

Provide: (1) summary, (2) per-line detail, (3) cheaper alternatives, (4) 3-5 step action plan, (5) tax warnings.`
      : `Analyse mes frais sur ce portefeuille :
- Capital total : ${fmt(totalCapital)} €
- Frais annuels totaux : ${fmt(annualFeeTotal)} € (= ${(annualFeeTotal / totalCapital * 100).toFixed(2)}% pondéré)
- Manque à gagner cumulé sur ${horizon} ans : ${fmt(totalLost)} €
- Hypothèse rendement : ${(annualReturn * 100).toFixed(1)}%/an

Détail par poste :
${lines.map(l => `- ${l.ticker || l.name} (${(l.ter * 100).toFixed(2)}% TER) : ${fmt(l.value)} € → coût/an ${fmt(l.annualFee)} €, perdu/${horizon}y ${fmt(l.impact.totalLostToFees)} €`).join('\n')}

Donne-moi : (1) un récap, (2) un détail par poste, (3) des alternatives moins chères, (4) un plan d'action 3-5 étapes, (5) les warnings fiscaux.`;

    runAnalysis(MODULE_ID, {
      system: getLocale() === 'en' ? SYSTEM_FEES_ANALYSIS_EN : SYSTEM_FEES_ANALYSIS,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 4000,
      recordInput: { totalCapital, annualFeeTotal, totalLost, horizon, lines: lines.map(l => ({ ticker: l.ticker, ter: l.ter, value: l.value })) }
    }, out);
  });
}

function exampleHoldings() {
  return [
    { id: 'ex1', name: 'Amundi MSCI World', ticker: 'CW8', value: 35000, ter: 0.38, category: 'etf', currency: 'EUR' },
    { id: 'ex2', name: 'Lyxor CAC 40',      ticker: 'CAC', value: 12000, ter: 0.25, category: 'etf', currency: 'EUR' },
    { id: 'ex3', name: 'AV Boursorama',     ticker: '',    value: 28000, ter: 0.75, category: 'retirement', currency: 'EUR', notes: 'Frais 0.75% gestion' },
    { id: 'ex4', name: 'PEA Bourse Direct', ticker: '',    value: 12500, ter: 0.10, category: 'stocks', currency: 'EUR', notes: 'Frais courtage estimés' }
  ];
}

function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
