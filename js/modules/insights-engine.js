// F8 — Insights auto : rules engine local + cache hebdo + dismiss persistant
import { $, uuid, toast } from '../core/utils.js';
import { listWealth, listSnapshots } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { computeDiversificationScore } from './diversification-score.js';
import { listBudgetEntries, getMonthlyTotals } from './budget.js';

const MODULE_ID = 'insights-engine';
const DB_NAME = 'alpha-terminal';
const STORE = 'insights_state';
const DISMISSED_KEY = 'alpha-terminal:insights:dismissed';
const LAST_RUN_KEY = 'alpha-terminal:insights:last-run';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ============== STORAGE ==============

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 7);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}
function p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

export async function listActiveInsights() {
  const store = await tx();
  return new Promise((resolve) => {
    const out = [];
    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => resolve(out);
  });
}

async function saveInsight(insight) {
  const store = await tx('readwrite');
  await p(store.put(insight));
}
async function clearInsights() {
  const store = await tx('readwrite');
  return p(store.clear());
}

function getDismissedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}
function addDismissed(id) {
  const s = getDismissedSet();
  s.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(s)));
}

// ============== INSIGHT RULES ==============

const PRIORITY_ORDER = { celebration: 0, alert: 1, warning: 2, info: 3 };

const INSIGHT_RULES = [
  // MILESTONES
  {
    id: 'milestone_100k',
    priority: 'celebration',
    condition: (ctx) => ctx.previousValue < 100000 && ctx.totalValue >= 100000,
    message: (ctx) => '🏆 100K€ atteints ! Tu fais partie du top 30% des Français en patrimoine financier.',
    moduleLink: 'wealth'
  },
  {
    id: 'milestone_500k',
    priority: 'celebration',
    condition: (ctx) => ctx.previousValue < 500000 && ctx.totalValue >= 500000,
    message: (ctx) => '🏆 500K€ atteints ! Top 10% des Français.',
    moduleLink: 'wealth'
  },
  {
    id: 'milestone_1m',
    priority: 'celebration',
    condition: (ctx) => ctx.previousValue < 1000000 && ctx.totalValue >= 1000000,
    message: (ctx) => '🏆 1M€ ! Bienvenue dans le top 1% des Français.',
    moduleLink: 'wealth'
  },
  // PERFORMANCE
  {
    id: 'best_month_ever',
    priority: 'celebration',
    condition: (ctx) => ctx.monthlyChangePct > 5 && ctx.totalValue > ctx.bestEverValue,
    message: (ctx) => `🎉 Meilleur mois jamais : +${ctx.monthlyChangePct.toFixed(1)}% (+${fmt(ctx.monthlyChangeEur)} €).`,
    moduleLink: 'wealth'
  },
  {
    id: 'rough_month',
    priority: 'warning',
    condition: (ctx) => ctx.monthlyChangePct < -5,
    message: (ctx) => `📉 Mois compliqué : ${ctx.monthlyChangePct.toFixed(1)}% (${fmt(ctx.monthlyChangeEur)} €). Pas de panique : c'est normal en investissement long terme.`,
    moduleLink: 'wealth'
  },
  // CONCENTRATION
  {
    id: 'concentration_alert',
    priority: 'alert',
    condition: (ctx) => ctx.maxPositionPct > 30,
    message: (ctx) => `⚠️ Position dominante : ${ctx.maxPositionTicker || 'une ligne'} = ${ctx.maxPositionPct.toFixed(0)}% de ton portefeuille. Considère diversifier en dessous de 25%.`,
    moduleLink: 'diversification-score'
  },
  // SCORE
  {
    id: 'low_diversification_score',
    priority: 'warning',
    condition: (ctx) => ctx.diversificationScore != null && ctx.diversificationScore < 50,
    message: (ctx) => `🎯 Score de diversification : ${ctx.diversificationScore}/100. Voir les recommandations pour passer au-dessus de 70.`,
    moduleLink: 'diversification-score'
  },
  // FRAIS
  {
    id: 'high_av_fees',
    priority: 'warning',
    condition: (ctx) => ctx.avFeesMax > 0.0080,
    message: (ctx) => `💸 Tes frais d'AV sont élevés (${(ctx.avFeesMax * 100).toFixed(2)}%). Économie possible : ~11k€ sur 30 ans en passant à Linxea Spirit 2 / Lucya (0.50%).`,
    moduleLink: 'fees-analysis'
  },
  // FISCAL WINDOWS — PEA 5 ans
  {
    id: 'pea_5y_close',
    priority: 'info',
    condition: (ctx) => ctx.peaDaysTo5Years != null && ctx.peaDaysTo5Years > 0 && ctx.peaDaysTo5Years < 90,
    message: (ctx) => `🎯 Ton PEA aura 5 ans dans ${ctx.peaDaysTo5Years} jours → exonération IR sur les retraits dès cette date.`,
    moduleLink: 'wealth-method'
  },
  // FISCAL WINDOWS — AV 8 ans
  {
    id: 'av_8y_close',
    priority: 'info',
    condition: (ctx) => ctx.avDaysTo8Years != null && ctx.avDaysTo8Years > 0 && ctx.avDaysTo8Years < 90,
    message: (ctx) => `📅 Ton AV aura 8 ans dans ${ctx.avDaysTo8Years} jours → abattement 4 600€/an sur les rachats.`,
    moduleLink: 'wealth-method'
  },
  // BUDGET
  {
    id: 'savings_rate_low',
    priority: 'warning',
    condition: (ctx) => ctx.savingsRate != null && ctx.savingsRate < 0.10 && ctx.budgetEntriesCount > 3,
    message: (ctx) => `💰 Taux d'épargne : ${(ctx.savingsRate * 100).toFixed(0)}%. Cible recommandée : 20-30%. Voir où optimiser tes dépenses.`,
    moduleLink: 'budget'
  },
  {
    id: 'savings_rate_great',
    priority: 'celebration',
    condition: (ctx) => ctx.savingsRate != null && ctx.savingsRate >= 0.30,
    message: (ctx) => `🌟 Excellent taux d'épargne : ${(ctx.savingsRate * 100).toFixed(0)}%. Tu es en mode FIRE/early retirement.`,
    moduleLink: 'budget'
  },
  // DEFENSIVE
  {
    id: 'no_defensive_assets',
    priority: 'warning',
    condition: (ctx) => ctx.bondsPct < 5 && ctx.goldPct < 3 && ctx.totalValue > 50000,
    message: (ctx) => `🛡️ Aucun actif défensif (bonds/or). À ce niveau de patrimoine, considère 5-15% défensif (AGGH, EUNA, SGLD).`,
    moduleLink: 'wealth-method'
  },
  // CASH
  {
    id: 'cash_too_high',
    priority: 'warning',
    condition: (ctx) => ctx.cashPct > 25 && ctx.cashValue > 30000,
    message: (ctx) => `💵 Cash dormant excessif : ${fmt(ctx.cashValue)} € (${ctx.cashPct.toFixed(0)}%). Au-delà de 6 mois de dépenses, l'inflation grignote ~3%/an.`,
    moduleLink: 'wealth-method'
  },
  // FR BIAS
  {
    id: 'fr_bias_extreme',
    priority: 'warning',
    condition: (ctx) => ctx.frExposurePct > 70 && ctx.totalValue > 30000,
    message: (ctx) => `🇫🇷 Biais domestique extrême : ${ctx.frExposurePct.toFixed(0)}% France. La France = 3% de la capi mondiale, considère ETF World/All-World.`,
    moduleLink: 'diversification-score'
  }
];

