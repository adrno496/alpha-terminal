// F6 — Méthode patrimoniale : rules engine FR + checklist + deep-dive LLM
import { $, toast } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { SYSTEM_WEALTH_METHOD, SYSTEM_WEALTH_METHOD_EN } from '../prompts/wealth-method.js';

const MODULE_ID = 'wealth-method';
const STATE_KEY = 'alpha-terminal:method:rules-state';

let _rulesCache = null;
async function loadRules() {
  if (_rulesCache) return _rulesCache;
  try {
    const r = await fetch('data/wealth-rules-fr.json');
    _rulesCache = await r.json();
  } catch {
    _rulesCache = { rules: [] };
  }
  return _rulesCache;
}

function getRulesState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}
function saveRulesState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
function setRuleStatus(ruleId, status) {
  const s = getRulesState();
  s[ruleId] = { status, updatedAt: new Date().toISOString() };
  saveRulesState(s);
}

// ============== CONTEXT BUILDER ==============

export function buildContext(holdings) {
  const ctx = {
    total_wealth: 0,
    livret_a_balance: 0,
    has_lddss: false,
    has_pea: false,
    has_av_8y_ready: false,
    has_per: false,
    has_pee_with_match: false,
    pee_versement_pct: 0,
    has_world_etf: false,
    has_em_etf: false,
    has_credit_immo: false,
    credit_age_months: 0,
    has_children: false,
    has_sci: false,
    is_lmnp: false,
    age: 35,
    tmi: 30,
    av_annual_fees: 0,
    rental_income_yearly: 0,
    real_estate_value: 0,
    dividends_yearly: 0,
    fr_exposure_pct: 0,
    stock_picking_pct: 0,
    fr_picks_pct: 0,
    crypto_pct: 0,
    bonds_pct: 0,
    gold_pct: 0,
    cash_pct: 0,
    cash_balance: 0,
    real_estate_pct: 0,
    stocks_pct: 0,
    max_position_pct: 0,
    allocation_drift: 0
  };

  if (!holdings || holdings.length === 0) return ctx;

  const totalValue = holdings.reduce((s, h) => s + (Number(h.value) || 0), 0);
  ctx.total_wealth = totalValue;
  if (totalValue === 0) return ctx;

  const sumByCategory = {};
  let avFees = [];
  let frValue = 0, peaValue = 0;
  let cryptoValue = 0, goldValue = 0, bondsValue = 0, cashValue = 0, reValue = 0, stocksValue = 0;
  let maxPos = 0;
  let worldEtfDetected = false, emEtfDetected = false;
  let livretAValue = 0, lddsValue = 0;

  for (const h of holdings) {
    const v = Number(h.value) || 0;
    if (v <= 0) continue;
    if (v > maxPos) maxPos = v;
    sumByCategory[h.category] = (sumByCategory[h.category] || 0) + v;
    const tk = (h.ticker || '').toUpperCase();
    const name = (h.name || '').toLowerCase();
    const account = (h.account || '').toLowerCase();
    if (/IWDA|VWCE|CW8|EWLD/.test(tk)) worldEtfDetected = true;
    if (/EIMI|AEEM/.test(tk)) emEtfDetected = true;
    if (/\.PA$|FR$/.test(tk)) frValue += v;
    if (account.includes('pea')) peaValue += v;
    if (account.includes('livret a')) livretAValue += v;
    if (account.includes('lddss') || account.includes('ldds')) lddsValue += v;
    if (h.ter && (account.includes('av') || account.includes('assurance'))) avFees.push(Number(h.ter));
    if (h.category === 'crypto') cryptoValue += v;
    if (h.category === 'commodities' || /gold|sgld/i.test(tk + ' ' + name)) goldValue += v;
    if (h.category === 'bonds') bondsValue += v;
    if (h.category === 'cash') cashValue += v;
    if (h.category === 'real_estate') reValue += v;
    if (h.category === 'stocks' || h.category === 'etf') stocksValue += v;
  }

  ctx.livret_a_balance = livretAValue;
  ctx.has_lddss = lddsValue > 0;
  ctx.has_pea = peaValue > 0;
  ctx.has_world_etf = worldEtfDetected;
  ctx.has_em_etf = emEtfDetected;
  ctx.av_annual_fees = avFees.length ? Math.max(...avFees) : 0;
  ctx.fr_exposure_pct = (frValue / totalValue) * 100;
  ctx.crypto_pct = (cryptoValue / totalValue) * 100;
  ctx.gold_pct = (goldValue / totalValue) * 100;
  ctx.bonds_pct = (bondsValue / totalValue) * 100;
  ctx.cash_pct = (cashValue / totalValue) * 100;
  ctx.cash_balance = cashValue;
  ctx.real_estate_pct = (reValue / totalValue) * 100;
  ctx.real_estate_value = reValue;
  ctx.stocks_pct = (stocksValue / totalValue) * 100;
  ctx.max_position_pct = (maxPos / totalValue) * 100;

  return ctx;
}

