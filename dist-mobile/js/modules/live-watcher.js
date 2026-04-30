// Module Live Watcher : graphique temps réel via polling 30s + intégration alertes prix.
// Utilise les data-providers existants (CoinGecko crypto + FMP/Finnhub stocks).
import { $, toast } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';
import { listPriceAlerts, savePriceAlert } from '../core/price-alerts.js';
import { updateAlertBadge } from '../ui/alerts-banner.js';

const MODULE_ID = 'live-watcher';
const WATCH_KEY = 'alpha-terminal:live-watcher:tickers';
const POLL_INTERVAL_MS = 30 * 1000;

let pollTimer = null;
const seriesByTicker = {}; // { 'AAPL': [{t: ts, p: price}, ...] }
let chartInstance = null;
let selectedTicker = null;

function getWatchedTickers() {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) || '[]'); }
  catch { return []; }
}
function saveWatchedTickers(arr) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(arr));
}

async function fetchPrice(ticker) {
  // Crypto first
  try {
    if (/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|LINK|DOT|MATIC|ATOM|UNI|LTC|TRX|TON)$/i.test(ticker)) {
      const { fetchCoinData } = await import('../core/coingecko.js');
      const cg = await fetchCoinData(ticker);
      if (cg && cg.price_usd) return { price: cg.price_usd, currency: 'USD', source: 'CoinGecko' };
    }
  } catch {}
  // Stocks via providers
  let getDataKey;
  try { ({ getDataKey } = await import('../core/data-keys.js')); } catch {}
  if (getDataKey && getDataKey('fmp')) {
    try {
      const { fmpQuote } = await import('../core/data-providers/fmp.js');
      const q = await fmpQuote(ticker);
      if (q?.price) return { price: q.price, currency: 'USD', source: 'FMP' };
    } catch {}
  }
  if (getDataKey && getDataKey('finnhub')) {
    try {
      const { finnhubQuote } = await import('../core/data-providers/finnhub.js');
      const q = await finnhubQuote(ticker);
      if (q?.price) return { price: q.price, currency: 'USD', source: 'Finnhub' };
    } catch {}
  }
  return null;
}

async function pollOnce() {
  const watched = getWatchedTickers();
  if (watched.length === 0) return;
  for (const t of watched) {
    try {
      const r = await fetchPrice(t);
      if (!r) continue;
      seriesByTicker[t] = seriesByTicker[t] || [];
      seriesByTicker[t].push({ t: Date.now(), p: r.price, currency: r.currency });
      // Keep only last 240 points (= 2h à 30s/poll)
      if (seriesByTicker[t].length > 240) seriesByTicker[t].splice(0, seriesByTicker[t].length - 240);
    } catch {}
  }
  // Check alerts after fetching
  await checkAlertsAgainstSeries();
  refreshUI();
}

async function checkAlertsAgainstSeries() {
  const allAlerts = await listPriceAlerts({ status: 'active' });
  for (const alert of allAlerts) {
    const series = seriesByTicker[alert.ticker];
    if (!series || series.length === 0) continue;
    const latest = series[series.length - 1].p;
    const triggered = alert.direction === 'above' ? latest >= alert.targetPrice : latest <= alert.targetPrice;
    alert.lastObservedPrice = latest;
    alert.lastCheckedAt = new Date().toISOString();
    if (triggered) {
      alert.status = 'triggered';
      alert.triggeredAt = new Date().toISOString();
      try {
        const { notifyPriceAlert } = await import('../core/notifications.js');
        await notifyPriceAlert(alert);
      } catch {}
      window.dispatchEvent(new CustomEvent('app:alerts-updated'));
    }
    await savePriceAlert(alert);
  }
  await updateAlertBadge();
}

