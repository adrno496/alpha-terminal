// Capital Gains Tracker — FIFO / LIFO / CMP (Coût Moyen Pondéré)
// Suit le coût d'achat lot par lot, calcule la plus-value latente selon la méthode choisie.
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'capital-gains-tracker';
const STORAGE_KEY = 'alpha-terminal:cg:lots';

// Lot : { id, ticker, name, quantity, costPerUnit, date, account }
async function loadLots() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveLots(lots) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
}

// === Méthodes de calcul ===

// FIFO : on vend les plus anciens d'abord
export function computeFIFO(lots, sellQty) {
  const sorted = [...lots].sort((a, b) => new Date(a.date) - new Date(b.date));
  let remaining = sellQty;
  let cost = 0;
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, lot.quantity);
    cost += taken * lot.costPerUnit;
    remaining -= taken;
  }
  return { cost, avgCost: sellQty > 0 ? cost / sellQty : 0 };
}

// LIFO : on vend les plus récents d'abord
export function computeLIFO(lots, sellQty) {
  const sorted = [...lots].sort((a, b) => new Date(b.date) - new Date(a.date));
  let remaining = sellQty, cost = 0;
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, lot.quantity);
    cost += taken * lot.costPerUnit;
    remaining -= taken;
  }
  return { cost, avgCost: sellQty > 0 ? cost / sellQty : 0 };
}

// CMP : coût moyen pondéré sur tous les lots
export function computeCMP(lots) {
  const totalQty = lots.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
  return { avgCost: totalQty > 0 ? totalCost / totalQty : 0, totalQty, totalCost };
}

// Group lots by ticker
function groupByTicker(lots) {
  const map = {};
  for (const lot of lots) {
    const key = (lot.ticker || lot.name || '?').toUpperCase();
    if (!map[key]) map[key] = { ticker: key, name: lot.name, lots: [] };
    map[key].lots.push(lot);
  }
  return Object.values(map);
}

