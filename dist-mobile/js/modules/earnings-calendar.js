// Earnings Calendar — calendrier des résultats sur tes holdings (saisie manuelle + heuristiques par ticker)
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'earnings-calendar';
const STORAGE_KEY = 'alpha-terminal:earnings:dates';

// Heuristique : mois typiques de publication (Q1=avr, Q2=juil, Q3=oct, Q4=jan/fév)
function inferNextEarning(ticker) {
  const today = new Date();
  const m = today.getMonth();
  // Cycle trimestriel typique : 1er mois de chaque trimestre suivant
  const nextMonths = [1, 4, 7, 10]; // janv, avr, juil, oct
  const nextM = nextMonths.find(nm => nm > m) ?? nextMonths[0];
  const year = nextM > m ? today.getFullYear() : today.getFullYear() + 1;
  return new Date(year, nextM, 25).toISOString().slice(0, 10);
}

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  return Math.ceil((d - new Date()) / 86400000);
}

export async function renderEarningsCalendarView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.earnings-calendar.label'), t('mod.earnings-calendar.desc'), { example: t('mod.earnings-calendar.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">📅 ${isEN ? 'Upcoming earnings (your holdings)' : 'Prochains résultats (tes positions)'}</div>
      <div id="ec-list"></div>
    </div>
    <div class="card">
      <div class="card-title">✏️ ${isEN ? 'Override a date' : 'Corriger une date'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;font-size:13px;">
        <input type="text" id="ec-ticker" placeholder="${isEN ? 'Ticker' : 'Ticker'}" />
        <input type="date" id="ec-date" />
        <input type="text" id="ec-note" placeholder="${isEN ? 'Note (Q1 2026, etc.)' : 'Note (T1 2026, etc.)'}" />
        <button class="btn-primary" id="ec-save">${isEN ? 'Save' : 'Sauver'}</button>
      </div>
    </div>
  `;

  const overrides = loadOverrides();
  const wealth = await listWealth().catch(() => []);
  const holdings = wealth.filter(h => h.ticker && (h.category === 'stocks' || h.category === 'etf'));

  function refresh() {
    const items = holdings.map(h => {
      const tk = h.ticker.toUpperCase();
      const ov = overrides[tk];
      const date = ov?.date || inferNextEarning(tk);
      const note = ov?.note || (ov ? '' : (isEN ? 'inferred' : 'estimé'));
      return { ticker: tk, name: h.name, date, note, days: daysUntil(date), value: h.value, isOverride: !!ov };
    }).sort((a, b) => a.days - b.days);

    $('#ec-list', viewEl).innerHTML = items.length === 0
      ? `<div style="color:var(--text-muted);">${isEN ? 'No stocks/ETFs in your wealth.' : 'Aucune action/ETF dans ton patrimoine.'}</div>`
      : `<table style="width:100%;font-size:13px;">
          <thead><tr style="color:var(--text-muted);text-align:left;"><th>Ticker</th><th>${isEN ? 'Date' : 'Date'}</th><th>${isEN ? 'Days' : 'Jours'}</th><th>${isEN ? 'Position' : 'Position'}</th><th>${isEN ? 'Source' : 'Source'}</th></tr></thead>
          <tbody>
            ${items.map(i => `<tr><td><strong>${i.ticker}</strong> <span style="color:var(--text-muted);">${i.name || ''}</span></td><td style="font-family:var(--font-mono);">${i.date}</td><td style="font-family:var(--font-mono);color:${i.days <= 7 ? 'var(--accent-orange)' : i.days <= 30 ? 'var(--accent-green)' : 'var(--text-muted)'};">${i.days >= 0 ? 'J-' + i.days : 'J+' + (-i.days)}</td><td style="font-family:var(--font-mono);">${Math.round(i.value || 0).toLocaleString('fr-FR')} €</td><td style="font-size:11px;color:var(--text-muted);">${i.isOverride ? '✓ ' + i.note : i.note}</td></tr>`).join('')}
          </tbody>
        </table>`;
  }

  $('#ec-save', viewEl).addEventListener('click', () => {
    const tk = $('#ec-ticker', viewEl).value.toUpperCase().trim();
    const date = $('#ec-date', viewEl).value;
    const note = $('#ec-note', viewEl).value.trim();
    if (!tk || !date) return;
    overrides[tk] = { date, note };
    saveOverrides(overrides);
    refresh();
  });

  refresh();
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', refresh);
}
