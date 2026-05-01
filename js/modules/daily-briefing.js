// 🌅 Daily Briefing — vue condensée du matin : pulse marché + tes positions + events + insights + watchpoints
import { $, toast, escHtml } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { listWatchpoints, detectUpcomingEvents, saveWatchpoint } from '../core/watchpoints.js';
import { moduleHeader, runAnalysis } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { isConnected } from '../core/api.js';

const MODULE_ID = 'daily-briefing';

function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function fmtEUR(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }

// Watchlist Pulse personnalisable — l'utilisateur définit les cryptos / paires FX
// qu'il veut voir tous les jours. Persisté en localStorage pour survivre aux reloads.
const PULSE_WATCH_KEY = 'alpha-terminal:pulse-watchlist';
const PULSE_DEFAULTS = { crypto: ['bitcoin', 'ethereum', 'solana'], fx: ['USD', 'GBP', 'JPY', 'CHF'] };

export function getPulseWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(PULSE_WATCH_KEY) || 'null');
    return raw && typeof raw === 'object'
      ? { crypto: Array.isArray(raw.crypto) ? raw.crypto : PULSE_DEFAULTS.crypto, fx: Array.isArray(raw.fx) ? raw.fx : PULSE_DEFAULTS.fx }
      : { ...PULSE_DEFAULTS };
  } catch { return { ...PULSE_DEFAULTS }; }
}
export function setPulseWatchlist(wl) {
  localStorage.setItem(PULSE_WATCH_KEY, JSON.stringify(wl));
}

