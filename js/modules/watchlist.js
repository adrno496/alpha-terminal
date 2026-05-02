// Module Watchlist + Daily Brief — auto-fetch quote/news pour chaque ticker via APIs
import { $, toast, fmtRelative } from '../core/utils.js';
import { SYSTEM_WATCHLIST_BRIEF } from '../prompts/watchlist.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';
import { getDataKey } from '../core/data-keys.js';

const MODULE_ID = 'watchlist';
const KEY = 'alpha-terminal:watchlist';

function loadList() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function saveList(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

export function renderWatchlistView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.watchlist.label'), t('mod.watchlist.desc'), { moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.watchlist.title')}</div>
      <div class="field-row">
        <div class="field"><label class="field-label">${t('mod.watchlist.add_ticker')}</label><input id="wl-input" class="input" placeholder="NVDA, BTC, MC.PA..." /></div>
        <div class="field" style="align-self:end;"><button id="wl-add" class="btn-primary">${t('common.add')}</button></div>
      </div>
      <div id="wl-list" style="margin-top:12px;"></div>
    </div>
    <div class="card">
      <div class="card-title">${t('mod.watchlist.brief_title')}</div>
      <div class="qa-mode-tabs" style="margin-bottom:14px;">
        <button class="qa-tab active" data-source="watchlist">👁 Watchlist</button>
        <button class="qa-tab" data-source="portfolio">💼 Mon portefeuille</button>
        <button class="qa-tab" data-source="both">⚡ Watchlist + Portefeuille</button>
      </div>
      <p style="color:var(--text-secondary);font-size:12.5px;margin-bottom:10px;">
        Auto-fetch quote (24h move) + news des dernières 24h via Finnhub / Polygon / Tiingo si clé configurée. Mode "portefeuille" injecte aussi ton allocation pour un brief personnalisé.
      </p>
      <div id="wl-source-info" class="alert alert-info" style="margin-bottom:10px;font-size:12px;"></div>
      <div class="field"><label class="field-label">${t('common.notes_context')}</label><textarea id="wl-ctx" class="textarea" rows="2"></textarea></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
          <input type="checkbox" id="wl-use-data" checked /> 📡 Use data APIs (faster + cheaper)
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
          <input type="checkbox" id="wl-use-web" /> 🌐 + Web search (extra cost)
        </label>
      </div>
      <button id="wl-brief" class="btn-primary">${t('mod.watchlist.run')}</button>
    </div>
    <div id="wl-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  drawList();
  $('#wl-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTicker(); });
  $('#wl-add').addEventListener('click', addTicker);
  $('#wl-brief').addEventListener('click', generateBrief);

  // Mode tabs
  viewEl.querySelectorAll('.qa-tab[data-source]').forEach(b => b.addEventListener('click', async () => {
    viewEl.querySelectorAll('.qa-tab[data-source]').forEach(x => x.classList.toggle('active', x === b));
    await refreshSourceInfo();
  }));
  refreshSourceInfo();
}

function getActiveSource() {
  const active = document.querySelector('.qa-tab[data-source].active');
  return active?.getAttribute('data-source') || 'watchlist';
}

async function refreshSourceInfo() {
  const info = $('#wl-source-info');
  if (!info) return;
  const source = getActiveSource();
  const wl = loadList();
  let pf = [];
  try {
    const { listWealth } = await import('../core/wealth.js');
    const all = await listWealth();
    pf = all.filter(h => h.ticker && h.category !== 'cash' && h.category !== 'real_estate');
  } catch {}
  if (source === 'watchlist') {
    info.innerHTML = `📋 <strong>${wl.length} tickers</strong> dans la watchlist : ${wl.join(', ') || '(vide)'}`;
  } else if (source === 'portfolio') {
    info.innerHTML = `💼 <strong>${pf.length} positions tickerisées</strong> dans ton patrimoine${pf.length ? ' : ' + pf.map(h => h.ticker).join(', ') : ' (ajoute des holdings avec ticker dans Patrimoine)'}`;
  } else {
    const merged = [...new Set([...wl, ...pf.map(h => h.ticker)])];
    info.innerHTML = `⚡ <strong>${merged.length} tickers combinés</strong> (watchlist + patrimoine)`;
  }
}

function drawList() {
  const list = loadList();
  const html = list.length === 0
    ? `<div class="alert alert-info">${t('mod.watchlist.empty')}</div>`
    : `<div style="display:flex;flex-wrap:wrap;gap:6px;">${list.map(tk => `<span class="watch-pill">${tk} <button data-rm="${tk}" aria-label="Retirer ${tk}">×</button></span>`).join('')}</div>`;
  $('#wl-list').innerHTML = html;
  $('#wl-list').querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
    saveList(loadList().filter(t => t !== b.getAttribute('data-rm')));
    drawList();
  }));
}