// Mini DSL : "av_annual_fees > 0.65" → eval safely with whitelisted ctx fields
export function evaluateCondition(condStr, ctx) {
  if (!condStr) return true;
  try {
    // Replace ctx fields with their values; reject anything not whitelisted
    const allowed = Object.keys(ctx);
    const safe = condStr.replace(/[a-z_][a-z_0-9]*/gi, (token) => {
      if (allowed.includes(token)) {
        const v = ctx[token];
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        return String(Number(v) || 0);
      }
      if (['true', 'false', 'null'].includes(token.toLowerCase())) return token.toLowerCase();
      return '0';
    });
    // eslint-disable-next-line no-new-func
    return Boolean(new Function('return (' + safe + ')')());
  } catch {
    return false;
  }
}

// ============== UI ==============

export async function renderWealthMethodView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.wealth-method.label'), t('mod.wealth-method.desc'), { example: t('mod.wealth-method.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">⚙️ ${isEN ? 'Your context' : 'Ton contexte'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:12px;">
        <div class="field" style="margin:0;"><label class="field-label">${isEN ? 'Age' : 'Âge'}</label><input id="ctx-age" class="input" type="number" min="18" max="100" value="35" /></div>
        <div class="field" style="margin:0;"><label class="field-label">TMI %</label><input id="ctx-tmi" class="input" type="number" min="0" max="45" value="30" /></div>
        <div class="field" style="margin:0;"><label class="field-label">${isEN ? 'Has children' : 'Enfants'}</label><select id="ctx-children" class="input"><option value="false">${isEN ? 'No' : 'Non'}</option><option value="true">${isEN ? 'Yes' : 'Oui'}</option></select></div>
        <div class="field" style="margin:0;"><label class="field-label">${isEN ? 'PER opened' : 'PER ouvert'}</label><select id="ctx-per" class="input"><option value="false">${isEN ? 'No' : 'Non'}</option><option value="true">${isEN ? 'Yes' : 'Oui'}</option></select></div>
        <div class="field" style="margin:0;"><label class="field-label">${isEN ? 'PEE w/ match' : 'PEE/PERCO'}</label><select id="ctx-pee" class="input"><option value="false">${isEN ? 'No' : 'Non'}</option><option value="true">${isEN ? 'Yes' : 'Oui'}</option></select></div>
      </div>
      <button id="ctx-recompute" class="btn-secondary" style="margin-top:10px;">🔄 ${isEN ? 'Recompute checklist' : 'Recalculer la checklist'}</button>
    </div>
    <div id="method-checklist"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => refresh(viewEl, exampleHoldings()));

  $('#ctx-recompute').addEventListener('click', () => {
    listWealth().then(holdings => refresh(viewEl, holdings)).catch(() => refresh(viewEl, []));
  });

  const holdings = await listWealth().catch(() => []);
  refresh(viewEl, holdings);
}

