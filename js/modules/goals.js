// Module Objectifs financiers : CRUD + tracking progression vs patrimoine actuel.
import { $, uuid, toast } from '../core/utils.js';
import { listWealth, getTotals } from '../core/wealth.js';
import { listBudgetEntries, getMonthlyTotals, projectWealth } from './budget.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';

const MODULE_ID = 'goals';
const DB_NAME = 'alpha-terminal';
const STORE = 'goals';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 9);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}
function p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

export async function listGoals() {
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

export async function saveGoal(goal) {
  const store = await tx('readwrite');
  if (!goal.id) goal.id = uuid();
  if (!goal.createdAt) goal.createdAt = new Date().toISOString();
  goal.updatedAt = new Date().toISOString();
  if (!goal.status) goal.status = 'active';
  await p(store.put(goal));
  return goal;
}

export async function deleteGoal(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

const GOAL_TYPES = {
  fire:      { label_fr: '🔥 FIRE / Indépendance financière', label_en: '🔥 FIRE / Financial independence' },
  retirement:{ label_fr: '🏖️ Retraite confortable',           label_en: '🏖️ Comfortable retirement' },
  house:     { label_fr: '🏠 Achat immobilier',              label_en: '🏠 Real-estate purchase' },
  emergency: { label_fr: '💰 Épargne de précaution',          label_en: '💰 Emergency fund' },
  travel:    { label_fr: '✈️ Voyage / projet personnel',      label_en: '✈️ Travel / personal project' },
  education: { label_fr: '🎓 Études enfants',                 label_en: '🎓 Children education' },
  business:  { label_fr: '🚀 Création entreprise',            label_en: '🚀 Start a business' },
  other:     { label_fr: '🎯 Autre objectif',                label_en: '🎯 Other goal' }
};

// Calcule le progress + l'écart pour atteindre la cible à la date prévue.
//   monthlyContribution : épargne mensuelle estimée (depuis budget si dispo)
//   currentValue : patrimoine actuel
//   target : montant cible
//   targetDate : YYYY-MM-DD
function computeGoalMetrics(goal, currentValue, monthlyContribution = 0) {
  const target = Number(goal.targetAmount) || 0;
  if (target === 0) return { progressPct: 0, gap: 0, monthsRemaining: 0, requiredMonthly: 0, onTrack: false, projected: 0 };

  const now = Date.now();
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  const monthsRemaining = targetDate ? Math.max(0, Math.round((targetDate.getTime() - now) / (30.44 * 24 * 3600 * 1000))) : null;

  const startValue = Number(goal.startValue) || 0;
  const progress = currentValue - startValue;
  const totalNeeded = target - startValue;
  const progressPct = totalNeeded > 0 ? Math.min(100, (progress / totalNeeded) * 100) : (progress >= 0 ? 100 : 0);
  const gap = Math.max(0, target - currentValue);

  // Required monthly to hit target on time (assumant rendement annuel 7% par défaut)
  const annualReturn = Number(goal.expectedReturn) || 0.07;
  let requiredMonthly = 0;
  if (monthsRemaining > 0 && gap > 0) {
    const r = annualReturn / 12;
    if (r === 0) requiredMonthly = gap / monthsRemaining;
    else {
      // FV = M × ((1+r)^n - 1)/r → M = FV × r / ((1+r)^n - 1)
      requiredMonthly = gap * r / (Math.pow(1 + r, monthsRemaining) - 1);
    }
  }

  // Projected à la date cible avec l'épargne actuelle
  let projected = currentValue;
  if (monthsRemaining > 0) {
    const r = annualReturn / 12;
    const futureValueOfCurrent = currentValue * Math.pow(1 + r, monthsRemaining);
    const futureValueOfContribs = monthlyContribution > 0
      ? monthlyContribution * (r === 0 ? monthsRemaining : (Math.pow(1 + r, monthsRemaining) - 1) / r)
      : 0;
    projected = futureValueOfCurrent + futureValueOfContribs;
  }

  const onTrack = projected >= target;

  return { progressPct, gap, monthsRemaining, requiredMonthly, onTrack, projected, annualReturn };
}

export async function renderGoalsView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '🎯 Financial Goals' : '🎯 Objectifs financiers',
      isEN ? 'Define and track your financial goals (FIRE, retirement, real-estate, etc.) against your wealth and savings rate.' : 'Définis et suis tes objectifs financiers (FIRE, retraite, achat immo…) en fonction de ton patrimoine et taux d\'épargne.',
      { moduleId: MODULE_ID })}

    <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <span id="goals-summary" style="font-size:13px;color:var(--text-secondary);">⏳ ${isEN ? 'Loading…' : 'Chargement…'}</span>
      <button id="goals-add" class="btn-primary">+ ${isEN ? 'New goal' : 'Nouvel objectif'}</button>
    </div>
    <div id="goals-list"></div>
  `;

  $('#goals-add').addEventListener('click', () => openGoalEditor(viewEl));
  await refresh(viewEl);
}

async function refresh(viewEl) {
  const isEN = getLocale() === 'en';
  const goals = await listGoals();
  const totals = await getTotals('EUR').catch(() => ({ total: 0 }));
  const currentValue = totals.total || 0;

  // Get current monthly savings rate from budget (current month)
  const ym = (new Date()).getFullYear() + '-' + String((new Date()).getMonth() + 1).padStart(2, '0');
  const budgetEntries = await listBudgetEntries({ month: ym }).catch(() => []);
  const budget = getMonthlyTotals(budgetEntries);
  const monthlyContrib = budget.epargne || 0;

  $('#goals-summary').textContent = `${goals.length} ${isEN ? (goals.length > 1 ? 'goals' : 'goal') : 'objectif' + (goals.length > 1 ? 's' : '')} · ${isEN ? 'current wealth' : 'patrimoine actuel'} : ${Math.round(currentValue).toLocaleString('fr-FR')} € · ${isEN ? 'monthly savings' : 'épargne mensuelle'} : ${Math.round(monthlyContrib).toLocaleString('fr-FR')} €`;

  if (goals.length === 0) {
    $('#goals-list').innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">${isEN ? '🎯 No goals yet. Click "+ New goal" to set your first one.' : '🎯 Aucun objectif. Clique "+ Nouvel objectif" pour commencer.'}</div>`;
    return;
  }

  const sorted = goals.slice().sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));
  $('#goals-list').innerHTML = sorted.map(g => {
    const m = computeGoalMetrics(g, currentValue, monthlyContrib);
    const typeLabel = (GOAL_TYPES[g.type] && (isEN ? GOAL_TYPES[g.type].label_en : GOAL_TYPES[g.type].label_fr)) || g.type;
    const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
    const pctColor = m.progressPct < 25 ? 'var(--accent-red)' : m.progressPct < 75 ? 'var(--accent-orange)' : 'var(--accent-green)';
    const trackBadge = m.onTrack
      ? `<span style="background:var(--accent-green);color:#000;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">${isEN ? 'ON TRACK' : 'EN BONNE VOIE'}</span>`
      : `<span style="background:var(--accent-red);color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">${isEN ? 'AT RISK' : 'À RISQUE'}</span>`;

    return `
      <div class="card" style="border-left:4px solid ${pctColor};margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:14px;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <strong style="font-size:14px;">${escape(g.name)}</strong>
              ${trackBadge}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin:2px 0 8px;">${typeLabel}${g.targetDate ? ` · ${isEN ? 'target' : 'cible'} : ${g.targetDate}` : ''}${m.monthsRemaining ? ` · ${m.monthsRemaining} ${isEN ? 'months left' : 'mois restants'}` : ''}</div>

            <!-- Progress bar -->
            <div style="background:var(--bg-tertiary);height:10px;border-radius:5px;overflow:hidden;margin-bottom:6px;">
              <div style="background:${pctColor};height:100%;width:${Math.min(100, m.progressPct)}%;transition:width 0.4s;"></div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);">
              ${fmt(currentValue)} € / ${fmt(g.targetAmount)} € · <strong>${m.progressPct.toFixed(1)}%</strong>
              ${m.gap > 0 ? ` · ${isEN ? 'gap' : 'écart'} : ${fmt(m.gap)} €` : ` · ✅ ${isEN ? 'reached!' : 'atteint !'}`}
            </div>
            ${m.gap > 0 && m.monthsRemaining ? `
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">
                💡 ${isEN ? 'Required monthly investment' : 'Investissement mensuel requis'} : <strong>${fmt(m.requiredMonthly)} €/mois</strong>
                · ${isEN ? 'projected at target date' : 'projeté à la date cible'} : ${fmt(m.projected)} €
                ${monthlyContrib > 0 ? ` · ${isEN ? 'current pace' : 'rythme actuel'} : ${fmt(monthlyContrib)} €/mois` : ''}
              </div>` : ''}
            ${g.notes ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:4px;">${escape(g.notes)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button class="btn-secondary goals-edit" data-id="${g.id}" style="font-size:11px;">✎ ${isEN ? 'Edit' : 'Modifier'}</button>
            <button class="btn-ghost goals-del" data-id="${g.id}" style="font-size:11px;color:var(--accent-red);">🗑 ${isEN ? 'Delete' : 'Supprimer'}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.goals-edit').forEach(b => b.addEventListener('click', async () => {
    const all = await listGoals();
    const g = all.find(x => x.id === b.dataset.id);
    if (g) openGoalEditor(viewEl, g);
  }));
  document.querySelectorAll('.goals-del').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(isEN ? 'Delete this goal?' : 'Supprimer cet objectif ?')) return;
    await deleteGoal(b.dataset.id);
    refresh(viewEl);
  }));
}

function openGoalEditor(viewEl, existing = null) {
  const isEN = getLocale() === 'en';
  const g = existing || { id: uuid(), type: 'fire', name: '', targetAmount: 0, targetDate: '', startValue: 0, expectedReturn: 0.07, notes: '', status: 'active' };

  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:540px;width:100%;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${existing ? (isEN ? 'Edit goal' : 'Modifier objectif') : (isEN ? 'New goal' : 'Nouvel objectif')}</strong>
        <button class="btn-ghost" data-close aria-label="${isEN ? 'Close' : 'Fermer'}">×</button>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Type' : 'Type'}</label>
        <select id="ge-type" class="input">
          ${Object.entries(GOAL_TYPES).map(([k, v]) => `<option value="${k}" ${k === g.type ? 'selected' : ''}>${isEN ? v.label_en : v.label_fr}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Name' : 'Nom'} *</label><input id="ge-name" class="input" value="${escape(g.name)}" placeholder="${isEN ? 'e.g. Retire at 50' : 'ex: Retraite à 50 ans'}" /></div>
      <div class="field-row">
        <div class="field"><label class="field-label">${isEN ? 'Target amount (€)' : 'Montant cible (€)'} *</label><input id="ge-target" class="input" type="number" step="1000" min="0" value="${g.targetAmount || ''}" /></div>
        <div class="field"><label class="field-label">${isEN ? 'Target date' : 'Date cible'}</label><input id="ge-date" class="input" type="date" value="${g.targetDate || ''}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="field-label">${isEN ? 'Starting value (€)' : 'Valeur de départ (€)'}</label><input id="ge-start" class="input" type="number" step="1000" min="0" value="${g.startValue || ''}" placeholder="${isEN ? 'For progress %' : 'Pour le % de progression'}" /></div>
        <div class="field"><label class="field-label">${isEN ? 'Expected return (%/year)' : 'Rendement attendu (%/an)'}</label><input id="ge-return" class="input" type="number" step="0.5" value="${(g.expectedReturn || 0.07) * 100}" /></div>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Notes' : 'Notes'}</label><textarea id="ge-notes" class="textarea" rows="2">${escape(g.notes)}</textarea></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn-ghost" data-close>${isEN ? 'Cancel' : 'Annuler'}</button>
        <button id="ge-save" class="btn-primary">${isEN ? 'Save' : 'Enregistrer'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(w);
  const close = () => { try { document.body.removeChild(w); } catch {} };
  w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  w.addEventListener('click', (e) => { if (e.target === w) close(); });

  w.querySelector('#ge-save').addEventListener('click', async () => {
    const name = w.querySelector('#ge-name').value.trim();
    const target = parseFloat(w.querySelector('#ge-target').value);
    if (!name || !target || target <= 0) { toast(isEN ? 'Fill name + target amount' : 'Remplis nom + montant cible', 'error'); return; }
    await saveGoal({
      ...g,
      type: w.querySelector('#ge-type').value,
      name,
      targetAmount: target,
      targetDate: w.querySelector('#ge-date').value || null,
      startValue: parseFloat(w.querySelector('#ge-start').value) || 0,
      expectedReturn: (parseFloat(w.querySelector('#ge-return').value) || 7) / 100,
      notes: w.querySelector('#ge-notes').value.trim()
    });
    close();
    refresh(viewEl);
    toast(isEN ? 'Saved' : 'Enregistré', 'success');
  });
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
