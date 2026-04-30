// Module Wealth (Patrimoine) — mémoire centralisée des holdings de l'utilisateur
import { $, $$, toast, fmtRelative, escHtml, uuid } from '../core/utils.js';
import { listWealth, saveHolding, deleteHolding, getTotals, refreshPrices, WEALTH_CATEGORIES, bulkImport, clearWealth, takeSnapshot, listSnapshots, deleteSnapshot, clearSnapshots, maybeAutoSnapshot, backfillHistory } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { pieAllocation, wealthEvolution } from '../ui/charts.js';
import { t } from '../core/i18n.js';
import { downloadMarkdown } from '../core/export.js';

const MODULE_ID = 'wealth';
let chart = null;
let evolutionChart = null;

export async function renderWealthView(viewEl) {
  if (chart) { try { chart.destroy(); } catch {} chart = null; }

  viewEl.innerHTML = `
    ${moduleHeader('💼 Patrimoine', 'Mémoire centralisée de ton patrimoine — utilisé comme contexte pour adapter toutes les analyses à ta situation réelle.', { moduleId: MODULE_ID })}

    <div class="wealth-summary" id="wealth-summary"></div>

    <div class="card">
      <div class="card-title">Holdings <span style="float:right;">
        <select id="wl-currency" class="input" style="font-size:11px;padding:4px 8px;width:auto;display:inline-block;">
          <option value="EUR">€ EUR</option>
          <option value="USD">$ USD</option>
          <option value="GBP">£ GBP</option>
          <option value="CHF">CHF</option>
        </select>
        <button id="wl-refresh" class="btn-fetch" style="margin-left:6px;">⟳ Refresh prices</button>
      </span></div>

      <div class="wealth-actions">
        <button id="wl-add" class="btn-primary">+ Add holding</button>
        <button id="wl-import" class="btn-secondary">📥 Import JSON</button>
        <button id="wl-export" class="btn-secondary">📤 Export JSON</button>
        <button id="wl-clear" class="btn-danger">🗑 Clear all</button>
        <input id="wl-import-file" type="file" accept="application/json" hidden />
      </div>

      <div class="chart-wrap" style="margin-top:14px;"><canvas id="wl-pie"></canvas></div>

      <div id="wl-list" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <div class="card-title">📈 Évolution du patrimoine
        <span style="float:right;display:flex;gap:6px;align-items:center;">
          <button id="wl-snap-now" class="btn-secondary" style="font-size:11px;padding:5px 10px;">📸 Snapshot now</button>
          <button id="wl-backfill" class="btn-secondary" style="font-size:11px;padding:5px 10px;">⏪ Backfill 90d</button>
          <select id="wl-snap-range" class="input" style="font-size:11px;padding:4px 8px;width:auto;display:inline-block;">
            <option value="all">All</option>
            <option value="365">1Y</option>
            <option value="180">6M</option>
            <option value="90" selected>3M</option>
            <option value="30">1M</option>
            <option value="7">7D</option>
          </select>
        </span>
      </div>
      <div id="wl-evolution-info" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-bottom:8px;"></div>
      <div class="chart-wrap tall"><canvas id="wl-evolution"></canvas></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--text-muted);">
        <span id="wl-snap-count"></span>
        <button id="wl-snap-clear" class="btn-ghost" style="font-size:11px;">Clear all snapshots</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Use my wealth as context — per module</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">Les modules suivants peuvent utiliser ton patrimoine comme contexte (analyses adaptées à ta situation réelle). Coche pour activer.</p>
      <div id="wl-toggles" class="wl-toggles-grid"></div>
    </div>
  `;

  // Auto-snapshot si pas pris dans les 20 dernières heures
  try { await maybeAutoSnapshot('EUR'); } catch {}

  await refreshUI();
  await refreshEvolution();

  $('#wl-refresh').addEventListener('click', () => doRefresh());
  $('#wl-add').addEventListener('click', () => openEditor());
  $('#wl-currency').addEventListener('change', () => { refreshUI(); refreshEvolution(); });
  $('#wl-snap-range').addEventListener('change', refreshEvolution);
  $('#wl-snap-now').addEventListener('click', async () => {
    const cur = $('#wl-currency').value || 'EUR';
    const s = await takeSnapshot(cur, 'manual');
    if (s) { toast('Snapshot saved', 'success'); refreshEvolution(); }
    else toast('No holdings to snapshot', 'warning');
  });
  $('#wl-snap-clear').addEventListener('click', async () => {
    if (!confirm('Effacer tout l\'historique des snapshots ?')) return;
    await clearSnapshots(); toast('Snapshots cleared', 'success'); refreshEvolution();
  });
  $('#wl-backfill').addEventListener('click', () => doBackfill());
  $('#wl-export').addEventListener('click', exportData);
  $('#wl-import').addEventListener('click', () => $('#wl-import-file').click());
  $('#wl-import-file').addEventListener('change', importData);
  $('#wl-clear').addEventListener('click', async () => {
    if (confirm('Supprimer TOUTES les holdings ? Action irréversible.')) {
      await clearWealth(); toast('Patrimoine effacé', 'success'); refreshUI();
    }
  });

  renderToggles();
}

