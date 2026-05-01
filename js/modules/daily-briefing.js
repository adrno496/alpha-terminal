// 🌅 Daily Briefing — vue condensée du matin : pulse marché + tes positions + events + insights + watchpoints
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { listWatchpoints, detectUpcomingEvents } from '../core/watchpoints.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'daily-briefing';

function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function fmtEUR(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }

// Récupère les indices de marché via CoinGecko (crypto sans clé) + Frankfurter (FX) + fallback sur des données fictives
async function fetchMarketPulse() {
  const data = { indices: [], crypto: [], fx: [] };
  // Crypto via CoinGecko
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
    if (r.ok) {
      const j = await r.json();
      data.crypto = [
        { name: 'BTC', price: j.bitcoin?.usd, change: j.bitcoin?.usd_24h_change },
        { name: 'ETH', price: j.ethereum?.usd, change: j.ethereum?.usd_24h_change },
        { name: 'SOL', price: j.solana?.usd, change: j.solana?.usd_24h_change }
      ].filter(x => x.price);
    }
  } catch {}
  // FX via Frankfurter
  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP,JPY,CHF');
    if (r.ok) {
      const j = await r.json();
      data.fx = [
        { name: 'EUR/USD', price: 1 / (j.rates?.USD || 1) },
        { name: 'EUR/GBP', price: j.rates?.GBP },
        { name: 'EUR/JPY', price: j.rates?.JPY },
        { name: 'EUR/CHF', price: j.rates?.CHF }
      ].filter(x => x.price);
    }
  } catch {}
  return data;
}