// ============== ENGINE ==============

export async function runInsightsEngine({ force = false } = {}) {
  // Throttle hebdo
  const lastRun = parseInt(localStorage.getItem(LAST_RUN_KEY) || '0', 10);
  if (!force && Date.now() - lastRun < SEVEN_DAYS_MS) {
    return await listActiveInsights();
  }

  // Build context
  const holdings = await listWealth().catch(() => []);
  const totalValue = holdings.reduce((s, h) => s + (Number(h.value) || 0), 0);
  if (totalValue === 0 && !force) return [];

  let snapshots = [];
  try { snapshots = await listSnapshots(); } catch {}
  const sorted = snapshots.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const last = sorted[sorted.length - 1];
  const monthAgo = sorted.find(s => Date.now() - new Date(s.date).getTime() < 35 * 86400000) || sorted[0];
  const previousValue = monthAgo?.total || totalValue;
  const monthlyChangeEur = totalValue - previousValue;
  const monthlyChangePct = previousValue > 0 ? ((totalValue - previousValue) / previousValue) * 100 : 0;
  const bestEverValue = Math.max(...sorted.map(s => s.total || 0), totalValue);

  // Top position
  let maxPositionTicker = null, maxPosValue = 0;
  for (const h of holdings) {
    const v = Number(h.value) || 0;
    if (v > maxPosValue) { maxPosValue = v; maxPositionTicker = h.ticker || h.name; }
  }
  const maxPositionPct = totalValue > 0 ? (maxPosValue / totalValue) * 100 : 0;

  // Diversification
  const divResult = computeDiversificationScore(holdings);

  // AV fees max
  let avFeesMax = 0;
  for (const h of holdings) {
    if (h.ter && (h.account || '').toLowerCase().match(/av|assurance/)) {
      const t = Number(h.ter);
      if (t > avFeesMax) avFeesMax = t;
    }
  }

  // Cash / bonds / gold / FR
  const sumByCategory = {};
  let frValue = 0;
  for (const h of holdings) {
    const v = Number(h.value) || 0;
    sumByCategory[h.category] = (sumByCategory[h.category] || 0) + v;
    if (/\.PA$|FR$/.test((h.ticker || '').toUpperCase())) frValue += v;
  }
  const cashValue = sumByCategory.cash || 0;
  const cashPct = (cashValue / totalValue) * 100;
  const bondsPct = ((sumByCategory.bonds || 0) / totalValue) * 100;
  const goldPct = ((sumByCategory.commodities || 0) / totalValue) * 100;
  const frExposurePct = (frValue / totalValue) * 100;

  // Budget : taux d'épargne du mois courant
  const ym = (new Date()).getFullYear() + '-' + String((new Date()).getMonth() + 1).padStart(2, '0');
  const budgetEntries = await listBudgetEntries({ month: ym }).catch(() => []);
  const budgetTotals = getMonthlyTotals(budgetEntries);
  const savingsRate = budgetTotals.tauxEpargne || 0;

  const ctx = {
    totalValue,
    previousValue,
    bestEverValue,
    monthlyChangeEur,
    monthlyChangePct,
    maxPositionPct,
    maxPositionTicker,
    diversificationScore: divResult.total,
    avFeesMax,
    cashValue,
    cashPct,
    bondsPct,
    goldPct,
    frExposurePct,
    savingsRate,
    budgetEntriesCount: budgetEntries.length,
    peaDaysTo5Years: null, // requires PEA opening date — TODO via wealth field
    avDaysTo8Years: null
  };

  const dismissed = getDismissedSet();
  const generated = [];
  for (const rule of INSIGHT_RULES) {
    if (dismissed.has(rule.id)) continue;
    try {
      if (rule.condition(ctx)) {
        generated.push({
          id: uuid(),
          insightId: rule.id,
          priority: rule.priority,
          message: rule.message(ctx),
          moduleLink: rule.moduleLink || null,
          generatedAt: new Date().toISOString(),
          dismissed: false,
          payload: { rule: rule.id }
        });
      }
    } catch (e) { console.warn('Insight rule failed:', rule.id, e); }
  }
  generated.sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]));

  await clearInsights();
  for (const i of generated) await saveInsight(i);
  localStorage.setItem(LAST_RUN_KEY, String(Date.now()));

  return generated;
}