async function refreshUI() {
  const target = $('#wl-currency')?.value || 'EUR';
  const totals = await getTotals(target);
  const sym = ({ USD: '$', EUR: '€', GBP: '£', CHF: 'CHF' })[target] || target;

  // Summary
  const summary = $('#wealth-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="wealth-card">
        <div class="wealth-total-label">Patrimoine total (${target})</div>
        <div class="wealth-total-num">${sym}${fmtMoney(totals.total)}</div>
        <div class="wealth-total-meta">${totals.count} holdings · ${Object.keys(totals.byCategory).length} catégories</div>
      </div>
      <div class="wealth-breakdown">
        ${WEALTH_CATEGORIES.filter(c => totals.byCategory[c.id]).map(c => {
          const v = totals.byCategory[c.id] || 0;
          const pct = totals.total > 0 ? (v / totals.total * 100).toFixed(1) : '0';
          return `<div class="wealth-cat-row">
            <span class="wealth-cat-icon">${c.icon}</span>
            <span class="wealth-cat-label">${c.label}</span>
            <span class="wealth-cat-pct">${pct}%</span>
            <span class="wealth-cat-val">${sym}${fmtMoney(v)}</span>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  // Pie chart
  const canvas = document.getElementById('wl-pie');
  if (canvas) {
    if (chart) try { chart.destroy(); } catch {}
    const items = WEALTH_CATEGORIES
      .filter(c => totals.byCategory[c.id])
      .map(c => ({ label: c.icon + ' ' + c.label, value: totals.byCategory[c.id] }));
    if (items.length) chart = pieAllocation(canvas, items);
  }

  // Holdings list
  const list = await listWealth();
  list.sort((a, b) => (b.value || 0) - (a.value || 0));

  // Carte récap immobilier (si au moins un bien immo avec prêt)
  await renderRealEstateSummary(list);

  const listEl = $('#wl-list');
  if (listEl) {
    if (!list.length) {
      listEl.innerHTML = `<div class="alert alert-info">Aucune holding. Ajoute ta première position avec le bouton "+ Add holding".</div>`;
    } else {
      const { computeRealEstateMetrics, fmtMonths } = await import('../core/real-estate.js');
      listEl.innerHTML = `
        <table class="wealth-table">
          <thead><tr><th></th><th>Name</th><th>Ticker</th><th>Category</th><th>Account</th><th>Qty</th><th>Unit price</th><th>Total value</th><th>Auto</th><th></th></tr></thead>
          <tbody>
            ${list.map(h => {
              const cat = WEALTH_CATEGORIES.find(c => c.id === h.category) || WEALTH_CATEGORIES[WEALTH_CATEGORIES.length-1];
              const ccy = h.currency || 'EUR';
              const ccySym = ({ USD: '$', EUR: '€', GBP: '£' })[ccy] || ccy;
              // Unit price : stocké directement, ou dérivé (lastPrice si auto, ou value/qty)
              const unitP = h.unitPrice || h.lastPrice || (h.quantity ? h.value / h.quantity : 0);
              // Mini-récap immo sous la ligne si applicable
              let immoRow = '';
              if (h.category === 'real_estate' && h.loanAmount > 0) {
                const m = computeRealEstateMetrics(h);
                const typeLabel = h.propertyType === 'locatif' ? '🏘️ Locatif' : h.propertyType === 'secondary_residence' ? '🏖️ Secondaire' : '🏠 RP';
                const cashflowChip = h.propertyType === 'locatif' && m.monthlyRent > 0
                  ? ` · 💰 CF mensuel : <strong style="color:${m.monthlyCashflow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${m.monthlyCashflow >= 0 ? '+' : ''}${fmtMoney(m.monthlyCashflow)} €</strong>`
                  : '';
                const yieldChip = h.propertyType === 'locatif' && m.grossYield > 0
                  ? ` · 💎 Brute : ${m.grossYield.toFixed(2)}% / Nette : ${m.netYield.toFixed(2)}%`
                  : '';
                immoRow = `
                  <tr data-id="${h.id}-immo" class="wl-immo-row">
                    <td colspan="10" style="padding:6px 12px;background:var(--bg-tertiary);font-size:11.5px;font-family:var(--font-mono);color:var(--text-secondary);border-top:0;">
                      ${typeLabel} · 💸 Mensualité : <strong>${fmtMoney(m.monthlyPayment)} €</strong>
                      · 📉 Restant : <strong style="color:var(--accent-orange);">${fmtMoney(m.remaining)} €</strong>
                      · 📅 ${fmtMonths(m.monthsElapsed)} / ${fmtMonths((h.loanDuration || 0))} (${m.progressPct.toFixed(0)}%)
                      · 📈 Équité : <strong style="color:var(--accent-green);">${fmtMoney(m.equity)} €</strong>
                      · LTV : ${m.ltv.toFixed(0)}%${cashflowChip}${yieldChip}
                    </td>
                  </tr>
                `;
              }
              return `
                <tr data-id="${h.id}">
                  <td>${cat.icon}</td>
                  <td>${escHtml(h.name)}</td>
                  <td><code>${escHtml(h.ticker || '')}</code></td>
                  <td>${cat.label}</td>
                  <td>${escHtml(h.account || '')}</td>
                  <td><strong>${h.quantity || ''}</strong></td>
                  <td>${ccySym}${unitP ? unitP.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : '—'}</td>
                  <td><strong>${ccySym}${fmtMoney(h.value || 0)}</strong>${h.priceLastUpdated ? '<br><span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + fmtRelative(h.priceLastUpdated) + '</span>' : ''}</td>
                  <td>${h.autoValue ? '⚡' : '✋'}</td>
                  <td>
                    <button class="btn-ghost wl-edit" data-id="${h.id}">✎</button>
                    <button class="btn-ghost wl-del" data-id="${h.id}">×</button>
                  </td>
                </tr>
                ${immoRow}
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      listEl.querySelectorAll('.wl-edit').forEach(b => b.addEventListener('click', () => openEditor(b.getAttribute('data-id'))));
      listEl.querySelectorAll('.wl-del').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Supprimer cette holding ?')) return;
        await deleteHolding(b.getAttribute('data-id'));
        toast('Supprimé', 'success');
        refreshUI();
      }));
    }
  }
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('fr-FR');
}

// Carte récap globale immobilier (somme valeur, somme dette, équité, cash-flow agrégé)
async function renderRealEstateSummary(list) {
  // Insère ou met à jour une card au-dessus de #wl-list dans le card existant
  const wlList = document.getElementById('wl-list');
  if (!wlList) return;
  let card = document.getElementById('wl-immo-summary');

  const properties = (list || []).filter(h => h.category === 'real_estate');
  if (properties.length === 0) {
    if (card) card.remove();
    return;
  }

  const { computeRealEstateMetrics, fmtMonths } = await import('../core/real-estate.js');
  let totalValue = 0, totalRemaining = 0, totalEquity = 0, totalMonthlyPayment = 0;
  let totalMonthlyRent = 0, totalMonthlyCharges = 0, totalAnnualPropertyTax = 0;
  let totalCashflow = 0;
  let totalPurchase = 0, totalCapitalGain = 0;
  const perProperty = [];

  for (const h of properties) {
    const m = computeRealEstateMetrics(h);
    totalValue += m.currentValue;
    totalRemaining += m.remaining;
    totalEquity += m.equity;
    totalMonthlyPayment += m.monthlyPayment;
    totalMonthlyRent += m.monthlyRent;
    totalMonthlyCharges += m.monthlyCharges;
    totalAnnualPropertyTax += m.propertyTaxYear;
    if (m.isRental) totalCashflow += m.monthlyCashflow;
    totalPurchase += Number(h.purchasePrice) || 0;
    totalCapitalGain += m.capitalGain;
    perProperty.push({ h, m });
  }

  const aggLtv = totalValue > 0 ? (totalRemaining / totalValue) * 100 : 0;
  const aggCapitalGainPct = totalPurchase > 0 ? (totalCapitalGain / totalPurchase) * 100 : 0;

  const html = `
    <div id="wl-immo-summary" style="margin-bottom:16px;padding:14px;background:var(--bg-tertiary);border-left:3px solid var(--accent-blue);border-radius:6px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:10px;">🏠 Patrimoine immobilier (${properties.length} bien${properties.length > 1 ? 's' : ''})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:12px;font-family:var(--font-mono);">
        <div><div style="color:var(--text-muted);font-size:10px;">Valeur totale</div><strong style="font-size:15px;">${fmtMoney(totalValue)} €</strong></div>
        <div><div style="color:var(--text-muted);font-size:10px;">Capital restant dû</div><strong style="font-size:15px;color:var(--accent-orange);">${fmtMoney(totalRemaining)} €</strong></div>
        <div><div style="color:var(--text-muted);font-size:10px;">Équité (net)</div><strong style="font-size:15px;color:var(--accent-green);">${fmtMoney(totalEquity)} €</strong></div>
        <div><div style="color:var(--text-muted);font-size:10px;">LTV global</div><strong style="font-size:15px;">${aggLtv.toFixed(1)}%</strong></div>
        <div><div style="color:var(--text-muted);font-size:10px;">Mensualités totales</div><strong style="font-size:15px;">${fmtMoney(totalMonthlyPayment)} €/mois</strong></div>
        ${totalMonthlyRent > 0 ? `<div><div style="color:var(--text-muted);font-size:10px;">Loyers reçus</div><strong style="font-size:15px;color:var(--accent-green);">+${fmtMoney(totalMonthlyRent)} €/mois</strong></div>` : ''}
        ${totalCashflow !== 0 ? `<div><div style="color:var(--text-muted);font-size:10px;">Cash-flow locatif net</div><strong style="font-size:15px;color:${totalCashflow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${totalCashflow >= 0 ? '+' : ''}${fmtMoney(totalCashflow)} €/mois</strong></div>` : ''}
        ${totalPurchase > 0 ? `<div><div style="color:var(--text-muted);font-size:10px;">Plus-value totale</div><strong style="font-size:15px;color:${totalCapitalGain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${totalCapitalGain >= 0 ? '+' : ''}${fmtMoney(totalCapitalGain)} € (${aggCapitalGainPct >= 0 ? '+' : ''}${aggCapitalGainPct.toFixed(1)}%)</strong></div>` : ''}
      </div>
      ${perProperty.length > 1 ? `
      <details style="margin-top:10px;font-size:11px;color:var(--text-muted);">
        <summary style="cursor:pointer;">Détail par bien</summary>
        <table style="width:100%;margin-top:6px;font-size:11px;border-collapse:collapse;">
          <thead><tr style="border-bottom:1px solid var(--border);text-align:left;">
            <th style="padding:4px;">Bien</th><th style="padding:4px;">Type</th><th style="padding:4px;text-align:right;">Restant</th><th style="padding:4px;text-align:right;">Équité</th><th style="padding:4px;text-align:right;">LTV</th><th style="padding:4px;text-align:right;">CF mois</th>
          </tr></thead>
          <tbody>
            ${perProperty.map(({ h, m }) => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:4px;">${escHtml(h.name)}</td>
                <td style="padding:4px;">${h.propertyType === 'locatif' ? '🏘️' : h.propertyType === 'secondary_residence' ? '🏖️' : '🏠'}</td>
                <td style="padding:4px;text-align:right;font-family:var(--font-mono);color:var(--accent-orange);">${fmtMoney(m.remaining)}</td>
                <td style="padding:4px;text-align:right;font-family:var(--font-mono);color:var(--accent-green);">${fmtMoney(m.equity)}</td>
                <td style="padding:4px;text-align:right;font-family:var(--font-mono);">${m.ltv.toFixed(0)}%</td>
                <td style="padding:4px;text-align:right;font-family:var(--font-mono);color:${m.monthlyCashflow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${m.isRental ? (m.monthlyCashflow >= 0 ? '+' : '') + fmtMoney(m.monthlyCashflow) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>` : ''}
    </div>
  `;

  if (card) {
    card.outerHTML = html;
  } else {
    wlList.insertAdjacentHTML('beforebegin', html);
  }
}

async function openEditor(id) {
  const list = await listWealth();
  const existing = id ? list.find(h => h.id === id) : null;
  const h = existing || {
    id: uuid(),
    name: '', ticker: '', category: 'stocks', account: '',
    quantity: 0, value: 0, currency: 'EUR', autoValue: false, notes: '',
    // Real-estate defaults
    propertyType: 'residence_principale', purchaseDate: '', purchasePrice: 0,
    loanAmount: 0, loanRate: 0, loanDuration: 0, loanStartDate: '',
    monthlyRent: 0, monthlyCharges: 0, propertyTax: 0
  };

  const { showGenericModal, closeGenericModal } = await import('../ui/modal.js');
  const { computeRealEstateMetrics, fmtMonths } = await import('../core/real-estate.js');
  showGenericModal(existing ? 'Edit holding' : 'Add holding', `
    <div class="field-row">
      <div class="field"><label class="field-label">Name *</label><input id="he-name" class="input" value="${escHtml(h.name)}" placeholder="ex: Apple Inc, Bitcoin, RP Lyon..." /></div>
      <div class="field"><label class="field-label">Ticker (optional)</label><input id="he-ticker" class="input" value="${escHtml(h.ticker || '')}" placeholder="AAPL, BTC, ETH..." /></div>
    </div>
    <div class="field-row">
      <div class="field"><label class="field-label">Category</label>
        <select id="he-cat" class="input">${WEALTH_CATEGORIES.map(c => `<option value="${c.id}" ${c.id===h.category?'selected':''}>${c.icon} ${c.label}</option>`).join('')}</select>
      </div>
      <div class="field"><label class="field-label">Account / Broker</label><input id="he-account" class="input" value="${escHtml(h.account || '')}" placeholder="PEA Boursorama, IBKR, MetaMask..." /></div>
    </div>

    <!-- ======= IMMOBILIER (visible si category=real_estate) ======= -->
    <div id="he-realestate-block" style="display:${h.category === 'real_estate' ? 'block' : 'none'};border:1px solid var(--border);border-radius:6px;padding:14px;margin:14px 0;background:var(--bg-tertiary);">
      <div style="font-weight:600;font-size:13px;margin-bottom:10px;">🏠 Détails immobilier</div>
      <div class="field-row">
        <div class="field"><label class="field-label">Type de bien</label>
          <select id="he-prop-type" class="input">
            <option value="residence_principale" ${h.propertyType==='residence_principale'?'selected':''}>🏠 Résidence principale</option>
            <option value="locatif" ${h.propertyType==='locatif'?'selected':''}>🏘️ Locatif</option>
            <option value="secondary_residence" ${h.propertyType==='secondary_residence'?'selected':''}>🏖️ Résidence secondaire</option>
          </select>
        </div>
        <div class="field"><label class="field-label">Date d'achat</label><input id="he-purchase-date" class="input" type="date" value="${h.purchaseDate || ''}" /></div>
        <div class="field"><label class="field-label">Prix d'achat (€)</label><input id="he-purchase-price" class="input" type="number" step="100" value="${h.purchasePrice || ''}" placeholder="280000" /></div>
      </div>

      <div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:var(--text-secondary);">💳 Prêt immobilier</div>
      <div class="field-row">
        <div class="field"><label class="field-label">Montant emprunté (€)</label><input id="he-loan-amount" class="input" type="number" step="100" value="${h.loanAmount || ''}" placeholder="240000" /></div>
        <div class="field"><label class="field-label">Taux d'intérêt annuel (%)</label><input id="he-loan-rate" class="input" type="number" step="0.01" value="${h.loanRate ? (h.loanRate * 100).toFixed(2) : ''}" placeholder="2.50" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="field-label">Durée (années)</label><input id="he-loan-years" class="input" type="number" step="1" min="1" max="35" value="${h.loanDuration ? Math.round(h.loanDuration / 12) : ''}" placeholder="20" /></div>
        <div class="field"><label class="field-label">1er prélèvement</label><input id="he-loan-start" class="input" type="date" value="${h.loanStartDate || ''}" /></div>
      </div>

      <div id="he-prop-rental-block" style="display:${h.propertyType === 'locatif' ? 'block' : 'none'};">
        <div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:var(--text-secondary);">🏘️ Locatif</div>
        <div class="field-row">
          <div class="field"><label class="field-label">Loyer mensuel hors charges (€)</label><input id="he-rent" class="input" type="number" step="10" value="${h.monthlyRent || ''}" placeholder="1100" /></div>
          <div class="field"><label class="field-label">Charges copropriété (€/mois)</label><input id="he-charges" class="input" type="number" step="10" value="${h.monthlyCharges || ''}" placeholder="80" /></div>
          <div class="field"><label class="field-label">Taxe foncière (€/an)</label><input id="he-tax" class="input" type="number" step="10" value="${h.propertyTax || ''}" placeholder="1200" /></div>
        </div>
      </div>

      <!-- Aperçu calculs en live -->
      <div id="he-realestate-preview" style="margin-top:12px;padding:10px;background:var(--bg-secondary);border-radius:4px;font-size:12px;font-family:var(--font-mono);"></div>
    </div>

    <div class="field-row-3">
      <div class="field"><label class="field-label">Quantity owned</label><input id="he-qty" class="input" type="number" step="any" value="${h.quantity || ''}" placeholder="ex: 100 shares, 0.5 BTC, 1 m²..." /></div>
      <div class="field"><label class="field-label">Currency</label>
        <select id="he-ccy" class="input">${['EUR','USD','GBP','CHF','JPY','CNY'].map(c => `<option ${c===h.currency?'selected':''}>${c}</option>`).join('')}</select>
      </div>
      <div class="field"><label class="field-label">Price per unit</label><input id="he-unit-price" class="input" type="number" step="any" value="${h.unitPrice || (h.quantity ? (h.value/h.quantity).toFixed(4) : '') || ''}" placeholder="prix d'1 unité" /></div>
    </div>
    <div class="field" style="background:var(--bg-tertiary);padding:10px 14px;border-radius:4px;border-left:3px solid var(--accent-green);">
      <span style="font-size:11px;color:var(--text-secondary);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.05em;">Total value (auto-calculated)</span>
      <div id="he-total-preview" style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--accent-green);margin-top:4px;">—</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Pour l'immobilier : valeur actuelle estimée du bien (utilisée pour calculer LTV et plus-value).</div>
    </div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input id="he-auto" type="checkbox" ${h.autoValue?'checked':''} /> ⚡ Auto-fetch price (uses ticker → live price replaces unit price)
      </label>
    </div>
    <div class="field"><label class="field-label">Notes</label><textarea id="he-notes" class="textarea" rows="3">${escHtml(h.notes || '')}</textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
      <button id="he-cancel" class="btn-ghost">Cancel</button>
      <button id="he-save" class="btn-primary">${existing ? 'Update' : 'Add'}</button>
    </div>
  `, { wide: true });

  // Toggle real-estate block en fonction de la catégorie
  document.getElementById('he-cat').addEventListener('change', (e) => {
    document.getElementById('he-realestate-block').style.display = e.target.value === 'real_estate' ? 'block' : 'none';
    updateRealEstatePreview();
  });
  document.getElementById('he-prop-type').addEventListener('change', (e) => {
    document.getElementById('he-prop-rental-block').style.display = e.target.value === 'locatif' ? 'block' : 'none';
    updateRealEstatePreview();
  });

  // Live preview des calculs immo
  function updateRealEstatePreview() {
    if (document.getElementById('he-cat').value !== 'real_estate') return;
    const principal   = parseFloat(document.getElementById('he-loan-amount').value) || 0;
    const ratePct     = parseFloat(document.getElementById('he-loan-rate').value)   || 0;
    const years       = parseInt(document.getElementById('he-loan-years').value, 10) || 0;
    const startDate   = document.getElementById('he-loan-start').value;
    const purchase    = parseFloat(document.getElementById('he-purchase-price').value) || 0;
    const currentVal  = (parseFloat(document.getElementById('he-qty').value) || 0) * (parseFloat(document.getElementById('he-unit-price').value) || 0);
    const propType    = document.getElementById('he-prop-type').value;
    const rent        = parseFloat(document.getElementById('he-rent')?.value)    || 0;
    const charges     = parseFloat(document.getElementById('he-charges')?.value) || 0;
    const tax         = parseFloat(document.getElementById('he-tax')?.value)     || 0;

    const m = computeRealEstateMetrics({
      value: currentVal || purchase,
      purchasePrice: purchase,
      loanAmount: principal,
      loanRate: ratePct / 100,
      loanDuration: years * 12,
      loanStartDate: startDate,
      monthlyRent: rent,
      monthlyCharges: charges,
      propertyTax: tax,
      propertyType: propType
    });

    const preview = document.getElementById('he-realestate-preview');
    if (!preview) return;
    if (principal === 0 && years === 0) {
      preview.innerHTML = '<span style="color:var(--text-muted);">Renseigne montant emprunté + taux + durée pour voir les calculs.</span>';
      return;
    }
    const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
    let html = `
      💸 <strong>Mensualité</strong> : ${fmt(m.monthlyPayment)} €
      · 📅 <strong>Écoulé</strong> : ${fmtMonths(m.monthsElapsed)} / ${fmtMonths(years * 12)} (${m.progressPct.toFixed(0)}%)
      <br>
      📉 <strong>Capital restant dû</strong> : <span style="color:var(--accent-orange);">${fmt(m.remaining)} €</span>
      · ✅ <strong>Capital remboursé</strong> : ${fmt(m.principalRepaid)} €
      <br>
      💰 <strong>Intérêts payés à ce jour</strong> : ${fmt(m.interestPaid)} €
      · 📊 <strong>Intérêts totaux du prêt</strong> : ${fmt(m.totalInterest)} €
    `;
    if (currentVal > 0) {
      html += `<br>📈 <strong>Équité (valeur - capital restant)</strong> : <span style="color:var(--accent-green);">${fmt(m.equity)} €</span> · <strong>LTV</strong> : ${m.ltv.toFixed(1)}%`;
      if (purchase > 0) {
        html += ` · <strong>Plus-value</strong> : <span style="color:${m.capitalGain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${m.capitalGain >= 0 ? '+' : ''}${fmt(m.capitalGain)} € (${m.capitalGainPct >= 0 ? '+' : ''}${m.capitalGainPct.toFixed(1)}%)</span>`;
      }
    }
    if (propType === 'locatif' && rent > 0) {
      html += `<br>🏘️ <strong>Cash-flow mensuel</strong> : <span style="color:${m.monthlyCashflow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${m.monthlyCashflow >= 0 ? '+' : ''}${fmt(m.monthlyCashflow)} €</span>`;
      html += ` · <strong>Cash-flow annuel</strong> : ${m.annualCashflow >= 0 ? '+' : ''}${fmt(m.annualCashflow)} €`;
      if (purchase > 0) {
        html += `<br>💎 <strong>Rentabilité brute</strong> : ${m.grossYield.toFixed(2)}% · <strong>nette</strong> : ${m.netYield.toFixed(2)}%`;
      }
    }
    preview.innerHTML = html;
  }

  ['he-loan-amount','he-loan-rate','he-loan-years','he-loan-start','he-purchase-price','he-rent','he-charges','he-tax','he-prop-type','he-qty','he-unit-price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', updateRealEstatePreview); el.addEventListener('change', updateRealEstatePreview); }
  });
  updateRealEstatePreview();

  // Live preview du total (qty × unit price)
  function updateTotalPreview() {
    const qty = parseFloat(document.getElementById('he-qty').value) || 0;
    const unit = parseFloat(document.getElementById('he-unit-price').value) || 0;
    const ccy = document.getElementById('he-ccy').value;
    const sym = ({ USD: '$', EUR: '€', GBP: '£', CHF: 'CHF' })[ccy] || ccy;
    const total = qty * unit;
    const preview = document.getElementById('he-total-preview');
    if (total > 0) preview.textContent = `${sym}${total.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`;
    else preview.textContent = '— (saisis quantité × prix unitaire)';
  }
  ['he-qty', 'he-unit-price', 'he-ccy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateTotalPreview);
    if (el) el.addEventListener('change', updateTotalPreview);
  });
  updateTotalPreview();

  document.getElementById('he-cancel').addEventListener('click', closeGenericModal);
  document.getElementById('he-save').addEventListener('click', async () => {
    const qty = parseFloat(document.getElementById('he-qty').value) || 0;
    const unitPrice = parseFloat(document.getElementById('he-unit-price').value) || 0;
    const cat = document.getElementById('he-cat').value;
    const updated = {
      ...h,
      name: document.getElementById('he-name').value.trim(),
      ticker: document.getElementById('he-ticker').value.trim().toUpperCase(),
      category: cat,
      account: document.getElementById('he-account').value.trim(),
      quantity: qty,
      currency: document.getElementById('he-ccy').value,
      unitPrice: unitPrice,
      value: +(qty * unitPrice).toFixed(2), // Auto-calculé : quantity × unit price
      autoValue: document.getElementById('he-auto').checked,
      notes: document.getElementById('he-notes').value.trim()
    };
    // Real-estate fields (uniquement si category=real_estate, sinon on les efface pour éviter du noise)
    if (cat === 'real_estate') {
      const ratePct = parseFloat(document.getElementById('he-loan-rate').value) || 0;
      const years   = parseInt(document.getElementById('he-loan-years').value, 10) || 0;
      const propType = document.getElementById('he-prop-type').value;
      updated.propertyType    = propType;
      updated.purchaseDate    = document.getElementById('he-purchase-date').value || null;
      updated.purchasePrice   = parseFloat(document.getElementById('he-purchase-price').value) || 0;
      updated.loanAmount      = parseFloat(document.getElementById('he-loan-amount').value) || 0;
      updated.loanRate        = ratePct / 100;
      updated.loanDuration    = years * 12;
      updated.loanStartDate   = document.getElementById('he-loan-start').value || null;
      updated.monthlyRent     = propType === 'locatif' ? (parseFloat(document.getElementById('he-rent')?.value)    || 0) : 0;
      updated.monthlyCharges  = propType === 'locatif' ? (parseFloat(document.getElementById('he-charges')?.value) || 0) : 0;
      updated.propertyTax     = propType === 'locatif' ? (parseFloat(document.getElementById('he-tax')?.value)     || 0) : 0;
    } else {
      // Si on change de catégorie, on retire les champs immo (sinon ils restent dormants)
      delete updated.propertyType; delete updated.purchaseDate; delete updated.purchasePrice;
      delete updated.loanAmount;   delete updated.loanRate;     delete updated.loanDuration;
      delete updated.loanStartDate;delete updated.monthlyRent;  delete updated.monthlyCharges;
      delete updated.propertyTax;
    }
    if (!updated.name) { toast('Name required', 'warning'); return; }
    await saveHolding(updated);
    closeGenericModal();
    toast('Saved', 'success');
    refreshUI();
  });
}