function addTicker() {
  const v = $('#wl-input').value.trim().toUpperCase();
  if (!v) return;
  const list = loadList();
  if (list.includes(v)) { toast('Already in watchlist', 'warning'); return; }
  list.push(v);
  saveList(list);
  $('#wl-input').value = '';
  drawList();
}

// Détecte si un ticker est crypto
function isCrypto(tk) {
  return /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|DOT|AVAX|LINK|MATIC|UNI|ATOM|NEAR|SUI|APT|TON|TRX|SHIB|PEPE|TIA|AAVE)$/i.test(tk);
}

// Fetch quote + news pour un ticker via fallback chain
async function fetchTickerData(ticker) {
  const tk = ticker.toUpperCase();
  const result = { ticker: tk, quote: null, news: [] };

  if (isCrypto(tk)) {
    try {
      const { fetchCoinData } = await import('../core/coingecko.js');
      const cg = await fetchCoinData(tk);
      if (cg) {
        result.quote = {
          price: cg.price_usd,
          change_24h_pct: cg.price_change_24h_pct,
          change_7d_pct: cg.price_change_7d_pct,
          market_cap: cg.market_cap_usd
        };
      }
    } catch {}
    return result;
  }

  // Stock — fallback chain pour quote
  if (!result.quote && getDataKey('fmp')) {
    try { const { fmpQuote } = await import('../core/data-providers/fmp.js'); const q = await fmpQuote(tk); if (q) result.quote = { price: q.price, change_24h_pct: q.change_pct, market_cap: q.market_cap }; } catch {}
  }
  if (!result.quote && getDataKey('finnhub')) {
    try { const { finnhubQuote } = await import('../core/data-providers/finnhub.js'); const q = await finnhubQuote(tk); if (q) result.quote = { price: q.price, change_24h_pct: q.change_pct }; } catch {}
  }
  if (!result.quote && getDataKey('polygon')) {
    try { const { polygonPrevClose } = await import('../core/data-providers/polygon.js'); const q = await polygonPrevClose(tk); if (q) result.quote = { price: q.close, change_24h_pct: q.change_pct }; } catch {}
  }
  if (!result.quote && getDataKey('twelvedata')) {
    try { const { tdQuote } = await import('../core/data-providers/twelvedata.js'); const q = await tdQuote(tk); if (q) result.quote = { price: q.price, change_24h_pct: q.change_pct }; } catch {}
  }

  // News — Finnhub > Polygon > Tiingo
  if (getDataKey('finnhub')) {
    try { const { finnhubNews } = await import('../core/data-providers/finnhub.js'); result.news = await finnhubNews(tk, 1); } catch {}
  }
  if (!result.news.length && getDataKey('polygon')) {
    try { const { polygonNews } = await import('../core/data-providers/polygon.js'); result.news = await polygonNews(tk, 3); } catch {}
  }
  if (!result.news.length && getDataKey('tiingo')) {
    try { const { tiingoNews } = await import('../core/data-providers/tiingo.js'); result.news = await tiingoNews(tk, 3); } catch {}
  }

  return result;
}

