// Macro Events Calendar — Fed/ECB/CPI/NFP/elections (saisie manuelle + dates clés récurrentes 2026)
import { $ } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'macro-events-calendar';

// Calendrier 2026 connu / récurrent (à mettre à jour annuellement)
const RECURRING_2026 = [
  { date: '2026-01-29', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: 'Réunion Fed' },
  { date: '2026-03-12', event: 'ECB Rate Decision', impact: 'high', region: 'EU', note: 'Réunion BCE' },
  { date: '2026-03-19', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  { date: '2026-04-30', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  { date: '2026-05-08', event: 'NFP (Non-Farm Payrolls)', impact: 'medium', region: 'US', note: '1er vendredi du mois' },
  { date: '2026-06-04', event: 'ECB Rate Decision', impact: 'high', region: 'EU', note: '' },
  { date: '2026-06-18', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  { date: '2026-07-30', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  { date: '2026-09-17', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  { date: '2026-10-29', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  { date: '2026-12-10', event: 'ECB Rate Decision', impact: 'high', region: 'EU', note: '' },
  { date: '2026-12-17', event: 'FOMC Rate Decision', impact: 'high', region: 'US', note: '' },
  // CPI mensuel ~ mid-month
  { date: '2026-01-13', event: 'US CPI', impact: 'high', region: 'US', note: 'Inflation US' },
  { date: '2026-02-12', event: 'US CPI', impact: 'high', region: 'US', note: '' },
  { date: '2026-03-12', event: 'US CPI', impact: 'high', region: 'US', note: '' },
  { date: '2026-04-15', event: 'US CPI', impact: 'high', region: 'US', note: '' },
  { date: '2026-05-13', event: 'US CPI', impact: 'high', region: 'US', note: '' },
];

const STORAGE_KEY = 'alpha-terminal:macro:custom';
function loadCustom() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveCustom(l) { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)); }

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

export function renderMacroEventsCalendarView(viewEl) {
  const isEN = getLocale() === 'en';
  let custom = loadCustom();

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.macro-events-calendar.label'), t('mod.macro-events-calendar.desc'), { example: '', moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">📅 ${isEN ? 'Upcoming events (next 90 days)' : 'Événements à venir (90 jours)'}</div>
      <div id="me-list"></div>
    </div>
    <div class="card">
      <div class="card-title">➕ ${isEN ? 'Add a custom event' : 'Ajouter un événement personnalisé'}</div>
      <div style="display:grid;grid-template-columns:1fr 2fr 1fr 1fr auto;gap:8px;font-size:13px;">
        <input type="date" id="me-date" />
        <input type="text" id="me-event" placeholder="${isEN ? 'Event description' : 'Description'}" />
        <select id="me-impact"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <select id="me-region"><option value="US">US</option><option value="EU">EU</option><option value="FR">FR</option><option value="ASIA">ASIA</option><option value="GLOBAL">Global</option></select>
        <button class="btn-primary" id="me-save">${isEN ? 'Add' : 'Ajouter'}</button>
      </div>
    </div>
  `;

  function refresh() {
    const all = [...RECURRING_2026, ...custom]
      .map(e => ({ ...e, days: daysUntil(e.date) }))
      .filter(e => e.days >= 0 && e.days <= 90)
      .sort((a, b) => a.days - b.days);

    $('#me-list', viewEl).innerHTML = all.length === 0
      ? `<div style="color:var(--text-muted);">${isEN ? 'No event in the next 90 days.' : 'Aucun événement dans les 90 prochains jours.'}</div>`
      : `<table style="width:100%;font-size:13px;">
          <thead><tr style="color:var(--text-muted);text-align:left;"><th>${isEN ? 'Date' : 'Date'}</th><th>${isEN ? 'Days' : 'Jours'}</th><th>${isEN ? 'Event' : 'Événement'}</th><th>${isEN ? 'Region' : 'Région'}</th><th>Impact</th></tr></thead>
          <tbody>
            ${all.map(e => `<tr><td style="font-family:var(--font-mono);">${e.date}</td><td style="font-family:var(--font-mono);color:${e.days <= 7 ? 'var(--accent-orange)' : 'var(--text-muted)'};">J-${e.days}</td><td><strong>${e.event}</strong>${e.note ? ` <span style="color:var(--text-muted);font-size:11px;">— ${e.note}</span>` : ''}</td><td>${e.region}</td><td><span style="padding:2px 8px;border-radius:10px;background:${e.impact === 'high' ? 'var(--accent-red)' : e.impact === 'medium' ? 'var(--accent-orange)' : 'var(--text-muted)'};color:#000;font-size:11px;">${e.impact}</span></td></tr>`).join('')}
          </tbody>
        </table>`;
  }

  $('#me-save', viewEl).addEventListener('click', () => {
    const ev = { date: $('#me-date', viewEl).value, event: $('#me-event', viewEl).value.trim(), impact: $('#me-impact', viewEl).value, region: $('#me-region', viewEl).value, note: '' };
    if (!ev.date || !ev.event) return;
    custom.push(ev);
    saveCustom(custom);
    $('#me-event', viewEl).value = '';
    refresh();
  });

  refresh();
}