async function doRefresh() {
  const btn = $('#wl-refresh');
  btn.disabled = true; btn.textContent = '⏳ Fetching...';
  try {
    const r = await refreshPrices(({ i, total, ticker }) => {
      btn.textContent = `⏳ ${ticker} (${i}/${total})`;
    });
    btn.disabled = false; btn.textContent = '⟳ Refresh prices';
    toast(`${r.updated}/${r.total} prices updated`, 'success');
    // Snapshot après refresh pour capturer les nouvelles valeurs
    const cur = $('#wl-currency').value || 'EUR';
    try { await takeSnapshot(cur, 'after-refresh'); } catch {}
    refreshUI();
    refreshEvolution();
  } catch (e) {
    btn.disabled = false; btn.textContent = '⟳ Refresh prices';
    toast('Error: ' + e.message, 'error');
  }
}

async function refreshEvolution() {
  const canvas = document.getElementById('wl-evolution');
  if (!canvas) return;
  const range = $('#wl-snap-range')?.value || '90';
  let snaps = await listSnapshots();
  if (range !== 'all') {
    const cutoff = Date.now() - parseInt(range, 10) * 24 * 3600 * 1000;
    snaps = snaps.filter(s => new Date(s.date).getTime() >= cutoff);
  }
  // Filter by current displayed currency (if snapshots have different currencies, only show matching)
  const cur = $('#wl-currency')?.value || 'EUR';
  snaps = snaps.filter(s => (s.currency || 'EUR') === cur);

  const info = $('#wl-evolution-info');
  const countEl = $('#wl-snap-count');
  if (countEl) countEl.textContent = `${snaps.length} snapshots`;

  if (evolutionChart) try { evolutionChart.destroy(); } catch {}
  if (!snaps.length) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (info) info.textContent = 'Aucun snapshot pour cette devise / période. Clique 📸 Snapshot now ou ⏪ Backfill 90d.';
    return;
  }

  // Calc evolution % first → last
  const first = snaps[0].total;
  const last = snaps[snaps.length - 1].total;
  const change = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const sym = ({ USD: '$', EUR: '€', GBP: '£', CHF: 'CHF' })[cur] || cur;
  const arrow = change > 0 ? '🟢 +' : change < 0 ? '🔴 ' : '🟡 ';
  if (info) info.innerHTML = `${snaps.length} snapshots · ${new Date(snaps[0].date).toLocaleDateString('fr-FR')} → ${new Date(snaps[snaps.length-1].date).toLocaleDateString('fr-FR')} · ${arrow}${sym}${Math.round(Math.abs(change)).toLocaleString('fr-FR')} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`;

  evolutionChart = wealthEvolution(canvas, snaps, { categories: WEALTH_CATEGORIES });
}

