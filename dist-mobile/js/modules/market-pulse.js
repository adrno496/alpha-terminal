// 🌐 Market Pulse — heatmap globale crypto + FX + indices (sans clé) avec auto-refresh 60s
import { $ } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'market-pulse';
let _refreshInterval = null;

function colorFor(pct) {
  if (pct == null || isNaN(pct)) return 'var(--bg-tertiary)';
  if (pct >= 3) return 'rgba(0,255,136,0.6)';
  if (pct >= 1) return 'rgba(0,255,136,0.35)';
  if (pct >= 0) return 'rgba(0,255,136,0.15)';
  if (pct >= -1) return 'rgba(255,75,75,0.15)';
  if (pct >= -3) return 'rgba(255,75,75,0.35)';
  return 'rgba(255,75,75,0.6)';
}

async function fetchAll() {
  const out = { crypto: [], fx: [], errs: [] };
  // CoinGecko top 20 by market cap
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h');
    if (r.ok) {
      const list = await r.json();
      out.crypto = list.map(c => ({ name: c.symbol.toUpperCase(), price: c.current_price, change: c.price_change_percentage_24h }));
    }
  } catch (e) { out.errs.push('CoinGecko'); }
  // Frankfurter
  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP,JPY,CHF,CAD,AUD,CNY,INR');
    if (r.ok) {
      const j = await r.json();
      out.fx = Object.entries(j.rates || {}).map(([cur, rate]) => ({ name: 'EUR/' + cur, price: rate, change: null }));
    }
  } catch (e) { out.errs.push('FX'); }
  return out;
}

function render(data, container) {
  const isEN = getLocale() === 'en';
  const tile = (x) => `
    <div style="background:${colorFor(x.change)};padding:10px 8px;border-radius:6px;text-align:center;border:1px solid var(--border);">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;">${x.name}</div>
      <div style="font-family:var(--font-mono);font-size:14px;margin:3px 0;">${x.price?.toFixed(x.price < 1 ? 4 : 2) || '—'}</div>
      ${x.change != null ? `<div style="font-size:11px;font-family:var(--font-mono);">${(x.change >= 0 ? '+' : '')}${x.change.toFixed(2)}%</div>` : '<div style="height:11px;"></div>'}
    </div>`;
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:13px;color:var(--text-muted);">🪙 Crypto top 20 (24h)</div>
      <div style="font-size:11px;color:var(--text-muted);">↻ auto-refresh 60s</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-bottom:18px;">
      ${data.crypto.map(tile).join('')}
    </div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">💱 Forex (EUR base)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-bottom:14px;">
      ${data.fx.map(tile).join('')}
    </div>
    ${data.errs.length ? `<div style="color:var(--accent-orange);font-size:12px;">⚠️ ${data.errs.join(', ')} ${isEN ? 'unavailable' : 'indisponibles'}</div>` : ''}
    <div style="font-size:11px;color:var(--text-muted);margin-top:14px;">
      ${isEN ? 'For stock indices live data, configure FMP / Polygon / Finnhub key in Settings.' : 'Pour les indices boursiers en temps réel, configure une clé FMP / Polygon / Finnhub dans Paramètres.'}
    </div>
  `;
}

export function renderMarketPulseView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🌐 ' + t('mod.market-pulse.label'), t('mod.market-pulse.desc'), { moduleId: MODULE_ID })}
    <div id="mp-content" class="card"><div style="color:var(--text-muted);">${isEN ? 'Loading...' : 'Chargement...'}</div></div>
  `;
  const c = $('#mp-content');
  const refresh = () => fetchAll().then(d => render(d, c));
  refresh();
  if (_refreshInterval) clearInterval(_refreshInterval);
  _refreshInterval = setInterval(refresh, 60000);
}
