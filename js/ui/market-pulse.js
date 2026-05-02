// Market Pulse widget — Fear & Greed (Crypto + Stocks) + VIX
// Sources gratuites CORS-friendly :
//   - Crypto F&G : https://api.alternative.me/fng/
//   - VIX : Stooq CSV (https://stooq.com/q/l/?s=^vix&f=sd2t2c&h&e=csv)
//   - Stocks F&G : CNN endpoint, fallback gracieux si CORS bloque
//
// Cache localStorage 30 min pour limiter les appels.
//
// Utilisation :
//   import { mountMarketPulse } from './market-pulse.js';
//   mountMarketPulse(document.getElementById('market-pulse-mount'));

(function () {
  'use strict';

  const CACHE_KEY = 'alpha-market-pulse';
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

  function classifyValue(v) {
    if (v == null) return { label: '—', emoji: '⚪', color: '#888' };
    if (v <= 24) return { label: 'Extreme Fear', emoji: '😱', color: '#ff3030' };
    if (v <= 44) return { label: 'Fear', emoji: '😟', color: '#ff8c00' };
    if (v <= 55) return { label: 'Neutral', emoji: '😐', color: '#cccc00' };
    if (v <= 75) return { label: 'Greed', emoji: '😏', color: '#88dd00' };
    return { label: 'Extreme Greed', emoji: '🤑', color: '#00ff88' };
  }

  function classifyVix(v) {
    if (v == null) return { label: '—', color: '#888' };
    if (v < 12) return { label: 'Très calme', color: '#00ff88' };
    if (v < 20) return { label: 'Calme', color: '#88dd00' };
    if (v < 30) return { label: 'Tendu', color: '#ff8c00' };
    return { label: 'Panique', color: '#ff3030' };
  }

  async function fetchCryptoFG() {
    try {
      const r = await fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' });
      const j = await r.json();
      const d = j?.data?.[0];
      return { value: parseInt(d?.value, 10), label: d?.value_classification };
    } catch { return null; }
  }

  async function fetchVix() {
    try {
      const r = await fetch('https://stooq.com/q/l/?s=^vix&f=sd2t2c&h&e=csv', { cache: 'no-store' });
      const txt = await r.text();
      // Format: Symbol,Date,Time,Close
      const lines = txt.trim().split('\n');
      if (lines.length < 2) return null;
      const cols = lines[1].split(',');
      const close = parseFloat(cols[3]);
      return isFinite(close) ? close : null;
    } catch { return null; }
  }

  async function fetchStocksFG() {
    // CNN endpoint — peut être bloqué par CORS selon le proxy.
    // Si ça échoue, on affiche juste — au lieu de planter.
    try {
      const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const j = await r.json();
      const score = j?.fear_and_greed?.score;
      if (typeof score !== 'number') return null;
      return Math.round(score);
    } catch { return null; }
  }

  async function loadAll(force) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;
      } catch {}
    }
    const [crypto, vix, stocks] = await Promise.all([
      fetchCryptoFG(),
      fetchVix(),
      fetchStocksFG()
    ]);
    const data = { crypto, vix, stocks, ts: Date.now() };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    return data;
  }

  function pillHTML(label, value, sub, color) {
    const display = (value == null || isNaN(value)) ? '—' : value;
    return `
      <div class="mp-pill" title="${label}: ${display}${sub ? ' (' + sub + ')' : ''}">
        <span class="mp-pill-label">${label}</span>
        <span class="mp-pill-value" style="color:${color};">${display}</span>
        ${sub ? `<span class="mp-pill-sub" style="color:${color};">${sub}</span>` : ''}
      </div>
    `;
  }

  function render(container, data) {
    const c = data.crypto;
    const s = data.stocks;
    const v = data.vix;
    const cClass = c ? classifyValue(c.value) : classifyValue(null);
    const sClass = s != null ? classifyValue(s) : classifyValue(null);
    const vClass = classifyVix(v);
    const vDisplay = (v != null && isFinite(v)) ? v.toFixed(2) : null;

    container.innerHTML = `
      <div class="mp-wrap">
        <div class="mp-pills">
          ${pillHTML('Crypto', c?.value ?? null, cClass.emoji, cClass.color)}
          ${s != null ? pillHTML('Stocks', s, sClass.emoji, sClass.color) : ''}
          ${pillHTML('VIX', vDisplay, vClass.label, vClass.color)}
        </div>
        <button class="mp-refresh" type="button" title="Refresh" aria-label="Refresh">↻</button>
      </div>
    `;
    const btn = container.querySelector('.mp-refresh');
    btn.addEventListener('click', async () => {
      btn.classList.add('spinning');
      btn.disabled = true;
      const fresh = await loadAll(true);
      render(container, fresh);
    });
  }

  function injectStyles() {
    if (document.getElementById('mp-styles')) return;
    const css = `
      .mp-wrap { display:inline-flex; align-items:center; gap:8px; }
      .mp-pills { display:inline-flex; gap:6px; flex-wrap:nowrap; }
      .mp-pill {
        display:inline-flex; flex-direction:column; align-items:center; line-height:1.05;
        padding:4px 9px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.10);
        border-radius:8px; font-size:10px; min-width:54px;
      }
      .mp-pill-label { color:#888; font-size:9.5px; text-transform:uppercase; letter-spacing:0.4px; font-weight:600; }
      .mp-pill-value { font-size:14px; font-weight:700; line-height:1.1; }
      .mp-pill-sub { font-size:9px; opacity:0.85; line-height:1.05; }
      .mp-refresh {
        background:transparent; border:1px solid rgba(255,255,255,0.12); color:#aaa;
        width:26px; height:26px; border-radius:6px; cursor:pointer; font-size:14px;
        display:inline-flex; align-items:center; justify-content:center; padding:0;
        transition: transform 0.2s, color 0.2s;
      }
      .mp-refresh:hover { color:#00ff88; border-color:#00ff88; }
      .mp-refresh:disabled { opacity:0.5; cursor:wait; }
      .mp-refresh.spinning { animation: mp-spin 0.6s linear infinite; }
      @keyframes mp-spin { to { transform: rotate(360deg); } }
      @media (max-width: 720px) { .mp-pill { min-width:46px; } .mp-pill-label { font-size:9px; } .mp-pill-value { font-size:12px; } }
    `;
    const s = document.createElement('style');
    s.id = 'mp-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  async function mountMarketPulse(container) {
    if (!container) return;
    injectStyles();
    container.innerHTML = '<div class="mp-wrap" style="opacity:0.5;font-size:11px;color:#888;">⏳ Market…</div>';
    const data = await loadAll(false);
    render(container, data);
  }

  // Expose en global pour usage inline depuis HTML
  window.AlphaMarketPulse = { mount: mountMarketPulse, refresh: loadAll };
})();