// Récupère les indices de marché via CoinGecko (crypto sans clé) + Frankfurter (FX)
async function fetchMarketPulse() {
  const wl = getPulseWatchlist();
  const data = { indices: [], crypto: [], fx: [] };
  // Crypto via CoinGecko — IDs CoinGecko (bitcoin, ethereum, solana, etc.)
  try {
    const ids = wl.crypto.join(',');
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&price_change_percentage=24h`);
    if (r.ok) {
      const list = await r.json();
      data.crypto = list.map(c => ({ name: c.symbol.toUpperCase(), price: c.current_price, change: c.price_change_percentage_24h }));
    }
  } catch {}
  // FX via Frankfurter — codes ISO (USD, GBP, JPY, CHF, …)
  try {
    const targets = wl.fx.filter(c => c && c !== 'EUR').join(',');
    if (targets) {
      const r = await fetch(`https://api.frankfurter.dev/v1/latest?from=EUR&to=${encodeURIComponent(targets)}`);
      if (r.ok) {
        const j = await r.json();
        data.fx = wl.fx.filter(c => c && c !== 'EUR').map(cur => ({
          name: 'EUR/' + cur,
          price: j.rates?.[cur]
        })).filter(x => x.price);
      }
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

  // 1. Market pulse + bouton "personnaliser"
  const renderPulse = () => fetchMarketPulse().then(p => {
    const pulse = $('#db-pulse');
    const renderRow = (items) => items.map(x => `
      <div style="background:var(--bg-tertiary);padding:8px 12px;border-radius:6px;text-align:center;min-width:80px;">
        <div style="font-size:11px;color:var(--text-muted);">${x.name}</div>
        <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;">${x.price?.toFixed(2) ?? '—'}</div>
        ${x.change != null ? `<div style="font-size:11px;color:${x.change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmtPct(x.change)}</div>` : ''}
      </div>
    `).join('');
    pulse.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="card-title" style="margin:0;">🌐 ${isEN ? 'Market pulse' : 'Pulse marché'}</div>
        <button id="db-pulse-customize" class="btn-ghost" style="font-size:11px;">⚙️ ${isEN ? 'Customize' : 'Personnaliser'}</button>
      </div>
      ${p.crypto.length ? `<div style="margin-bottom:10px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">Crypto</div><div style="display:flex;gap:8px;flex-wrap:wrap;">${renderRow(p.crypto)}</div></div>` : ''}
      ${p.fx.length    ? `<div style="margin-bottom:10px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">FX</div><div style="display:flex;gap:8px;flex-wrap:wrap;">${renderRow(p.fx)}</div></div>` : ''}
      <div style="font-size:11px;color:var(--text-muted);">
        ${isEN ? 'Sources: CoinGecko (crypto) · Frankfurter (FX). Both free, no key.' : 'Sources : CoinGecko (crypto) · Frankfurter (FX). Sans clé.'}
      </div>
    `;
    $('#db-pulse-customize').addEventListener('click', () => openPulseCustomizer(renderPulse, isEN));
  });
  renderPulse();

  // 2. Portfolio — TOUTES les lignes + bouton "Analyser cette ligne" par holding
  listWealth().then(holdings => {
    const total = holdings.reduce((s, h) => s + (h.value || 0), 0);
    const sorted = holdings.filter(h => h.value || h.quantity).sort((a, b) => (b.value || 0) - (a.value || 0));
    $('#db-portfolio').innerHTML = `
      <div class="card-title">💼 ${isEN ? 'Your portfolio' : 'Ton patrimoine'}</div>
      <div style="font-size:24px;font-weight:700;font-family:var(--font-mono);">${fmtEUR(total)}</div>
      <div style="color:var(--text-muted);font-size:12px;margin-bottom:10px;">${holdings.length} ${isEN ? 'positions' : 'positions'}</div>
      ${sorted.length > 0 ? `
        <div style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;">
          <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
            <thead style="position:sticky;top:0;background:var(--bg-secondary);">
              <tr style="border-bottom:1px solid var(--border);">
                <th style="text-align:left;padding:8px;font-weight:600;color:var(--text-muted);">${isEN ? 'Asset' : 'Actif'}</th>
                <th style="text-align:right;padding:8px;font-weight:600;color:var(--text-muted);">${isEN ? 'Value' : 'Valeur'}</th>
                <th style="text-align:right;padding:8px;font-weight:600;color:var(--text-muted);">%</th>
                <th style="text-align:right;padding:8px;font-weight:600;color:var(--text-muted);">${isEN ? 'Action' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((h, idx) => `
                <tr style="border-bottom:1px dashed var(--border);">
                  <td style="padding:6px 8px;">
                    <strong>${escHtml(h.ticker || h.name || '?')}</strong>
                    ${h.ticker && h.name && h.ticker !== h.name ? `<span style="color:var(--text-muted);font-size:11px;"> · ${escHtml(h.name)}</span>` : ''}
                    <span style="color:var(--text-muted);font-size:10px;display:block;">${h.category || ''}${h.account ? ' · ' + escHtml(h.account) : ''}</span>
                  </td>
                  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);">${fmtEUR(h.value || 0)}</td>
                  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);color:var(--text-muted);">${total > 0 ? ((h.value || 0) / total * 100).toFixed(1) : 0}%</td>
                  <td style="padding:6px 8px;text-align:right;">
                    <button class="btn-ghost db-analyze-line" data-idx="${idx}" style="font-size:11px;padding:3px 8px;" ${!isConnected() ? 'disabled title="Vault locked"' : ''}>🔎 ${isEN ? 'Analyse' : 'Analyser'}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div style="color:var(--text-muted);">${isEN ? 'No holdings. Add some in Patrimoine.' : 'Aucune position. Ajoute-en dans Patrimoine.'}</div>`}
      <div id="db-analyze-output" style="margin-top:10px;"></div>
    `;
    // Wire les boutons d'analyse par ligne
    $('#db-portfolio').querySelectorAll('.db-analyze-line').forEach(btn => {
      btn.addEventListener('click', () => analyseHolding(sorted[+btn.dataset.idx], $('#db-analyze-output'), isEN));
    });
  });

  // 3. Upcoming events (watchpoints type ipo/event + bouton recherche LLM)
  const renderEvents = () => detectUpcomingEvents(14).then(evts => {
    const c = $('#db-events');
    const header = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="card-title" style="margin:0;">📅 ${isEN ? 'Upcoming events (14 days)' : 'Événements à venir (14 jours)'}</div>
        <button id="db-search-events" class="btn-ghost" style="font-size:11px;" ${!isConnected() ? 'disabled title="Vault locked"' : ''}>🔍 ${isEN ? 'Search & save events' : 'Rechercher & sauvegarder'}</button>
      </div>
    `;
    if (!evts.length) {
      c.innerHTML = `${header}
        <div style="color:var(--text-muted);font-size:13px;">${isEN ? 'No event tracked. Click "Search" above to find earnings/IPOs/macro events for the next 14 days based on your portfolio.' : 'Aucun événement. Clique "Rechercher" pour trouver earnings/IPO/événements macro des 14 prochains jours selon ton portefeuille.'}</div>`;
    } else {
      c.innerHTML = `${header}
        ${evts.map(({ watchpoint: w, daysUntil }) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;">
            <div>
              <strong>${escHtml(w.ticker || '')}</strong> · ${escHtml(w.note || w.type)}
              ${w.target ? ` <span style="color:var(--text-muted);">cible ${escHtml(String(w.target))}</span>` : ''}
            </div>
            <div style="font-family:var(--font-mono);color:${daysUntil <= 1 ? 'var(--accent-orange)' : daysUntil <= 7 ? 'var(--accent-amber)' : 'var(--text-muted)'};">${daysUntil === 0 ? (isEN ? 'TODAY' : 'AUJOURD’HUI') : 'J-' + daysUntil}</div>
          </div>
        `).join('')}
      `;
    }
    $('#db-search-events').addEventListener('click', () => searchAndSaveEvents(c, isEN, renderEvents));
  });
  renderEvents();

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

// ─── Helpers : analyse par ligne / recherche événements / customizer Pulse ───

async function analyseHolding(h, container, isEN) {
  if (!h) return;
  if (!isConnected()) { toast(isEN ? 'Vault locked — unlock first' : 'Vault verrouillé — déverrouille d\'abord', 'warning'); return; }
  const tag = h.ticker || h.name;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const userMsg = `Quick check sur **${tag}** (${h.category || '?'}, valeur actuelle ${(h.value||0).toLocaleString('fr-FR')} ${h.currency || 'EUR'}, quantité ${h.quantity || '?'}${h.account ? ', compte ' + h.account : ''}).

Donne-moi en moins de 200 mots :
1. **Dernières news majeures** (7 derniers jours) avec dates précises
2. **Mouvement de prix** notable (24h / 7j / 1m)
3. **Risques immédiats** ou catalyseurs à surveiller
4. **Verdict express** : HOLD / RENFORCER / ALLÉGER / VENDRE — 1 phrase justification

Si pas d'info récente fiable, dis-le explicitement plutôt que d'inventer.`;
  try {
    await runAnalysis('quick-analysis', {
      system: 'Tu es un analyste financier qui donne des updates très courts et actionables sur des positions de portefeuille. Privilégie les faits récents vérifiables.',
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 800,
      useWebSearch: true,
      recordInput: { ticker: tag, category: h.category, source: 'daily-briefing-line' }
    }, container, { onTitle: () => `📊 ${tag} · daily check`, suggestFollowUps: false });
  } catch (e) { console.error('[daily-briefing] analyse line failed:', e); }
}

async function searchAndSaveEvents(container, isEN, refreshAfter) {
  if (!isConnected()) { toast(isEN ? 'Vault locked — unlock first' : 'Vault verrouillé', 'warning'); return; }
  const holdings = await listWealth();
  const tickers = [...new Set(holdings.filter(h => h.ticker).map(h => h.ticker))].slice(0, 30);
  if (!tickers.length) { toast(isEN ? 'No tickers in your portfolio' : 'Aucun ticker dans ton patrimoine', 'warning'); return; }

  const status = document.createElement('div');
  status.style.cssText = 'margin-top:10px;padding:8px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;';
  status.textContent = isEN ? '🔍 Searching events…' : '🔍 Recherche en cours…';
  container.appendChild(status);

  const userMsg = `Recherche les événements financiers à venir dans les 14 prochains jours pour ces tickers :

${tickers.join(', ')}

Inclus : earnings dates (résultats trimestriels), ex-dividend dates, AGM, capital markets days, IPO confirmées.

Réponds STRICTEMENT en JSON valide (pas de markdown, pas de texte autour) au format :
{
  "events": [
    { "ticker": "AAPL", "type": "earnings", "date": "2026-05-12", "note": "Q2 FY26 earnings, after close", "importance": "high" },
    { "ticker": "MSFT", "type": "ex_dividend", "date": "2026-05-08", "note": "Ex-div $0.83/share", "importance": "medium" }
  ]
}

Type accepté : earnings, ex_dividend, agm, capital_markets_day, ipo, regulatory.
Date au format YYYY-MM-DD.
Importance : high/medium/low.
Si aucun événement trouvé, retourne {"events": []}.`;

  // Use temporary in-memory container to capture the LLM output without replacing the events list
  const tmp = document.createElement('div');
  tmp.style.display = 'none';
  container.appendChild(tmp);
  try {
    const result = await runAnalysis('research-agent', {
      system: 'Tu es un agent de recherche financière qui retourne UNIQUEMENT du JSON valide. Aucun texte, aucun markdown, aucun commentaire — juste l\'objet JSON.',
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 2500,
      useWebSearch: true,
      recordInput: { source: 'daily-briefing-events', tickers: tickers.join(',') }
    }, tmp, { suggestFollowUps: false });
    if (!result || !result.text) throw new Error('Empty response');

    // Parse JSON robuste (extrait le premier {...})
    let parsed;
    try { parsed = JSON.parse(result.text); }
    catch {
      const m = result.text.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
    if (!parsed || !Array.isArray(parsed.events)) throw new Error('Invalid JSON');

    let saved = 0;
    for (const ev of parsed.events) {
      if (!ev.ticker || !ev.date) continue;
      await saveWatchpoint({
        ticker: String(ev.ticker).toUpperCase(),
        type: ev.type === 'ipo' ? 'ipo' : 'event',
        eventDate: ev.date,
        note: `${ev.type || 'event'} · ${ev.note || ''}`.trim(),
        importance: ev.importance || 'medium',
        source: 'daily-briefing-search',
        status: 'active'
      });
      saved++;
    }
    tmp.remove();
    status.innerHTML = `✓ ${saved} ${isEN ? 'event(s) saved to Watchpoints' : 'événement(s) sauvés dans Watchpoints'}`;
    setTimeout(() => { status.remove(); refreshAfter(); }, 1500);
    toast(isEN ? `${saved} events saved` : `${saved} événements sauvés`, 'success');
  } catch (e) {
    tmp.remove();
    console.error('[daily-briefing] search events failed:', e);
    status.innerHTML = `<span style="color:var(--accent-red);">✗ ${e.message}</span>`;
    setTimeout(() => status.remove(), 4000);
  }
}

function openPulseCustomizer(refreshPulse, isEN) {
  const wl = getPulseWatchlist();
  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10006;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>⚙️ ${isEN ? 'Customize Market Pulse' : 'Personnaliser le Pulse marché'}</strong>
        <button class="btn-ghost" id="pc-close">×</button>
      </div>
      <div class="field">
        <label class="field-label">${isEN ? 'Crypto IDs (CoinGecko, comma-separated)' : 'IDs crypto (CoinGecko, séparés par virgules)'}</label>
        <input id="pc-crypto" class="input" type="text" value="${escHtml(wl.crypto.join(','))}" placeholder="bitcoin,ethereum,solana,cardano,…" />
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px;">${isEN ? 'Use full CoinGecko IDs (lowercase). Find them on coingecko.com/coins.' : 'Utilise les IDs CoinGecko complets (minuscules). Trouve-les sur coingecko.com/coins.'}</div>
      </div>
      <div class="field">
        <label class="field-label">${isEN ? 'FX target currencies (ISO codes vs EUR, comma-separated)' : 'Devises FX cibles (codes ISO vs EUR, séparés par virgules)'}</label>
        <input id="pc-fx" class="input" type="text" value="${escHtml(wl.fx.join(','))}" placeholder="USD,GBP,JPY,CHF,CAD,AUD,…" />
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn-secondary" id="pc-reset">${isEN ? 'Reset defaults' : 'Réinitialiser'}</button>
        <button class="btn-primary" id="pc-save">${isEN ? 'Save & refresh' : 'Sauvegarder'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(w);
  const close = () => { try { document.body.removeChild(w); } catch {} };
  w.addEventListener('click', e => { if (e.target === w) close(); });
  w.querySelector('#pc-close').addEventListener('click', close);
  w.querySelector('#pc-reset').addEventListener('click', () => {
    setPulseWatchlist({ crypto: ['bitcoin', 'ethereum', 'solana'], fx: ['USD', 'GBP', 'JPY', 'CHF'] });
    close();
    refreshPulse();
  });
  w.querySelector('#pc-save').addEventListener('click', () => {
    const crypto = w.querySelector('#pc-crypto').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const fx = w.querySelector('#pc-fx').value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    setPulseWatchlist({ crypto, fx });
    close();
    refreshPulse();
  });
}