async function generateBrief() {
  const out = $('#wl-output');
  const source = getActiveSource();
  const ctx = $('#wl-ctx').value.trim();
  const useData = $('#wl-use-data').checked;
  const useWeb = $('#wl-use-web').checked;

  // Build ticker list selon la source
  const watchTickers = loadList();
  let portfolioHoldings = [];
  try {
    const { listWealth, getTotals, buildWealthContext } = await import('../core/wealth.js');
    const all = await listWealth();
    portfolioHoldings = all.filter(h => h.ticker && h.category !== 'cash' && h.category !== 'real_estate');
  } catch {}

  let tickers = [];
  let sourceLabel = '';
  if (source === 'watchlist') {
    tickers = watchTickers;
    sourceLabel = 'Watchlist';
  } else if (source === 'portfolio') {
    tickers = portfolioHoldings.map(h => h.ticker);
    sourceLabel = 'Portefeuille';
  } else {
    tickers = [...new Set([...watchTickers, ...portfolioHoldings.map(h => h.ticker)])];
    sourceLabel = 'Watchlist + Portefeuille';
  }

  if (!tickers.length) {
    out.innerHTML = `<div class="alert alert-danger">${source === 'portfolio' ? 'Aucune position avec ticker dans ton patrimoine. Ajoute-en dans 💼 Patrimoine.' : 'Liste vide.'}</div>`;
    return;
  }

  // Pré-fetch data par ticker
  let dataBlock = '';
  if (useData) {
    out.innerHTML = `<div class="loading"><span class="spinner"></span> <span>Fetching data for ${tickers.length} tickers (${sourceLabel})…</span></div>`;
    const results = [];
    for (let i = 0; i < tickers.length; i++) {
      try {
        const r = await fetchTickerData(tickers[i]);
        // Si c'est une position du portefeuille, ajoute la valeur détenue + impact %
        const holding = portfolioHoldings.find(h => h.ticker === tickers[i]);
        if (holding) {
          r.holding = {
            quantity: holding.quantity,
            value: holding.value,
            currency: holding.currency,
            account: holding.account,
            category: holding.category
          };
          // Impact day P&L estimé : value × (change_24h_pct / 100)
          if (r.quote?.change_24h_pct != null && holding.value) {
            r.holding.day_pnl = (holding.value * r.quote.change_24h_pct / 100);
          }
        }
        results.push(r);
      } catch {}
    }
    dataBlock = `\n\n[STRUCTURED DATA per ticker — fetched live · source: ${sourceLabel}]\n\n` + results.map(r => {
      const lines = [`📊 ${r.ticker}:`];
      if (r.quote) {
        const ch = r.quote.change_24h_pct;
        const arrow = ch > 0 ? '🟢 +' : ch < 0 ? '🔴 ' : '🟡 ';
        lines.push(`  Price: $${r.quote.price?.toFixed(2)} · ${arrow}${ch?.toFixed(2)}% (24h)${r.quote.change_7d_pct ? ' · 7d ' + r.quote.change_7d_pct.toFixed(2) + '%' : ''}${r.quote.market_cap ? ' · MCap $' + (r.quote.market_cap/1e9).toFixed(1) + 'B' : ''}`);
      } else lines.push(`  (quote unavailable — pas de clé data API ou ticker invalide)`);
      if (r.holding) {
        const ccy = ({ USD: '$', EUR: '€', GBP: '£' })[r.holding.currency] || r.holding.currency;
        const pnlSym = r.holding.day_pnl > 0 ? '+' : '';
        lines.push(`  💼 Tu détiens : ${r.holding.quantity} (${ccy}${Math.round(r.holding.value).toLocaleString()})${r.holding.account ? ' · ' + r.holding.account : ''}${r.holding.day_pnl != null ? ' · Day P&L : ' + pnlSym + ccy + Math.round(r.holding.day_pnl).toLocaleString() : ''}`);
      }
      if (r.news?.length) {
        r.news.slice(0, 2).forEach(n => lines.push(`  📰 "${(n.title || '').slice(0, 100)}" (${n.source || n.publisher || 'src'}, ${(n.published_at || n.datetime || '').slice(0, 10)})`));
      }
      return lines.join('\n');
    }).join('\n');

    // Total day P&L portefeuille
    if (source !== 'watchlist') {
      const totalDayPnl = results.reduce((s, r) => s + (r.holding?.day_pnl || 0), 0);
      const totalValue = portfolioHoldings.reduce((s, h) => s + (h.value || 0), 0);
      const pnlPct = totalValue > 0 ? (totalDayPnl / totalValue) * 100 : 0;
      const arrow = totalDayPnl > 0 ? '🟢 +' : totalDayPnl < 0 ? '🔴 ' : '🟡 ';
      dataBlock += `\n\n💼 PORTFOLIO DAY P&L (positions tickerisées) : ${arrow}${Math.round(totalDayPnl).toLocaleString()} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`;
    }
  }

  // Inject portfolio context si source = portfolio ou both
  let portfolioContextBlock = '';
  if (source !== 'watchlist') {
    try {
      const { buildWealthContext } = await import('../core/wealth.js');
      portfolioContextBlock = await buildWealthContext('EUR');
    } catch {}
  }

  const focus = source === 'portfolio'
    ? 'Focus sur les mouvements de TES positions, leur impact $/€ sur ton patrimoine, et les actions à envisager.'
    : source === 'both'
    ? 'Focus à la fois sur les positions détenues (impact direct) et la watchlist (signaux d\'opportunité).'
    : '';

  const userMsg = `Mode brief : **${sourceLabel}** — ${tickers.length} tickers
Tickers : ${tickers.join(', ')}

${ctx ? 'Contexte utilisateur : ' + ctx + '\n\n' : ''}Date : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

${focus}
${portfolioContextBlock}
${dataBlock}

Génère le brief matinal complet selon ton format. ${useData ? 'Utilise les données structurées ci-dessus en priorité.' : ''}`;

  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_WATCHLIST_BRIEF,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      useWebSearch: useWeb,
      recordInput: { source, tickers, ctx, useData, useWeb, date: new Date().toISOString() }
    }, out, { onTitle: () => `Daily Brief · ${sourceLabel} · ${new Date().toLocaleDateString('fr-FR')}` });
    toast('Brief generated', 'success');
  } catch {}
}
