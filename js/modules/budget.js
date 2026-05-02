// F4 — Budget mensuel : CRUD entries + stats + projection long terme
import { $, uuid, toast } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { budgetWaterfall } from '../ui/charts.js';

const MODULE_ID = 'budget';
const DB_NAME = 'alpha-terminal';
const STORE = 'budget_entries';
const ACTIVE_MONTH_KEY = 'alpha-terminal:budget:active-month';

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

function p(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

export async function listBudgetEntries({ month = null } = {}) {
  const store = await tx();
  return new Promise((resolve) => {
    const out = [];
    const cursor = month
      ? store.index('month').openCursor(IDBKeyRange.only(month))
      : store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    cursor.onerror = () => resolve(out);
  });
}

export async function saveBudgetEntry(entry) {
  const store = await tx('readwrite');
  const now = new Date().toISOString();
  if (!entry.id) entry.id = uuid();
  if (!entry.createdAt) entry.createdAt = now;
  entry.updatedAt = now;
  await p(store.put(entry));
  return entry;
}

export async function deleteBudgetEntry(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

export async function listMonths() {
  const all = await listBudgetEntries();
  return Array.from(new Set(all.map(e => e.month))).sort().reverse();
}

// ============== COMPUTATIONS ==============

export function getMonthlyTotals(entries) {
  const totals = { revenu: 0, fixe: 0, variable: 0, epargne: 0 };
  for (const e of entries) {
    const amt = Math.abs(Number(e.amount) || 0);
    if (totals[e.type] !== undefined) totals[e.type] += amt;
  }
  totals.depenses = totals.fixe + totals.variable;
  totals.solde = totals.revenu - totals.depenses - totals.epargne;
  totals.tauxEpargne = totals.revenu > 0 ? (totals.epargne / totals.revenu) : 0;
  return totals;
}

export function projectWealth(monthlyInvest, years, annualReturn = 0.07) {
  // Annuités composées : FV = M × ((1+r)^n - 1)/r * (1+r)^(t/12) approximation mensuelle
  const r = annualReturn / 12;
  const n = years * 12;
  if (r === 0) return monthlyInvest * n;
  const fv = monthlyInvest * ((Math.pow(1 + r, n) - 1) / r);
  return fv;
}

// ============== UI ==============

function getDefaultCategories() {
  const isEN = getLocale() === 'en';
  return {
    revenu: [
      { id: 'salaire',     label: isEN ? 'Net salary' : 'Salaire net', icon: '💼' },
      { id: 'freelance',   label: isEN ? 'Freelance / contract' : 'Freelance / mission', icon: '💻' },
      { id: 'dividendes',  label: isEN ? 'Dividends' : 'Dividendes', icon: '💸' },
      { id: 'loyers',      label: isEN ? 'Rental income' : 'Loyers reçus', icon: '🏘️' },
      { id: 'autre_rev',   label: isEN ? 'Other' : 'Autre', icon: '·' }
    ],
    fixe: [
      { id: 'loyer',       label: isEN ? 'Rent / Mortgage' : 'Loyer / Crédit immo', icon: '🏠' },
      { id: 'charges',     label: isEN ? 'Utilities (water, gas, electricity)' : 'Charges (eau, élec, gaz)', icon: '⚡' },
      { id: 'internet',    label: isEN ? 'Internet / Phone' : 'Internet / Téléphone', icon: '🌐' },
      { id: 'assurance',   label: isEN ? 'Insurance' : 'Assurances', icon: '🛡️' },
      { id: 'abonnement',  label: isEN ? 'Subscriptions' : 'Abonnements', icon: '📺' },
      { id: 'credit_conso',label: isEN ? 'Consumer/auto loan' : 'Crédit conso/auto', icon: '💳' },
      { id: 'impots_fix',  label: isEN ? 'Monthly taxes' : 'Impôts mensualisés', icon: '🇫🇷' }
    ],
    variable: [
      { id: 'courses',     label: isEN ? 'Groceries' : 'Courses', icon: '🛒' },
      { id: 'restaurant',  label: isEN ? 'Restaurants/Outings' : 'Restaurants/Sorties', icon: '🍽️' },
      { id: 'transport',   label: isEN ? 'Transport' : 'Transport', icon: '🚗' },
      { id: 'loisirs',     label: isEN ? 'Leisure/Travel' : 'Loisirs/Voyages', icon: '🎮' },
      { id: 'vetements',   label: isEN ? 'Clothing' : 'Vêtements', icon: '👕' },
      { id: 'sante',       label: isEN ? 'Health' : 'Santé', icon: '💊' },
      { id: 'cadeaux',     label: isEN ? 'Gifts' : 'Cadeaux', icon: '🎁' },
      { id: 'imprevus',    label: isEN ? 'Unexpected' : 'Imprévus', icon: '·' }
    ],
    epargne: [
      { id: 'livret_a',    label: isEN ? 'Savings account (Livret A/LDDS)' : 'Livret A / LDDS', icon: '💰' },
      { id: 'av_versement',label: isEN ? 'Life-insurance contribution' : 'Versement AV', icon: '🛡️' },
      { id: 'pea_versement',label: isEN ? 'PEA contribution' : 'Versement PEA', icon: '📈' },
      { id: 'pee_perco',   label: isEN ? 'PEE / PERCO' : 'PEE / PERCO', icon: '🏢' },
      { id: 'crypto_dca',  label: isEN ? 'Crypto DCA' : 'DCA crypto', icon: '₿' },
      { id: 'etf_dca',     label: isEN ? 'ETF DCA' : 'DCA ETF', icon: '📊' }
    ]
  };
}

function currentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function fmtMonth(ym, isEN = false) {
  const [y, m] = ym.split('-');
  const months = isEN
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return months[parseInt(m, 10) - 1] + ' ' + y;
}

export function renderBudgetView(viewEl) {
  const isEN = getLocale() === 'en';
  const stored = localStorage.getItem(ACTIVE_MONTH_KEY);
  const activeMonth = stored && /^\d{4}-\d{2}$/.test(stored) ? stored : currentMonth();
  localStorage.setItem(ACTIVE_MONTH_KEY, activeMonth);

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.budget.label'), t('mod.budget.desc'), { example: t('mod.budget.example'), moduleId: MODULE_ID })}

    <div class="card">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between;">
        <div style="display:flex;gap:8px;align-items:center;">
          <label class="field-label" style="margin:0;">${isEN ? 'Month' : 'Mois'} :</label>
          <input type="month" id="budget-month" class="input" style="max-width:170px;" value="${activeMonth}" />
        </div>
        <div style="display:flex;gap:8px;">
          <button id="budget-add-revenu"   class="btn-secondary" style="font-size:12px;">+ ${isEN ? 'Income' : 'Revenu'}</button>
          <button id="budget-add-fixe"     class="btn-secondary" style="font-size:12px;">+ ${isEN ? 'Fixed' : 'Fixe'}</button>
          <button id="budget-add-variable" class="btn-secondary" style="font-size:12px;">+ ${isEN ? 'Variable' : 'Variable'}</button>
          <button id="budget-add-epargne"  class="btn-secondary" style="font-size:12px;">+ ${isEN ? 'Savings' : 'Épargne'}</button>
        </div>
      </div>
    </div>

    <div id="budget-stats" class="card"></div>
    <div id="budget-chart-card" class="card" style="height:240px;"><canvas id="budget-chart"></canvas></div>
    <div id="budget-list" class="card"></div>
    <div id="budget-projection" class="card"></div>
  `;

  // Wire inputs
  $('#budget-month').addEventListener('change', (e) => {
    localStorage.setItem(ACTIVE_MONTH_KEY, e.target.value);
    refresh(viewEl);
  });
  ['revenu', 'fixe', 'variable', 'epargne'].forEach(type => {
    $('#budget-add-' + type).addEventListener('click', () => openEntryModal(viewEl, type));
  });
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => loadExample(viewEl));

  refresh(viewEl);
}

async function refresh(viewEl) {
  const isEN = getLocale() === 'en';
  const month = $('#budget-month').value || currentMonth();
  const entries = await listBudgetEntries({ month });
  const totals = getMonthlyTotals(entries);

  const tauxClass = totals.tauxEpargne >= 0.25 ? 'green' : totals.tauxEpargne >= 0.10 ? 'orange' : 'red';
  const tauxBadge = totals.tauxEpargne >= 0.25 ? '✅' : totals.tauxEpargne >= 0.10 ? '👍' : '⚠️';

  $('#budget-stats').innerHTML = `
    <div class="card-title">${fmtMonth(month, isEN)}</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${isEN ? 'Income' : 'Revenus'}</div><div class="stat-value green">${fmt(totals.revenu)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Fixed expenses' : 'Dépenses fixes'}</div><div class="stat-value">${fmt(totals.fixe)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Variable expenses' : 'Dépenses variables'}</div><div class="stat-value">${fmt(totals.variable)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Savings/Invest' : 'Épargne/Invest'}</div><div class="stat-value ${tauxClass}">${fmt(totals.epargne)} €</div></div>
    </div>
    <div style="margin-top:12px;font-size:14px;">
      ${tauxBadge} <strong>${isEN ? 'Savings rate' : 'Taux d\'épargne'} :</strong> <span class="${tauxClass}">${(totals.tauxEpargne * 100).toFixed(1)}%</span>
      ${totals.solde !== 0 ? ` · ${isEN ? 'Balance' : 'Solde'} : <span class="${totals.solde >= 0 ? 'green' : 'red'}">${fmt(totals.solde)} €</span>` : ''}
    </div>
  `;

  // Chart
  const canvas = $('#budget-chart');
  if (canvas) {
    try {
      if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }
      canvas._chart = budgetWaterfall(canvas, { revenus: totals.revenu, fixes: totals.fixe, variables: totals.variable, epargne: totals.epargne });
    } catch (e) { console.warn(e); }
  }

  // List
  $('#budget-list').innerHTML = renderEntriesList(entries, isEN);
  $$('#budget-list .budget-del').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm(isEN ? 'Delete this entry?' : 'Supprimer cette ligne ?')) return;
      await deleteBudgetEntry(b.dataset.id);
      refresh(viewEl);
    });
  });

  // Projection
  if (totals.epargne > 0) {
    const p10 = projectWealth(totals.epargne, 10);
    const p20 = projectWealth(totals.epargne, 20);
    const p30 = projectWealth(totals.epargne, 30);
    $('#budget-projection').innerHTML = `
      <div class="card-title">📈 ${isEN ? 'Long-term wealth projection' : 'Projection patrimoine long terme'}</div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">
        ${isEN ? `If you invest <strong>${fmt(totals.epargne)} €/month</strong> at 7% annual return:` : `Si tu investis <strong>${fmt(totals.epargne)} €/mois</strong> à 7% de rendement annuel :`}
      </p>
      <div class="stat-grid">
        <div class="stat"><div class="stat-label">${isEN ? 'In 10 years' : 'Dans 10 ans'}</div><div class="stat-value">${fmt(p10)} €</div></div>
        <div class="stat"><div class="stat-label">${isEN ? 'In 20 years' : 'Dans 20 ans'}</div><div class="stat-value">${fmt(p20)} €</div></div>
        <div class="stat"><div class="stat-label">${isEN ? 'In 30 years' : 'Dans 30 ans'}</div><div class="stat-value green">${fmt(p30)} €</div></div>
      </div>
    `;
  } else {
    $('#budget-projection').innerHTML = '';
  }
}

function renderEntriesList(entries, isEN) {
  if (!entries.length) {
    return `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">${isEN ? 'No entries for this month yet. Add your first one above.' : 'Aucune ligne ce mois. Ajoute ta première ci-dessus.'}</p>`;
  }
  const groups = { revenu: [], fixe: [], variable: [], epargne: [] };
  for (const e of entries) (groups[e.type] || groups.variable).push(e);
  const labels = { revenu: isEN ? 'Income' : 'Revenus', fixe: isEN ? 'Fixed' : 'Dépenses fixes', variable: isEN ? 'Variable' : 'Dépenses variables', epargne: isEN ? 'Savings' : 'Épargne' };
  const colors = { revenu: 'var(--accent-green)', fixe: 'var(--accent-red)', variable: 'var(--accent-orange)', epargne: 'var(--accent-blue)' };

  return Object.entries(groups).filter(([_, list]) => list.length).map(([type, list]) => `
    <div style="margin-bottom:14px;">
      <div style="font-weight:600;margin-bottom:6px;color:${colors[type]};">${labels[type]}</div>
      ${list.map(e => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg-tertiary);border-radius:4px;margin-bottom:4px;font-size:12.5px;">
          <span>${e.icon || '·'} <strong>${escape(e.category)}</strong>${e.description ? ' · <span style="color:var(--text-muted);">' + escape(e.description) + '</span>' : ''}</span>
          <span style="display:flex;gap:10px;align-items:center;">
            <span style="font-family:var(--font-mono);">${fmt(e.amount)} €</span>
            <button class="btn-ghost budget-del" data-id="${e.id}" aria-label="Supprimer" style="padding:2px 6px;font-size:11px;color:var(--text-muted);">×</button>
          </span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function openEntryModal(viewEl, type) {
  const isEN = getLocale() === 'en';
  const month = $('#budget-month').value || currentMonth();
  const cats = getDefaultCategories()[type] || [];

  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:480px;width:100%;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>+ ${isEN ? 'Add' : 'Ajouter'} ${type}</strong>
        <button class="btn-ghost" data-close aria-label="${isEN ? 'Close' : 'Fermer'}">×</button>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Category' : 'Catégorie'}</label>
        <select id="entry-cat" class="input">${cats.map(c => `<option value="${c.id}" data-icon="${c.icon}" data-label="${c.label}">${c.icon} ${c.label}</option>`).join('')}<option value="custom">✏️ ${isEN ? 'Custom…' : 'Personnalisée…'}</option></select>
      </div>
      <div class="field" id="entry-custom-row" style="display:none;"><label class="field-label">${isEN ? 'Custom name' : 'Nom personnalisé'}</label><input id="entry-custom" class="input" /></div>
      <div class="field"><label class="field-label">${isEN ? 'Amount (€)' : 'Montant (€)'}</label><input id="entry-amt" class="input" type="number" step="0.01" min="0" /></div>
      <div class="field"><label class="field-label">${isEN ? 'Note (optional)' : 'Note (optionnel)'}</label><input id="entry-desc" class="input" /></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn-ghost" data-close>${isEN ? 'Cancel' : 'Annuler'}</button>
        <button id="entry-save" class="btn-primary">${isEN ? 'Save' : 'Enregistrer'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(w);
  const close = () => { try { document.body.removeChild(w); } catch {} };
  w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  w.addEventListener('click', (e) => { if (e.target === w) close(); });

  const catSel = w.querySelector('#entry-cat');
  catSel.addEventListener('change', () => {
    w.querySelector('#entry-custom-row').style.display = catSel.value === 'custom' ? '' : 'none';
  });

  w.querySelector('#entry-save').addEventListener('click', async () => {
    const amt = parseFloat(w.querySelector('#entry-amt').value);
    if (!amt || amt <= 0) { toast(isEN ? 'Enter a positive amount' : 'Entre un montant positif', 'error'); return; }
    const desc = w.querySelector('#entry-desc').value.trim();
    let category, icon;
    if (catSel.value === 'custom') {
      category = w.querySelector('#entry-custom').value.trim();
      if (!category) { toast(isEN ? 'Custom name required' : 'Nom personnalisé requis', 'error'); return; }
      icon = '·';
    } else {
      const opt = catSel.selectedOptions[0];
      category = opt.dataset.label;
      icon = opt.dataset.icon;
    }
    await saveBudgetEntry({ month, type, category, icon, amount: amt, description: desc });
    close();
    refresh(viewEl);
    toast(isEN ? 'Saved' : 'Enregistré', 'success');
  });
}

async function loadExample(viewEl) {
  const month = currentMonth();
  const examples = [
    { type: 'revenu', category: 'Salaire net', icon: '💼', amount: 4200, description: '' },
    { type: 'fixe', category: 'Loyer / Crédit immo', icon: '🏠', amount: 1100, description: '' },
    { type: 'fixe', category: 'Charges (eau, élec, gaz)', icon: '⚡', amount: 180, description: '' },
    { type: 'fixe', category: 'Internet / Téléphone', icon: '🌐', amount: 50, description: 'Free + Sosh' },
    { type: 'fixe', category: 'Assurances', icon: '🛡️', amount: 95, description: '' },
    { type: 'fixe', category: 'Abonnements', icon: '📺', amount: 35, description: 'Netflix + Spotify' },
    { type: 'variable', category: 'Courses', icon: '🛒', amount: 480, description: '' },
    { type: 'variable', category: 'Restaurants/Sorties', icon: '🍽️', amount: 220, description: '' },
    { type: 'variable', category: 'Transport', icon: '🚗', amount: 130, description: 'Essence + Navigo' },
    { type: 'variable', category: 'Loisirs/Voyages', icon: '🎮', amount: 100, description: '' },
    { type: 'epargne', category: 'DCA ETF', icon: '📊', amount: 800, description: 'IWDA mensuel' },
    { type: 'epargne', category: 'Versement AV', icon: '🛡️', amount: 400, description: 'Linxea Spirit 2' },
    { type: 'epargne', category: 'Livret A / LDDS', icon: '💰', amount: 200, description: '' }
  ];
  for (const e of examples) await saveBudgetEntry({ month, ...e });
  refresh(viewEl);
  toast(getLocale() === 'en' ? 'Example loaded' : 'Exemple chargé', 'success');
}

function fmt(n) {
  return Math.round(n).toLocaleString('fr-FR');
}
function escape(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