async function doBackfill() {
  const btn = $('#wl-backfill');
  btn.disabled = true; btn.textContent = '⏳ Backfilling…';
  try {
    const res = await backfillHistory({ days: 90, currency: $('#wl-currency').value || 'EUR', onProgress: ({ ticker, i, total }) => {
      btn.textContent = `⏳ ${ticker} (${i}/${total})`;
    }});
    btn.disabled = false; btn.textContent = '⏪ Backfill 90d';
    toast(`${res.count} snapshots historiques créés (${res.days}j)`, 'success');
    refreshEvolution();
  } catch (e) {
    btn.disabled = false; btn.textContent = '⏪ Backfill 90d';
    toast('Backfill : ' + e.message, 'error');
  }
}

async function exportData() {
  const list = await listWealth();
  downloadMarkdown(`wealth-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ app: 'alpha-terminal', exported: new Date().toISOString(), wealth: list }, null, 2));
  toast('Exported', 'success');
}

async function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const text = await f.text();
    const d = JSON.parse(text);
    const arr = Array.isArray(d) ? d : d.wealth;
    if (!Array.isArray(arr)) throw new Error('Format invalide');
    await bulkImport(arr);
    toast(`${arr.length} holdings imported`, 'success');
    refreshUI();
  } catch (err) { toast('Import: ' + err.message, 'error'); }
}

// === Toggles per-module : "use wealth as context" ===
import { isWealthContextEnabledFor, setWealthContextEnabled } from '../core/wealth.js';

const MODULE_TOGGLE_OPTIONS = [
  { id: 'quick-analysis',     label: '⚡ Quick Analysis',  hint: 'Verdict adapté à ton exposition existante' },
  { id: 'research-agent',     label: '🚀 Research Agent', hint: 'Recherche en contexte de ton portfolio' },
  { id: 'pre-mortem',         label: '🔥 Pre-Mortem',     hint: 'Challenge tes thèses sur ce que tu détiens' },
  { id: 'stock-screener',     label: '📊 Stock Screener', hint: 'Évite de proposer ce que tu as déjà' },
  { id: 'portfolio-rebalancer', label: '💼 Portfolio Reb.', hint: 'Pré-rempli avec ton patrimoine réel' },
  { id: 'stress-test',        label: '💥 Stress Test',    hint: 'Test ton vrai portfolio contre les régimes' },
  { id: 'tax-optimizer-fr',   label: '🇫🇷 Tax FR',          hint: 'Optimisation fiscale réelle' },
  { id: 'tax-international',  label: '🌍 Tax International', hint: 'Optimisation fiscale réelle' },
  { id: 'fire-calculator',    label: '🔥 FIRE Calc.',      hint: 'Calcul FIRE basé sur ton patrimoine actuel' },
  { id: 'investment-memo',    label: '📑 Memo',            hint: 'Memo en contexte de ton allocation' },
  { id: 'battle-mode',        label: '⚔️ Battle Mode',     hint: 'Compare en tenant compte de ton existant' },
  { id: 'watchlist',          label: '👁 Watchlist',       hint: 'Brief matinal personnalisé' }
];

function renderToggles() {
  const c = $('#wl-toggles');
  if (!c) return;
  c.innerHTML = MODULE_TOGGLE_OPTIONS.map(m => `
    <label class="wl-toggle-card">
      <input type="checkbox" data-mod="${m.id}" ${isWealthContextEnabledFor(m.id) ? 'checked' : ''} />
      <div>
        <strong>${m.label}</strong>
        <span>${m.hint}</span>
      </div>
    </label>
  `).join('');
  c.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => setWealthContextEnabled(cb.getAttribute('data-mod'), cb.checked));
  });
}
