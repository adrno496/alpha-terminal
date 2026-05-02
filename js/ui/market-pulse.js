// Market Pulse widget — Fear & Greed (Crypto + Stocks)
// Sources gratuites :
//   - Crypto F&G : https://api.alternative.me/fng/  (CORS OK)
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

  async function fetchCryptoFG() {
    try {
      const r = await fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' });
      const j = await r.json();
      const d = j?.data?.[0];
      return { value: parseInt(d?.value, 10), label: d?.value_classification };
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
    const [crypto, stocks] = await Promise.all([
      fetchCryptoFG(),
      fetchStocksFG()
    ]);
    const data = { crypto, stocks, ts: Date.now() };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    return data;
  }

  function pillHTML(label, value, sub, color) {
    const display = (value == null || isNaN(value)) ? '—' : value;
    return `
      <a href="#fear-greed" class="mp-pill mp-pill-link" data-route="fear-greed" title="${label}: ${display}${sub ? ' (' + sub + ')' : ''} — clic pour voir le détail">
        <span class="mp-pill-label">${label}</span>
        <span class="mp-pill-value" style="color:${color};">${display}</span>
        ${sub ? `<span class="mp-pill-sub" style="color:${color};">${sub}</span>` : ''}
      </a>
    `;
  }

  function wireNav(container) {
    container.querySelectorAll('.mp-pill-link').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        // Si app SPA présente, route vers le module fear-greed
        if (typeof window.routeTo === 'function') {
          try { window.routeTo('fear-greed'); return; } catch {}
        }
        // Fallback : changer le hash, l'app SPA réagit dessus
        location.hash = '#fear-greed';
        // Si on est sur la landing (pas de hash router), redirige
        if (!document.querySelector('[data-route="fear-greed"]')) {
          location.href = 'index.html#fear-greed';
        }
      });
    });
  }

  function render(container, data) {
    const c = data.crypto;
    const s = data.stocks;
    const cClass = c ? classifyValue(c.value) : classifyValue(null);
    const sClass = s != null ? classifyValue(s) : classifyValue(null);

    container.innerHTML = `
      <div class="mp-wrap">
        <div class="mp-pills">
          ${pillHTML('Crypto', c?.value ?? null, cClass.emoji, cClass.color)}
          ${s != null ? pillHTML('Stocks', s, sClass.emoji, sClass.color) : ''}
        </div>
        <button class="mp-refresh" type="button" title="Refresh" aria-label="Refresh">↻</button>
      </div>
    `;
    const btn = container.querySelector('.mp-refresh');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.classList.add('spinning');
      btn.disabled = true;
      const fresh = await loadAll(true);
      render(container, fresh);
    });
    wireNav(container);
  }

  function injectStyles() {
    if (document.getElementById('mp-styles')) return;
    const css = `
      .mp-wrap { display:inline-flex; align-items:center; gap:6px; }
      .mp-pills { display:inline-flex; gap:5px; flex-wrap:nowrap; }
      .mp-pill {
        display:inline-flex; flex-direction:column; align-items:center; line-height:1.05;
        padding:4px 9px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.10);
        border-radius:8px; font-size:10px; min-width:52px;
        text-decoration:none; cursor:pointer; transition: border-color 0.15s, background 0.15s;
      }
      .mp-pill-link:hover { border-color:#00ff88; background:rgba(0,255,136,0.08); }
      .mp-pill-label { color:#888; font-size:9.5px; text-transform:uppercase; letter-spacing:0.4px; font-weight:600; }
      .mp-pill-value { font-size:14px; font-weight:700; line-height:1.1; }
      .mp-pill-sub { font-size:11px; line-height:1.05; }
      .mp-refresh {
        background:transparent; border:1px solid rgba(255,255,255,0.12); color:#aaa;
        width:26px; height:26px; border-radius:6px; cursor:pointer; font-size:14px;
        display:inline-flex; align-items:center; justify-content:center; padding:0;
        transition: transform 0.2s, color 0.2s; flex-shrink:0;
      }
      .mp-refresh:hover { color:#00ff88; border-color:#00ff88; }
      .mp-refresh:disabled { opacity:0.5; cursor:wait; }
      .mp-refresh.spinning { animation: mp-spin 0.6s linear infinite; }
      @keyframes mp-spin { to { transform: rotate(360deg); } }
      /* Mobile : compact, juste l'emoji + valeur, pas de label */
      @media (max-width: 768px) {
        .mp-wrap { gap:4px; }
        .mp-pill { min-width:auto; padding:3px 7px; flex-direction:row; gap:4px; }
        .mp-pill-label { display:none; }
        .mp-pill-value { font-size:12px; }
        .mp-pill-sub { font-size:13px; }
        .mp-refresh { width:24px; height:24px; font-size:13px; }
      }
      @media (max-width: 380px) {
        .mp-pill-value { font-size:11px; }
        .mp-pill-sub { font-size:12px; }
      }
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