export async function renderDailyBriefingView(viewEl) {
  const isEN = getLocale() === 'en';
  const now = new Date();
  const dateStr = now.toLocaleDateString(isEN ? 'en-US' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? (isEN ? '☀️ Good morning' : '☀️ Bonjour') :
                   now.getHours() < 18 ? (isEN ? '🌤️ Good afternoon' : '🌤️ Bon après-midi') :
                                          (isEN ? '🌙 Good evening' : '🌙 Bonsoir');

  viewEl.innerHTML = `
    ${moduleHeader('🌅 ' + t('mod.daily-briefing.label'), t('mod.daily-briefing.desc'), { moduleId: MODULE_ID })}
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;">
        <h2 style="margin:0;font-size:22px;">${greeting}</h2>
        <span style="color:var(--text-muted);font-size:13px;">${dateStr}</span>
      </div>
    </div>
    <div id="db-pulse" class="card"><div style="color:var(--text-muted);">${isEN ? 'Loading market pulse...' : 'Chargement du pulse marché...'}</div></div>
    <div id="db-portfolio" class="card"></div>
    <div id="db-events" class="card"></div>
    <div id="db-watchpoints" class="card"></div>
    <div id="db-insights" class="card"></div>
  `;

  // 1. Market pulse
  fetchMarketPulse().then(p => {
    const pulse = $('#db-pulse');
    const renderRow = (items) => items.map(x => `
      <div style="background:var(--bg-tertiary);padding:8px 12px;border-radius:6px;text-align:center;min-width:80px;">
        <div style="font-size:11px;color:var(--text-muted);">${x.name}</div>
        <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;">${x.price?.toFixed(2) ?? '—'}</div>
        ${x.change != null ? `<div style="font-size:11px;color:${x.change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(x.change)}</div>` : ''}
      </div>
    `).join('');
    pulse.innerHTML = `
      <div class="card-title">🌐 ${isEN ? 'Market pulse' : 'Pulse marché'}</div>
      ${p.crypto.length ? `<div style="margin-bottom:10px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">Crypto</div><div style="display:flex;gap:8px;flex-wrap:wrap;">${renderRow(p.crypto)}</div></div>` : ''}
      ${p.fx.length    ? `<div style="margin-bottom:10px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">FX</div><div style="display:flex;gap:8px;flex-wrap:wrap;">${renderRow(p.fx)}</div></div>` : ''}
      <div style="font-size:11px;color:var(--text-muted);">
        ${isEN ? 'Sources: CoinGecko (crypto, no key) · Frankfurter (FX, no key). Add FMP/Polygon keys for stock indices live.' : 'Sources : CoinGecko (crypto, sans clé) · Frankfurter (FX, sans clé). Ajoute clés FMP/Polygon pour indices boursiers live.'}
      </div>
    `;
  });

  // 2. Portfolio snapshot
  listWealth().then(holdings => {
    const total = holdings.reduce((s, h) => s + (h.value || 0), 0);
    const top = holdings.filter(h => h.value).sort((a, b) => b.value - a.value).slice(0, 5);
    $('#db-portfolio').innerHTML = `
      <div class="card-title">💼 ${isEN ? 'Your portfolio' : 'Ton patrimoine'}</div>
      <div style="font-size:24px;font-weight:700;font-family:var(--font-mono);">${fmtEUR(total)}</div>
      <div style="color:var(--text-muted);font-size:12px;margin-bottom:10px;">${holdings.length} ${isEN ? 'positions' : 'positions'}</div>
      ${top.length > 0 ? `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${isEN ? 'Top 5 holdings' : 'Top 5 positions'} :</div>
        ${top.map(h => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>${h.ticker || h.name}</span><span style="font-family:var(--font-mono);">${fmtEUR(h.value || 0)} (${total > 0 ? ((h.value/total)*100).toFixed(1) : 0}%)</span></div>`).join('')}
      ` : `<div style="color:var(--text-muted);">${isEN ? 'No holdings. Add some in Patrimoine.' : 'Aucune position. Ajoute-en dans Patrimoine.'}</div>`}
    `;
  });

  // 3. Upcoming events (watchpoints type ipo/event + earnings calendar inferred)
  detectUpcomingEvents(14).then(evts => {
    const c = $('#db-events');
    if (!evts.length) {
      c.innerHTML = `
        <div class="card-title">📅 ${isEN ? 'Upcoming events (14 days)' : 'Événements à venir (14 jours)'}</div>
        <div style="color:var(--text-muted);font-size:13px;">${isEN ? 'No event tracked. Add IPOs / earnings dates in Watchpoints.' : 'Aucun événement. Ajoute IPO / earnings dans Watchpoints.'}</div>`;
      return;
    }
    c.innerHTML = `
      <div class="card-title">📅 ${isEN ? 'Upcoming events (14 days)' : 'Événements à venir (14 jours)'}</div>
      ${evts.map(({ watchpoint: w, daysUntil }) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;">
          <div>
            <strong>${w.ticker || ''}</strong> · ${w.note || w.type}
            ${w.target ? ` <span style="color:var(--text-muted);">cible ${w.target}</span>` : ''}
          </div>
          <div style="font-family:var(--font-mono);color:${daysUntil <= 1 ? 'var(--accent-orange)' : daysUntil <= 7 ? 'var(--accent-amber)' : 'var(--text-muted)'};">${daysUntil === 0 ? (isEN ? 'TODAY' : 'AUJOURD\\u2019HUI') : 'J-' + daysUntil}</div>
        </div>
      `).join('')}
    `;
  });

  // 4. Active watchpoints summary
  listWatchpoints({ status: 'active' }).then(wps => {
    $('#db-watchpoints').innerHTML = `
      <div class="card-title">📌 ${isEN ? 'Active watchpoints' : 'Surveillance active'}</div>
      ${wps.length === 0
        ? `<div style="color:var(--text-muted);font-size:13px;">${isEN ? 'No active watchpoint.' : 'Aucun point actif.'} <a href="#watchpoints">${isEN ? 'Add one →' : 'Ajouter →'}</a></div>`
        : `<div style="font-size:13px;color:var(--text-secondary);">${wps.length} ${isEN ? 'point(s) currently scanned across all your modules' : 'point(s) scanné(s) en continu sur tous tes modules'}</div>
           <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
             ${wps.slice(0, 8).map(w => `<span style="padding:4px 10px;background:var(--bg-tertiary);border-radius:12px;font-size:12px;">${w.ticker || '—'}: ${w.target || w.eventDate || '?'}</span>`).join('')}
             ${wps.length > 8 ? `<a href="#watchpoints" style="padding:4px 10px;font-size:12px;">+${wps.length - 8} ${isEN ? 'more' : 'autres'}</a>` : ''}
           </div>`}
    `;
  });

  // 5. Daily insight (placeholder)
  $('#db-insights').innerHTML = `
    <div class="card-title">💡 ${isEN ? 'Today\\u2019s insight' : 'Insight du jour'}</div>
    <p style="font-size:13px;color:var(--text-secondary);">${isEN
      ? 'Open <a href="#insights-engine">Insights</a> for a fresh AI-generated review of your portfolio (uses 1 LLM call/week).'
      : 'Ouvre <a href="#insights-engine">Insights</a> pour une revue IA fraîche de ton portefeuille (1 appel LLM/semaine).'}</p>
  `;
}