async function refresh(viewEl, holdings) {
  const isEN = getLocale() === 'en';
  const rules = (await loadRules()).rules || [];
  const ctx = buildContext(holdings);
  ctx.age = parseInt($('#ctx-age').value, 10) || 35;
  ctx.tmi = parseInt($('#ctx-tmi').value, 10) || 30;
  ctx.has_children = $('#ctx-children').value === 'true';
  ctx.has_per = $('#ctx-per').value === 'true';
  ctx.has_pee_with_match = $('#ctx-pee').value === 'true';

  const state = getRulesState();
  const grouped = { high: [], medium: [], low: [], done: [], dismissed: [] };
  for (const rule of rules) {
    const userStatus = state[rule.id]?.status;
    if (userStatus === 'done') { grouped.done.push(rule); continue; }
    if (userStatus === 'dismissed') { grouped.dismissed.push(rule); continue; }
    const applies = evaluateCondition(rule.condition, ctx);
    if (!applies) continue;
    grouped[rule.priority || 'low'].push(rule);
  }

  const pickLocale = (r, field) => isEN && r[field + '_en'] ? r[field + '_en'] : r[field];
  const renderRule = (r) => `
    <div class="card" style="border-left:4px solid ${priorityColor(r.priority)};margin-bottom:10px;" data-rule="${r.id}">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;">${escape(pickLocale(r, 'title'))}</div>
          <div style="font-size:11px;color:var(--text-muted);margin:2px 0 8px;">${priorityLabel(r.priority, isEN)} · ${escape(r.category)}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;">${escape(pickLocale(r, 'action'))}</div>
          <details style="font-size:12px;color:var(--text-muted);">
            <summary style="cursor:pointer;">${isEN ? 'Why' : 'Pourquoi'}</summary>
            <div style="margin-top:6px;line-height:1.5;">${escape(pickLocale(r, 'explanation'))}</div>
          </details>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button class="btn-secondary rule-deep" data-rule="${r.id}" style="font-size:11px;">🤖 ${isEN ? 'Deep-dive AI' : 'Approfondir IA'}</button>
          <button class="btn-ghost rule-done" data-rule="${r.id}" style="font-size:11px;">✓ ${isEN ? 'Done' : 'Fait'}</button>
          <button class="btn-ghost rule-dismiss" data-rule="${r.id}" style="font-size:11px;color:var(--text-muted);">✕ ${isEN ? 'Skip' : 'Ignorer'}</button>
        </div>
      </div>
      <div class="rule-deep-out" data-rule-out="${r.id}"></div>
    </div>
  `;

  $('#method-checklist').innerHTML = `
    ${grouped.high.length ? `<h3 style="margin:14px 0 8px;color:var(--accent-red);">⏳ ${isEN ? 'Priority HIGH' : 'Priorité HAUTE'} (${grouped.high.length})</h3>${grouped.high.map(renderRule).join('')}` : ''}
    ${grouped.medium.length ? `<h3 style="margin:14px 0 8px;color:var(--accent-orange);">⏳ ${isEN ? 'Priority MEDIUM' : 'Priorité MOYENNE'} (${grouped.medium.length})</h3>${grouped.medium.map(renderRule).join('')}` : ''}
    ${grouped.low.length ? `<h3 style="margin:14px 0 8px;color:var(--text-secondary);">⏳ ${isEN ? 'Priority LOW' : 'Priorité BASSE'} (${grouped.low.length})</h3>${grouped.low.map(renderRule).join('')}` : ''}
    ${grouped.done.length ? `<h3 style="margin:14px 0 8px;color:var(--accent-green);">✅ ${isEN ? 'Done' : 'Fait'} (${grouped.done.length})</h3>${grouped.done.map(renderRule).join('')}` : ''}
    ${grouped.high.length + grouped.medium.length + grouped.low.length === 0 && grouped.done.length === 0 ? `<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">${isEN ? '🎉 No applicable rules detected. Your wealth method looks solid!' : '🎉 Aucune règle applicable détectée. Ta méthode patrimoniale a l\'air solide !'}</div>` : ''}
  `;

  // Wire actions
  document.querySelectorAll('.rule-done').forEach(b => b.addEventListener('click', () => {
    setRuleStatus(b.dataset.rule, 'done');
    refresh(viewEl, holdings);
    toast(isEN ? 'Marked as done' : 'Marqué comme fait', 'success');
  }));
  document.querySelectorAll('.rule-dismiss').forEach(b => b.addEventListener('click', () => {
    setRuleStatus(b.dataset.rule, 'dismissed');
    refresh(viewEl, holdings);
    toast(isEN ? 'Skipped' : 'Ignoré', 'info');
  }));
  document.querySelectorAll('.rule-deep').forEach(b => b.addEventListener('click', () => {
    const ruleId = b.dataset.rule;
    const rule = rules.find(r => r.id === ruleId);
    const out = document.querySelector(`[data-rule-out="${ruleId}"]`);
    if (!rule || !out) return;
    out.innerHTML = '';
    const userMsg = isEN
      ? `Deep-dive this French wealth-method rule for my situation:

RULE: ${rule.title_en || rule.title}
ACTION: ${rule.action_en || rule.action}
EXPLANATION: ${rule.explanation_en || rule.explanation}
PRIORITY: ${rule.priority}

MY CONTEXT:
- Total wealth: €${fmt(ctx.total_wealth)}
- Age: ${ctx.age}
- Marginal tax rate (TMI): ${ctx.tmi}%
- Has children: ${ctx.has_children ? 'yes' : 'no'}
- PEA opened: ${ctx.has_pea ? 'yes' : 'no'}
- PER opened: ${ctx.has_per ? 'yes' : 'no'}
- Livret A: €${fmt(ctx.livret_a_balance)}
- Cash: €${fmt(ctx.cash_balance)} (${ctx.cash_pct.toFixed(1)}%)
- Stocks/ETF: ${ctx.stocks_pct.toFixed(1)}%
- Bonds: ${ctx.bonds_pct.toFixed(1)}%
- Gold: ${ctx.gold_pct.toFixed(1)}%
- Crypto: ${ctx.crypto_pct.toFixed(1)}%
- Real estate: ${ctx.real_estate_pct.toFixed(1)}%
- FR exposure: ${ctx.fr_exposure_pct.toFixed(1)}%
- Max life-insurance fees: ${(ctx.av_annual_fees * 100).toFixed(2)}%

Provide: (1) why it matters for me, (2) numerical impact in MY situation, (3) 3-step action plan, (4) warnings.`
      : `Approfondis cette règle de méthode patrimoniale dans ma situation :

RÈGLE : ${rule.title}
ACTION : ${rule.action}
EXPLICATION : ${rule.explanation}
PRIORITÉ : ${rule.priority}

MON CONTEXTE :
- Patrimoine total : ${fmt(ctx.total_wealth)} €
- Âge : ${ctx.age}
- TMI : ${ctx.tmi}%
- Enfants : ${ctx.has_children ? 'oui' : 'non'}
- PEA ouvert : ${ctx.has_pea ? 'oui' : 'non'}
- PER ouvert : ${ctx.has_per ? 'oui' : 'non'}
- Livret A : ${fmt(ctx.livret_a_balance)} €
- Cash : ${fmt(ctx.cash_balance)} € (${ctx.cash_pct.toFixed(1)}%)
- Stocks/ETF : ${ctx.stocks_pct.toFixed(1)}%
- Bonds : ${ctx.bonds_pct.toFixed(1)}%
- Or : ${ctx.gold_pct.toFixed(1)}%
- Crypto : ${ctx.crypto_pct.toFixed(1)}%
- Immo : ${ctx.real_estate_pct.toFixed(1)}%
- Exposition FR : ${ctx.fr_exposure_pct.toFixed(1)}%
- Frais AV max : ${(ctx.av_annual_fees * 100).toFixed(2)}%

Donne : (1) pourquoi c'est important pour moi, (2) impact chiffré dans MA situation, (3) plan d'action 3 étapes, (4) warnings.`;

    runAnalysis(MODULE_ID, {
      system: getLocale() === 'en' ? SYSTEM_WEALTH_METHOD_EN : SYSTEM_WEALTH_METHOD,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 2500,
      recordInput: { ruleId, rule: rule.title, ctx }
    }, out);
  }));
}

function priorityColor(p) {
  return p === 'high' ? 'var(--accent-red)' : p === 'medium' ? 'var(--accent-orange)' : 'var(--text-muted)';
}
function priorityLabel(p, isEN) {
  if (p === 'high') return isEN ? 'High priority' : 'Priorité haute';
  if (p === 'medium') return isEN ? 'Medium priority' : 'Priorité moyenne';
  return isEN ? 'Low priority' : 'Priorité basse';
}

function exampleHoldings() {
  return [
    { id: 'ex1', name: 'AV Boursorama', value: 28000, account: 'AV Boursorama Vie', ter: 0.0085, category: 'retirement', currency: 'EUR' },
    { id: 'ex2', name: 'Livret A', value: 18000, account: 'Livret A', category: 'cash', currency: 'EUR' },
    { id: 'ex3', name: 'Lyxor CAC 40', ticker: 'CAC', value: 35000, account: 'PEA Boursorama', category: 'etf', currency: 'EUR' },
    { id: 'ex4', name: 'Cash courant', value: 12000, category: 'cash', currency: 'EUR' }
  ];
}

function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