// ============== UI ==============

export async function renderInsightsEngineView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.insights-engine.label'), t('mod.insights-engine.desc'), { moduleId: MODULE_ID })}
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="card-title" style="margin-bottom:2px;">${isEN ? 'Generated' : 'Générés'} <span id="ie-count" style="color:var(--text-muted);font-weight:400;">—</span></div>
        <div style="font-size:11px;color:var(--text-muted);">${isEN ? 'Last run:' : 'Dernier run :'} <span id="ie-last">—</span> · ${isEN ? 'Throttled to once a week.' : 'Throttle hebdo.'}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="ie-refresh" class="btn-secondary">🔄 ${isEN ? 'Force regenerate' : 'Forcer recalcul'}</button>
        <button id="ie-clear-dismissed" class="btn-ghost" style="font-size:12px;">↩️ ${isEN ? 'Restore dismissed' : 'Restaurer ignorés'}</button>
      </div>
    </div>
    <div id="ie-list"></div>
  `;

  $('#ie-refresh').addEventListener('click', async () => {
    const btn = $('#ie-refresh');
    btn.disabled = true;
    btn.textContent = '⏳';
    await runInsightsEngine({ force: true });
    btn.disabled = false;
    btn.textContent = '🔄 ' + (isEN ? 'Force regenerate' : 'Forcer recalcul');
    refreshList(viewEl);
    toast(isEN ? 'Insights regenerated' : 'Insights regénérés', 'success');
  });
  $('#ie-clear-dismissed').addEventListener('click', () => {
    if (!confirm(isEN ? 'Restore all dismissed insights?' : 'Restaurer tous les insights ignorés ?')) return;
    localStorage.removeItem(DISMISSED_KEY);
    runInsightsEngine({ force: true }).then(() => refreshList(viewEl));
    toast(isEN ? 'Dismissed list cleared' : 'Liste effacée', 'success');
  });

  // Run on load (respects throttle)
  await runInsightsEngine();
  refreshList(viewEl);
}

async function refreshList(viewEl) {
  const isEN = getLocale() === 'en';
  const list = await listActiveInsights().catch(() => []);
  $('#ie-count').textContent = `· ${list.length}`;
  const lastRun = parseInt(localStorage.getItem(LAST_RUN_KEY) || '0', 10);
  $('#ie-last').textContent = lastRun ? new Date(lastRun).toLocaleString() : '—';

  if (list.length === 0) {
    $('#ie-list').innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">${isEN ? '✨ No insights to show. Add holdings or come back next week.' : '✨ Aucun insight à afficher. Ajoute des holdings ou reviens la semaine prochaine.'}</div>`;
    return;
  }

  list.sort((a, b) => (PRIORITY_ORDER[a.priority] || 9) - (PRIORITY_ORDER[b.priority] || 9));

  $('#ie-list').innerHTML = list.map(ins => `
    <div class="card" style="border-left:4px solid ${priorityColor(ins.priority)};margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <div style="flex:1;font-size:13.5px;line-height:1.5;">${escape(ins.message)}</div>
      <div style="display:flex;gap:6px;">
        ${ins.moduleLink ? `<a href="#${ins.moduleLink}" class="btn-secondary" style="font-size:11px;text-decoration:none;">→ ${isEN ? 'Deep dive' : 'Approfondir'}</a>` : ''}
        <button class="btn-ghost ie-dismiss" data-id="${ins.insightId}" style="font-size:11px;color:var(--text-muted);">✕ ${isEN ? 'Dismiss' : 'Ignorer'}</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.ie-dismiss').forEach(b => b.addEventListener('click', async () => {
    addDismissed(b.dataset.id);
    await runInsightsEngine({ force: true });
    refreshList(viewEl);
    toast(isEN ? 'Dismissed' : 'Ignoré', 'info');
  }));
}

function priorityColor(p) {
  return p === 'alert' ? 'var(--accent-red)' : p === 'warning' ? 'var(--accent-orange)' : p === 'celebration' ? 'var(--accent-green)' : 'var(--accent-blue)';
}

function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
