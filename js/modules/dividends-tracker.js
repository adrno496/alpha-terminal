// F2 — Dividendes : calendrier annuel + YoC + couverture vie passive + historique
import { $, uuid, toast } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { dividendCalendar } from '../ui/charts.js';
import { listBudgetEntries, getMonthlyTotals } from './budget.js';
import { openWithMinVersion } from '../core/db-open.js';

const MODULE_ID = 'dividends-tracker';
const DB_NAME = 'alpha-terminal';
const STORE = 'dividends_history';

// ============== STORAGE ==============

function openDB() {
  return openWithMinVersion(DB_NAME, 7, () => {});
}
function tx(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}
function p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

export async function listDividendsHistory() {
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

export async function saveDividendEntry(entry) {
  const store = await tx('readwrite');
  if (!entry.id) entry.id = uuid();
  if (!entry.createdAt) entry.createdAt = new Date().toISOString();
  await p(store.put(entry));
  return entry;
}

export async function deleteDividendEntry(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

// ============== COMPUTATIONS ==============

let _dividendsDb = null;
async function loadDividendsDb() {
  if (_dividendsDb) return _dividendsDb;
  try {
    const res = await fetch('data/dividends-fr.json');
    _dividendsDb = await res.json();
  } catch {
    _dividendsDb = { stocks: {} };
  }
  return _dividendsDb;
}

// Map ticker simple → ticker complet (MC → MC.PA)
function normalizeTicker(t) {
  if (!t) return null;
  const u = t.toUpperCase().trim();
  if (u.includes('.')) return u;
  return u + '.PA'; // fallback FR
}

export function projectAnnualDividends(holdings, dividendsDb) {
  const monthlyTotals = new Array(12).fill(0);
  const byTicker = [];
  for (const h of holdings) {
    if (!h.quantity || h.quantity <= 0) continue;
    const tk = normalizeTicker(h.ticker);
    const data = dividendsDb.stocks[tk];
    if (!data) continue;
    const annualPerShare = data.frequency === 'quarterly' ? data.lastDividend * 4 : data.lastDividend;
    const annualTotal = annualPerShare * h.quantity;
    if (annualTotal === 0) continue;
    // Distribution mensuelle selon frequency + paymentDate
    const payMonth = data.paymentDate ? parseInt(data.paymentDate.split('-')[1], 10) - 1 : 5;
    if (data.frequency === 'quarterly') {
      const perPayment = data.lastDividend * h.quantity;
      [0, 3, 6, 9].forEach(offset => { monthlyTotals[(payMonth + offset) % 12] += perPayment; });
    } else if (data.frequency === 'monthly') {
      const perPayment = data.lastDividend * h.quantity;
      for (let m = 0; m < 12; m++) monthlyTotals[m] += perPayment;
    } else {
      monthlyTotals[payMonth] += annualTotal;
    }
    byTicker.push({
      ticker: tk, name: data.name || h.name, qty: h.quantity,
      dividendPerShare: data.lastDividend, frequency: data.frequency,
      annualTotal, exDate: data.exDate, paymentDate: data.paymentDate,
      growth5y: data.growth5y, consecutiveYears: data.consecutiveYears,
      yieldPct: h.value ? (annualTotal / h.value) * 100 : null
    });
  }
  return { monthlyTotals, byTicker };
}

export function yieldOnCost(holdings, dividendsDb) {
  let totalAnnual = 0, totalCost = 0;
  for (const h of holdings) {
    if (!h.costBasis || !h.quantity) continue;
    const tk = normalizeTicker(h.ticker);
    const data = dividendsDb.stocks[tk];
    if (!data) continue;
    const annualPerShare = data.frequency === 'quarterly' ? data.lastDividend * 4 : data.lastDividend;
    totalAnnual += annualPerShare * h.quantity;
    totalCost += h.costBasis;
  }
  return totalCost > 0 ? (totalAnnual / totalCost) * 100 : 0;
}

export function calculateNetDividend(gross, isPEA = false) {
  if (isPEA) {
    return { gross, ps: 0, ir: 0, net: gross, note: 'PEA : exonération IR. PS 17.2% au retrait sur la part dividendes.' };
  }
  return { gross, ps: gross * 0.172, ir: gross * 0.128, net: gross * 0.70, note: 'CTO : PFU 30% (12.8% IR + 17.2% PS).' };
}

// ============== UI ==============

export async function renderDividendsTrackerView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.dividends-tracker.label'), t('mod.dividends-tracker.desc'), { example: t('mod.dividends-tracker.example'), moduleId: MODULE_ID })}
    <div id="div-stats" class="card">${isEN ? '⏳ Loading…' : '⏳ Chargement…'}</div>
    <div id="div-calendar-card" class="card" style="height:240px;"><canvas id="div-calendar"></canvas></div>
    <div id="div-monthly-list" class="card"></div>
    <div id="div-top-payers" class="card"></div>
    <div id="div-history" class="card"></div>
  `;

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => refresh(viewEl, exampleHoldings()));

  const holdings = await listWealth().catch(() => []);
  refresh(viewEl, holdings);
}

async function refresh(viewEl, holdings) {
  const isEN = getLocale() === 'en';
  const db = await loadDividendsDb();
  const { monthlyTotals, byTicker } = projectAnnualDividends(holdings, db);
  const annualTotal = monthlyTotals.reduce((s, v) => s + v, 0);
  const yoc = yieldOnCost(holdings, db);
  const totalValue = holdings.reduce((s, h) => s + (Number(h.value) || 0), 0);
  const portfolioYield = totalValue > 0 ? (annualTotal / totalValue) * 100 : 0;

  // Couverture vie passive — lecture du budget mensuel courant
  const ym = (new Date()).getFullYear() + '-' + String((new Date()).getMonth() + 1).padStart(2, '0');
  const budgetEntries = await listBudgetEntries({ month: ym }).catch(() => []);
  const budgetTotals = getMonthlyTotals(budgetEntries);
  const monthlySpend = budgetTotals.depenses;
  const annualSpend = monthlySpend * 12;
  const passiveCoverage = annualSpend > 0 ? Math.min(100, (annualTotal / annualSpend) * 100) : null;

  $('#div-stats').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'Annual stats' : 'Stats globales'}</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${isEN ? 'Annual total' : 'Total annuel'}</div><div class="stat-value green">${fmt(annualTotal)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Portfolio yield' : 'Yield portefeuille'}</div><div class="stat-value">${portfolioYield.toFixed(2)}%</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Yield on Cost' : 'Yield on Cost'}</div><div class="stat-value">${yoc.toFixed(2)}%</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Holdings tracked' : 'Lignes suivies'}</div><div class="stat-value">${byTicker.length}</div></div>
    </div>
    ${passiveCoverage !== null ? `
    <div style="margin-top:14px;padding:12px;background:var(--bg-tertiary);border-radius:6px;font-size:13px;">
      🎯 <strong>${isEN ? 'Passive life coverage' : 'Couverture vie passive'} :</strong>
      ${isEN ? 'Your monthly expenses' : 'Tes dépenses mensuelles'} : ${fmt(monthlySpend)} € (${fmt(annualSpend)} €/${isEN ? 'year' : 'an'})
      <br>
      ${isEN ? 'Your dividends cover' : 'Tes dividendes couvrent'} <strong>${passiveCoverage.toFixed(1)}%</strong> ${isEN ? 'of your expenses' : 'de tes dépenses'}.
    </div>` : `<p style="font-size:12px;color:var(--text-muted);margin:10px 0 0;">${isEN ? 'Set up your monthly Budget to see passive-life coverage.' : 'Configure ton Budget mensuel pour voir la couverture vie passive.'}</p>`}
  `;

  // Calendar chart
  const canvas = $('#div-calendar');
  if (canvas) {
    try {
      if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }
      canvas._chart = dividendCalendar(canvas, monthlyTotals);
    } catch (e) { console.warn(e); }
  }

  // Monthly list
  const months = isEN
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  $('#div-monthly-list').innerHTML = `
    <div class="card-title">📅 ${isEN ? 'Monthly calendar' : 'Calendrier mensuel'}</div>
    ${monthlyTotals.map((total, i) => {
      const tickersThisMonth = byTicker.filter(t => {
        const m = t.paymentDate ? parseInt(t.paymentDate.split('-')[1], 10) - 1 : 5;
        if (t.frequency === 'quarterly') return [m, (m + 3) % 12, (m + 6) % 12, (m + 9) % 12].includes(i);
        if (t.frequency === 'monthly') return true;
        return m === i;
      });
      return `
        <div style="padding:8px;border-bottom:1px solid var(--border);font-size:12.5px;">
          <strong>${months[i]} : ${fmt(total)} €</strong>
          ${tickersThisMonth.length ? `<ul style="margin:4px 0 0 18px;color:var(--text-muted);font-size:11.5px;">${tickersThisMonth.map(t => {
            const monthAmt = t.frequency === 'quarterly' ? t.dividendPerShare * t.qty : t.frequency === 'monthly' ? t.dividendPerShare * t.qty : t.annualTotal;
            return `<li>${t.name} : ${fmt(monthAmt)} €</li>`;
          }).join('')}</ul>` : ''}
        </div>
      `;
    }).join('')}
  `;

  // Top payers
  const top = byTicker.slice().sort((a, b) => b.annualTotal - a.annualTotal).slice(0, 10);
  $('#div-top-payers').innerHTML = `
    <div class="card-title">🏆 ${isEN ? 'Top dividend payers' : 'Top payeurs'}</div>
    ${top.length ? `
      <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px;">Ticker</th>
          <th style="text-align:left;padding:6px;">${isEN ? 'Name' : 'Nom'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Annual €' : 'Annuel €'}</th>
          <th style="text-align:right;padding:6px;">Yield</th>
          <th style="text-align:right;padding:6px;">${isEN ? '5y growth' : 'Croiss. 5 ans'}</th>
          <th style="text-align:right;padding:6px;">${isEN ? 'Years' : 'Années'}</th>
        </tr></thead>
        <tbody>
          ${top.map(t => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:6px;font-family:var(--font-mono);">${t.ticker}</td>
              <td style="padding:6px;">${escape(t.name)}${t.consecutiveYears >= 25 ? ' 🏆' : ''}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);color:var(--accent-green);">${fmt(t.annualTotal)}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${t.yieldPct ? t.yieldPct.toFixed(2) + '%' : '—'}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${t.growth5y ? '+' + t.growth5y.toFixed(1) + '%' : '—'}</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);">${t.consecutiveYears || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : `<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:14px;">${isEN ? 'No dividend-paying holdings found in your portfolio.' : 'Aucune action à dividende détectée dans ton portefeuille.'}</p>`}
  `;

  // History (manual taggings)
  const history = await listDividendsHistory().catch(() => []);
  $('#div-history').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div class="card-title">📝 ${isEN ? 'Received dividends history' : 'Historique des dividendes reçus'}</div>
      <button id="div-add-hist" class="btn-secondary" style="font-size:12px;">+ ${isEN ? 'Tag a received dividend' : 'Tagger un dividende reçu'}</button>
    </div>
    ${history.length ? history.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(h => {
      const calc = calculateNetDividend(h.gross, h.isPEA);
      return `<div style="padding:8px;border-bottom:1px solid var(--border);font-size:12.5px;display:flex;justify-content:space-between;align-items:center;">
        <span>${h.date} · <strong>${escape(h.ticker)}</strong> ${h.isPEA ? '🟢 PEA' : '🟡 CTO'} · ${isEN ? 'Gross' : 'Brut'} : ${fmt(h.gross)} € → ${isEN ? 'Net' : 'Net'} : ${fmt(calc.net)} €</span>
        <button class="btn-ghost div-del" data-id="${h.id}" aria-label="${isEN ? 'Delete' : 'Supprimer'}" style="padding:2px 6px;font-size:11px;color:var(--text-muted);">×</button>
      </div>`;
    }).join('') : `<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:14px;">${isEN ? 'No tagged dividends yet.' : 'Aucun dividende taggé.'}</p>`}
  `;

  $('#div-add-hist').addEventListener('click', () => openDivEntryModal(viewEl));
  document.querySelectorAll('#div-history .div-del').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm(isEN ? 'Delete this entry?' : 'Supprimer cette ligne ?')) return;
      await deleteDividendEntry(b.dataset.id);
      const holdings2 = await listWealth().catch(() => []);
      refresh(viewEl, holdings2);
    });
  });
}

function openDivEntryModal(viewEl) {
  const isEN = getLocale() === 'en';
  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:480px;width:100%;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>+ ${isEN ? 'Tag a received dividend' : 'Tagger un dividende reçu'}</strong>
        <button class="btn-ghost" data-close aria-label="${isEN ? 'Close' : 'Fermer'}">×</button>
      </div>
      <div class="field"><label class="field-label">${isEN ? 'Date' : 'Date'}</label><input id="dh-date" class="input" type="date" value="${(new Date()).toISOString().slice(0,10)}" /></div>
      <div class="field"><label class="field-label">Ticker</label><input id="dh-ticker" class="input" placeholder="MC.PA" /></div>
      <div class="field"><label class="field-label">${isEN ? 'Gross amount (€)' : 'Montant brut (€)'}</label><input id="dh-gross" class="input" type="number" step="0.01" min="0" /></div>
      <div class="field">
        <label class="field-label">${isEN ? 'Account' : 'Compte'}</label>
        <select id="dh-account" class="input">
          <option value="cto">${isEN ? 'CTO (PFU 30%)' : 'CTO (PFU 30%)'}</option>
          <option value="pea">PEA (${isEN ? 'IR exempt + PS 17.2% on withdrawal' : 'exonération IR + PS 17.2% au retrait'})</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn-ghost" data-close>${isEN ? 'Cancel' : 'Annuler'}</button>
        <button id="dh-save" class="btn-primary">${isEN ? 'Save' : 'Enregistrer'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(w);
  const close = () => { try { document.body.removeChild(w); } catch {} };
  w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  w.addEventListener('click', (e) => { if (e.target === w) close(); });

  w.querySelector('#dh-save').addEventListener('click', async () => {
    const date = w.querySelector('#dh-date').value;
    const ticker = w.querySelector('#dh-ticker').value.trim().toUpperCase();
    const gross = parseFloat(w.querySelector('#dh-gross').value);
    const isPEA = w.querySelector('#dh-account').value === 'pea';
    if (!date || !ticker || !gross || gross <= 0) { toast(isEN ? 'Fill all fields' : 'Remplis tous les champs', 'error'); return; }
    await saveDividendEntry({ date, ticker, gross, isPEA, currency: 'EUR' });
    close();
    const holdings2 = await listWealth().catch(() => []);
    refresh(viewEl, holdings2);
    toast(isEN ? 'Saved' : 'Enregistré', 'success');
  });
}

function exampleHoldings() {
  return [
    { id: 'ex1', name: 'LVMH',     ticker: 'MC.PA',    quantity: 50,  value: 35000, costBasis: 28000, category: 'stocks' },
    { id: 'ex2', name: 'Sanofi',   ticker: 'SAN.PA',   quantity: 100, value: 9500,  costBasis: 7800,  category: 'stocks' },
    { id: 'ex3', name: 'Air Liquide', ticker: 'AI.PA', quantity: 80,  value: 14400, costBasis: 12000, category: 'stocks' },
    { id: 'ex4', name: 'TotalEnergies', ticker: 'TTE.PA', quantity: 200, value: 12500, costBasis: 9800, category: 'stocks' }
  ];
}

function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