function startPolling() {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export async function renderLiveWatcherView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '📈 Live Watcher' : '📈 Suivi temps réel',
      isEN ? 'Real-time prices via 30s polling. Linked to your price alerts — system notification when triggered.' : 'Prix en quasi-temps réel via polling 30s. Connecté aux alertes prix — notification système au déclenchement.',
      { moduleId: MODULE_ID })}

    <div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <input id="lw-add-input" class="input" placeholder="${isEN ? 'Ticker (AAPL, BTC, MC.PA…)' : 'Ticker (AAPL, BTC, MC.PA…)'}" style="max-width:220px;" />
        <button id="lw-add-btn" class="btn-secondary">+ ${isEN ? 'Watch' : 'Suivre'}</button>
        <button id="lw-poll-now" class="btn-primary">🔄 ${isEN ? 'Refresh now' : 'Rafraîchir'}</button>
        <span id="lw-status" style="margin-left:auto;font-size:11px;color:var(--text-muted);"></span>
      </div>
    </div>

    <div class="card" id="lw-tickers-list"></div>
    <div class="card" style="height:340px;"><canvas id="lw-chart"></canvas></div>
  `;

  $('#lw-add-btn').addEventListener('click', () => {
    const t = $('#lw-add-input').value.trim().toUpperCase();
    if (!t) return;
    const watched = getWatchedTickers();
    if (!watched.includes(t)) {
      watched.push(t);
      saveWatchedTickers(watched);
      if (!selectedTicker) selectedTicker = t;
      $('#lw-add-input').value = '';
      refreshUI();
      pollOnce();
    }
  });
  $('#lw-add-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lw-add-btn').click(); });
  $('#lw-poll-now').addEventListener('click', () => pollOnce());

  startPolling();
  refreshUI();
  // Cleanup on unload
  window.addEventListener('hashchange', () => { stopPolling(); }, { once: true });
}

function refreshUI() {
  const isEN = getLocale() === 'en';
  const watched = getWatchedTickers();
  const status = $('#lw-status');
  if (status) status.textContent = `${watched.length} ${isEN ? 'tracked' : 'suivis'} · ${isEN ? 'last update' : 'dernier MAJ'} : ${new Date().toLocaleTimeString()}`;

  const list = $('#lw-tickers-list');
  if (!list) return;
  if (watched.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:14px;">${isEN ? 'Add a ticker above to start tracking.' : 'Ajoute un ticker ci-dessus pour démarrer le suivi.'}</p>`;
    return;
  }
  list.innerHTML = watched.map(t => {
    const series = seriesByTicker[t] || [];
    const latest = series[series.length - 1];
    const first = series[0];
    const change = (latest && first) ? ((latest.p - first.p) / first.p) * 100 : 0;
    const sym = latest?.currency === 'EUR' ? '€' : '$';
    const isSelected = t === selectedTicker;
    return `
      <div class="lw-row" data-ticker="${t}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:4px;background:${isSelected ? 'var(--bg-tertiary)' : 'transparent'};border-left:3px solid ${isSelected ? 'var(--accent-green)' : 'transparent'};cursor:pointer;font-size:13px;margin-bottom:4px;">
        <span><strong>${t}</strong>${latest ? ` <span style="font-family:var(--font-mono);">${latest.p.toFixed(2)} ${sym}</span>` : ' <span style="color:var(--text-muted);">⏳</span>'}</span>
        <span style="display:flex;gap:10px;align-items:center;">
          ${latest ? `<span style="font-family:var(--font-mono);color:${change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};font-size:11px;">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>` : ''}
          <button class="btn-ghost lw-del" data-ticker="${t}" style="padding:2px 6px;font-size:11px;color:var(--text-muted);" title="Stop tracking">×</button>
        </span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.lw-row').forEach(el => el.addEventListener('click', (e) => {
    if (e.target.closest('.lw-del')) return;
    selectedTicker = el.dataset.ticker;
    refreshUI();
  }));
  list.querySelectorAll('.lw-del').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const watched = getWatchedTickers().filter(x => x !== b.dataset.ticker);
    saveWatchedTickers(watched);
    delete seriesByTicker[b.dataset.ticker];
    if (selectedTicker === b.dataset.ticker) selectedTicker = watched[0] || null;
    refreshUI();
  }));

  // Update chart
  if (!selectedTicker) selectedTicker = watched[0];
  drawChart(selectedTicker);
}

function drawChart(ticker) {
  const canvas = document.getElementById('lw-chart');
  if (!canvas || !ticker || !window.Chart) return;
  const series = seriesByTicker[ticker] || [];
  if (series.length === 0) return;
  if (chartInstance) { try { chartInstance.destroy(); } catch {} chartInstance = null; }
  const labels = series.map(p => new Date(p.t).toLocaleTimeString());
  const data = series.map(p => p.p);
  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ label: ticker, data, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
      scales: {
        x: { ticks: { color: '#888', maxTicksLimit: 8 }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } }
      }
    }
  });
}