function fmtEUR(n) {
  return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €';
}
function fmtPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export async function renderCapitalGainsTrackerView(viewEl) {
  const isEN = getLocale() === 'en';

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.capital-gains-tracker.label'), t('mod.capital-gains-tracker.desc'), { example: t('mod.capital-gains-tracker.example'), moduleId: MODULE_ID })}

    <div class="card">
      <div class="card-title">➕ ${isEN ? 'Add a purchase lot' : 'Ajouter un lot d\'achat'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;font-size:13px;">
        <label>${isEN ? 'Ticker' : 'Ticker'}<input type="text" id="cg-ticker" placeholder="AAPL" /></label>
        <label>${isEN ? 'Name' : 'Nom'}<input type="text" id="cg-name" placeholder="Apple Inc." /></label>
        <label>${isEN ? 'Quantity' : 'Quantité'}<input type="number" id="cg-qty" step="0.0001" placeholder="10" /></label>
        <label>${isEN ? 'Cost / unit (€)' : 'Coût / unité (€)'}<input type="number" id="cg-cost" step="0.01" placeholder="150" /></label>
        <label>${isEN ? 'Date' : 'Date'}<input type="date" id="cg-date" /></label>
        <label>${isEN ? 'Account' : 'Compte'}<select id="cg-account"><option value="CTO">CTO</option><option value="PEA">PEA</option><option value="AV">${isEN ? 'Life ins.' : 'Assurance-vie'}</option><option value="other">${isEN ? 'Other' : 'Autre'}</option></select></label>
      </div>
      <button class="btn-primary" id="cg-add" style="margin-top:10px;">${isEN ? 'Add lot' : 'Ajouter le lot'}</button>
      <button class="btn-ghost" id="cg-import-wealth" style="margin-top:10px;margin-left:8px;">${isEN ? 'Import from wealth' : 'Importer depuis Patrimoine'}</button>
    </div>

    <div class="card">
      <div class="card-title">📊 ${isEN ? 'Method comparison & sell simulation' : 'Comparaison méthodes & simulation de vente'}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">
        ${isEN ? 'Pick a position, enter sell price + quantity. The app shows capital gain by method (FIFO / LIFO / CMP).' : 'Sélectionne une position, indique le prix et la quantité à vendre. L\'app calcule la plus-value selon chaque méthode.'}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;font-size:13px;">
        <label>${isEN ? 'Ticker' : 'Ticker'}<select id="cg-sim-ticker"></select></label>
        <label>${isEN ? 'Sell qty' : 'Qté à vendre'}<input type="number" id="cg-sim-qty" step="0.0001" /></label>
        <label>${isEN ? 'Sell price (€)' : 'Prix de vente (€)'}<input type="number" id="cg-sim-price" step="0.01" /></label>
      </div>
      <button class="btn-primary" id="cg-simulate" style="margin-top:10px;">${isEN ? 'Compare methods' : 'Comparer les méthodes'}</button>
      <div id="cg-sim-result" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <div class="card-title">📋 ${isEN ? 'Your lots' : 'Tes lots'} (<span id="cg-count">0</span>)</div>
      <div id="cg-lots-list"></div>
    </div>
  `;

  let lots = await loadLots();

  function refreshUI() {
    $('#cg-count', viewEl).textContent = lots.length;
    const grouped = groupByTicker(lots);

    // Update ticker selector
    const sel = $('#cg-sim-ticker', viewEl);
    sel.innerHTML = grouped.map(g => `<option value="${g.ticker}">${g.ticker} (${g.lots.length} lots)</option>`).join('') || '<option value="">—</option>';

    // List lots grouped
    if (lots.length === 0) {
      $('#cg-lots-list', viewEl).innerHTML = `<div style="color:var(--text-muted);padding:10px;">${isEN ? 'No lot yet. Add one above or import from Wealth.' : 'Aucun lot. Ajoute-en un ou importe depuis Patrimoine.'}</div>`;
      return;
    }
    $('#cg-lots-list', viewEl).innerHTML = grouped.map(g => {
      const cmp = computeCMP(g.lots);
      const totalValue = g.lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
      return `
        <div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong>${g.ticker}</strong>
            <span style="font-size:12px;color:var(--text-muted);">${cmp.totalQty.toFixed(4)} @ CMP ${fmtEUR(cmp.avgCost)} = ${fmtEUR(totalValue)}</span>
          </div>
          <table style="width:100%;font-size:12px;font-family:var(--font-mono);">
            <thead><tr style="color:var(--text-muted);text-align:left;"><th>Date</th><th>${isEN ? 'Qty' : 'Qté'}</th><th>${isEN ? 'Cost/u' : 'Coût/u'}</th><th>${isEN ? 'Account' : 'Compte'}</th><th></th></tr></thead>
            <tbody>
              ${g.lots.sort((a, b) => new Date(a.date) - new Date(b.date)).map(l => `
                <tr><td>${l.date}</td><td>${l.quantity}</td><td>${fmtEUR(l.costPerUnit)}</td><td>${l.account || '—'}</td><td><button class="btn-ghost btn-xs" data-del="${l.id}" aria-label="Supprimer">×</button></td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('');

    // Bind delete
    viewEl.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', async () => {
        lots = lots.filter(l => l.id !== b.dataset.del);
        saveLots(lots);
        refreshUI();
      });
    });
  }

  $('#cg-add', viewEl).addEventListener('click', () => {
    const lot = {
      id: 'lot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      ticker: ($('#cg-ticker', viewEl).value || '').toUpperCase().trim(),
      name: $('#cg-name', viewEl).value.trim(),
      quantity: Number($('#cg-qty', viewEl).value) || 0,
      costPerUnit: Number($('#cg-cost', viewEl).value) || 0,
      date: $('#cg-date', viewEl).value || new Date().toISOString().slice(0, 10),
      account: $('#cg-account', viewEl).value
    };
    if (!lot.ticker || !lot.quantity || !lot.costPerUnit) {
      alert(isEN ? 'Ticker, quantity and cost are required.' : 'Ticker, quantité et coût sont obligatoires.');
      return;
    }
    lots.push(lot);
    saveLots(lots);
    ['cg-ticker','cg-name','cg-qty','cg-cost'].forEach(id => $('#'+id, viewEl).value = '');
    refreshUI();
  });

  $('#cg-import-wealth', viewEl).addEventListener('click', async () => {
    const wealth = await listWealth().catch(() => []);
    let added = 0;
    for (const h of wealth) {
      if (!h.ticker || !h.quantity || !h.purchasePrice) continue;
      const exists = lots.some(l => l.ticker === h.ticker.toUpperCase() && l.date === (h.purchaseDate || ''));
      if (exists) continue;
      lots.push({
        id: 'lot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        ticker: h.ticker.toUpperCase(),
        name: h.name || h.ticker,
        quantity: h.quantity,
        costPerUnit: h.purchasePrice,
        date: h.purchaseDate || new Date().toISOString().slice(0, 10),
        account: h.account || 'CTO'
      });
      added++;
    }
    saveLots(lots);
    refreshUI();
    alert(isEN ? `${added} positions imported.` : `${added} positions importées.`);
  });

  $('#cg-simulate', viewEl).addEventListener('click', () => {
    const ticker = $('#cg-sim-ticker', viewEl).value;
    const sellQty = Number($('#cg-sim-qty', viewEl).value) || 0;
    const sellPrice = Number($('#cg-sim-price', viewEl).value) || 0;
    if (!ticker || !sellQty || !sellPrice) {
      $('#cg-sim-result', viewEl).innerHTML = `<div style="color:var(--accent-orange);">${isEN ? 'Fill ticker, quantity and price.' : 'Remplis ticker, quantité et prix.'}</div>`;
      return;
    }
    const tickerLots = lots.filter(l => l.ticker === ticker);
    const totalQty = tickerLots.reduce((s, l) => s + l.quantity, 0);
    if (sellQty > totalQty) {
      $('#cg-sim-result', viewEl).innerHTML = `<div style="color:var(--accent-red);">${isEN ? `You only own ${totalQty.toFixed(4)} units` : `Tu n'as que ${totalQty.toFixed(4)} unités`}</div>`;
      return;
    }
    const proceeds = sellQty * sellPrice;
    const fifo = computeFIFO(tickerLots, sellQty);
    const lifo = computeLIFO(tickerLots, sellQty);
    const cmp = computeCMP(tickerLots);
    const cmpCost = cmp.avgCost * sellQty;

    const rows = [
      { name: 'FIFO', cost: fifo.cost, gain: proceeds - fifo.cost },
      { name: 'LIFO', cost: lifo.cost, gain: proceeds - lifo.cost },
      { name: 'CMP',  cost: cmpCost,    gain: proceeds - cmpCost }
    ];
    const best = rows.reduce((a, b) => a.gain < b.gain ? a : b); // moins de plus-value = moins d'impôt
    const taxRateFR = 0.30; // PFU 30%

    $('#cg-sim-result', viewEl).innerHTML = `
      <div style="font-size:13px;margin-bottom:8px;">${isEN ? 'Sell proceeds' : 'Produit de vente'} : <strong>${fmtEUR(proceeds)}</strong> (${sellQty} × ${fmtEUR(sellPrice)})</div>
      <table style="width:100%;font-size:13px;font-family:var(--font-mono);">
        <thead><tr style="color:var(--text-muted);text-align:left;"><th>${isEN ? 'Method' : 'Méthode'}</th><th style="text-align:right;">${isEN ? 'Cost basis' : 'Prix de revient'}</th><th style="text-align:right;">${isEN ? 'Capital gain' : 'Plus-value'}</th><th style="text-align:right;">${isEN ? 'Tax (PFU 30%)' : 'Impôt (PFU 30%)'}</th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const isBest = r.name === best.name;
            const tax = Math.max(0, r.gain) * taxRateFR;
            return `<tr style="${isBest ? 'background:var(--bg-tertiary);' : ''}"><td><strong>${r.name}${isBest ? ' ⭐' : ''}</strong></td><td style="text-align:right;">${fmtEUR(r.cost)}</td><td style="text-align:right;color:${r.gain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtEUR(r.gain)} (${fmtPct((r.gain / r.cost) * 100)})</td><td style="text-align:right;color:var(--accent-red);">${fmtEUR(tax)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top:10px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;">
        💡 ${isEN ? `Best method to minimize tax: <strong>${best.name}</strong>. Save ${fmtEUR((rows[0].gain - best.gain) * taxRateFR)} vs the worst.` : `Méthode la plus avantageuse fiscalement : <strong>${best.name}</strong>. Économise ${fmtEUR(Math.max(0, (Math.max(...rows.map(r=>r.gain)) - best.gain)) * taxRateFR)} vs la pire.`}
        <br>${isEN ? 'Note: French CTO uses CMP by law. FIFO available on PEA/PER/AV in some setups.' : 'Note : sur CTO français, le CMP est imposé par la loi. FIFO/LIFO disponibles sur certains contrats étrangers.'}
      </div>
    `;
  });

  refreshUI();

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    if (lots.length === 0) {
      const today = new Date();
      const past = (m) => new Date(today.getFullYear(), today.getMonth() - m, 15).toISOString().slice(0, 10);
      lots = [
        { id: 'demo1', ticker: 'AAPL', name: 'Apple Inc.', quantity: 10, costPerUnit: 120, date: past(24), account: 'CTO' },
        { id: 'demo2', ticker: 'AAPL', name: 'Apple Inc.', quantity: 5,  costPerUnit: 165, date: past(12), account: 'CTO' },
        { id: 'demo3', ticker: 'AAPL', name: 'Apple Inc.', quantity: 8,  costPerUnit: 195, date: past(3),  account: 'CTO' }
      ];
      saveLots(lots);
      refreshUI();
    }
    $('#cg-sim-ticker', viewEl).value = 'AAPL';
    $('#cg-sim-qty', viewEl).value = 10;
    $('#cg-sim-price', viewEl).value = 220;
    $('#cg-simulate', viewEl).click();
  });
}
