// Module : Dashboard macro/risk unifié (data-driven, pas LLM).
// Distinct du module 'macro-dashboard' existant (qui fait de l'analyse LLM avec web search).
// Agrège FRED (macro US) + crypto (CoinGecko) + or (Metals/FRED) + News + ACLED.
// Calcule des "signaux dérivés" — règles statiques basées sur DONNÉES, pas sur portefeuille.
import { $, escHtml } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';
import { fredMacroSnapshot } from '../core/data-providers/fred.js';
import { fetchCoinData } from '../core/coingecko.js';
import { getSpotPrice } from '../core/spot-prices.js';
import { acledRegionRisks } from '../core/data-providers/acled.js';
import { newsSearch } from '../core/data-providers/newsapi.js';
import { getDataKey } from '../core/data-keys.js';

const MODULE_ID = 'risk-dashboard';

// Signaux dérivés : règles statiques sur les DONNÉES (pas sur un portefeuille perso).
const MACRO_SIGNALS = [
  {
    id: 'risk_off_classic',
    label: 'Risk-off classique',
    condition: ctx => ctx.vix != null && ctx.hySpread != null && ctx.vix > 25 && ctx.hySpread > 5,
    severity: 'high',
    explanation: 'VIX élevé (>25) + spread HY large (>500bps) = stress sur le risque.',
    suggestion: 'Réflexion : réduction risque actions, hedge or possible.'
  },
  {
    id: 'yield_curve_inverted',
    label: 'Courbe des taux inversée',
    condition: ctx => ctx.yieldCurveSpread != null && ctx.yieldCurveSpread < 0,
    severity: 'medium',
    explanation: '10Y - 2Y < 0 = signal de récession historique (12-18 mois).',
    suggestion: 'Réflexion : duration longue à éviter, attention cycles courts.'
  },
  {
    id: 'gold_geo_buy',
    label: 'Or + tensions géopolitiques',
    condition: ctx => ctx.geoMaxSeverity === 'HIGH',
    severity: 'high',
    explanation: 'Au moins une région ACLED en escalation HIGH → premium géopolitique sur l\'or.',
    suggestion: 'Réflexion : exposition or comme hedge.'
  },
  {
    id: 'low_vol_complacency',
    label: 'Calme excessif',
    condition: ctx => ctx.vix != null && ctx.vix > 0 && ctx.vix < 13,
    severity: 'low',
    explanation: 'VIX < 13 = complaisance, attention aux retournements brutaux.',
    suggestion: 'Réflexion : moment opportun pour rebalancing / prises de profit.'
  },
  {
    id: 'fed_restrictive',
    label: 'Fed restrictive',
    condition: ctx => ctx.fedFunds != null && ctx.fedFunds > 4,
    severity: 'medium',
    explanation: 'Fed Funds > 4% = environnement restrictif pour actifs longs.',
    suggestion: 'Réflexion : crypto/tech sous pression, value/short duration favorisé.'
  },
  {
    id: 'risk_on_strong',
    label: 'Risk-on confirmé',
    condition: ctx => ctx.vix != null && ctx.hySpread != null && ctx.yieldCurveSpread != null
                  && ctx.vix < 15 && ctx.hySpread < 3.5 && ctx.yieldCurveSpread > 0,
    severity: 'opportunity',
    explanation: 'VIX < 15 + spread HY étroit + courbe positive = appétit pour le risque sain.',
    suggestion: 'Réflexion : exposition actions/crypto sereinement maintenable.'
  }
];

const SEV_STYLE = {
  high:        { color: '#f44336', icon: '🚨', label: 'Élevée' },
  medium:      { color: '#ff9800', icon: '⚠️',  label: 'Modérée' },
  low:         { color: '#9e9e9e', icon: 'ℹ️',  label: 'Info' },
  opportunity: { color: '#4CAF50', icon: '✅', label: 'Opportunité' }
};

export async function renderRiskDashboardView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('📊 Risk Dashboard', isEN ? 'Unified data view : FRED + crypto + gold + news + geopolitics + derived signals.' : 'Vue données unifiée : FRED + crypto + or + actualités + géopolitique + signaux dérivés.', { moduleId: MODULE_ID })}

    <div class="card" style="border-left:3px solid var(--accent-blue);font-size:12px;color:var(--text-secondary);">
      ℹ️ ${isEN ? 'This view aggregates raw data + static signals. For an LLM-driven analysis with web search, see' : 'Cette vue agrège des données brutes + signaux statiques. Pour une analyse LLM avec web search, voir'} <a href="#macro-dashboard" style="color:var(--accent-green);">📊 Macro Dashboard (LLM)</a>.
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="font-size:13px;color:var(--text-secondary);">
          ${isEN ? 'Sources : FRED · CoinGecko · NewsAPI · ACLED' : 'Sources : FRED · CoinGecko · NewsAPI · ACLED'}
        </div>
        <button id="rd-refresh" class="btn-primary">🔄 ${isEN ? 'Refresh all' : 'Tout rafraîchir'}</button>
      </div>
    </div>

    <div id="rd-signals"></div>
    <div id="rd-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:12px;"></div>
  `;

  $('#rd-refresh').addEventListener('click', () => doRefresh(viewEl));
  await doRefresh(viewEl);
}

async function doRefresh(viewEl) {
  const isEN = getLocale() === 'en';
  $('#rd-signals').innerHTML = `<div class="card"><div style="text-align:center;color:var(--text-muted);">⏳ ${isEN ? 'Loading…' : 'Chargement…'}</div></div>`;
  $('#rd-grid').innerHTML = '';

  const [macroR, btcR, ethR, goldR, geoR, newsR] = await Promise.allSettled([
    getDataKey('fred') ? fredMacroSnapshot() : Promise.resolve(null),
    fetchCoinData('BTC').catch(() => null),
    fetchCoinData('ETH').catch(() => null),
    getSpotPrice('GOLD').catch(() => null),
    getDataKey('acled') ? acledRegionRisks() : Promise.resolve(null),
    getDataKey('newsapi') ? newsSearch('inflation OR fed OR bitcoin OR gold', { limit: 5, days: 3 }) : Promise.resolve(null)
  ]);

  const macro = macroR.status === 'fulfilled' ? macroR.value : null;
  const btc = btcR.status === 'fulfilled' ? btcR.value : null;
  const eth = ethR.status === 'fulfilled' ? ethR.value : null;
  const gold = goldR.status === 'fulfilled' ? goldR.value : null;
  const geo = geoR.status === 'fulfilled' ? geoR.value : null;
  const news = newsR.status === 'fulfilled' ? newsR.value : null;

  const geoMaxSeverity = geo ? maxSeverity(Object.values(geo).map(r => r?.severity)) : 'UNKNOWN';
  const ctx = {
    // Valeurs à null si FRED indisponible — les règles SIGNALS doivent skip si null/0
    // (sinon on déclenche de faux "risk-on" sur des défauts neutres trompeurs).
    vix: macro?.vix?.value ?? null,
    hySpread: macro?.high_yield_spread?.value ?? null,
    yieldCurveSpread: macro?.yield_curve_spread?.value ?? null,
    fedFunds: macro?.fed_funds?.value ?? null,
    geoMaxSeverity
  };

  const triggered = MACRO_SIGNALS.filter(s => {
    try { return s.condition(ctx); } catch { return false; }
  });

  $('#rd-signals').innerHTML = renderSignals(triggered, isEN);

  $('#rd-grid').innerHTML = [
    renderMacroCard(macro, isEN),
    renderMarketsCard({ btc, eth, gold }, isEN),
    renderGeoCard(geo, isEN),
    renderNewsCard(news, isEN)
  ].join('');
}

function maxSeverity(severities) {
  if (severities.includes('HIGH')) return 'HIGH';
  if (severities.includes('MEDIUM')) return 'MEDIUM';
  if (severities.includes('LOW')) return 'LOW';
  return 'UNKNOWN';
}

function renderSignals(signals, isEN) {
  if (!signals.length) {
    return `<div class="card"><div style="font-size:13px;color:var(--text-muted);">💡 ${isEN ? 'No active signals right now. Conditions appear neutral.' : 'Aucun signal actif. Conditions neutres.'}</div></div>`;
  }
  return `
    <div class="card">
      <div class="card-title">💡 ${isEN ? 'Active signals' : 'Signaux actifs'} (${signals.length})</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">${isEN ? 'Static rules on data — informational, not financial advice.' : 'Règles statiques sur les données — informatif, pas un conseil financier.'}</div>
      ${signals.map(s => {
        const st = SEV_STYLE[s.severity] || SEV_STYLE.low;
        return `
          <div style="padding:10px 12px;border-left:3px solid ${st.color};margin-bottom:8px;background:var(--bg-tertiary);border-radius:4px;">
            <div style="font-weight:600;font-size:13.5px;color:${st.color};">${st.icon} ${escHtml(s.label)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.5;">${escHtml(s.explanation)}</div>
            <div style="font-size:12px;color:var(--text-primary);margin-top:4px;font-style:italic;">${escHtml(s.suggestion)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMacroCard(macro, isEN) {
  if (!macro) {
    return cardSkeleton('🏛️ Macro US (FRED)', `<div style="font-size:12px;color:var(--text-muted);">${isEN ? 'FRED key not configured.' : 'Clé FRED non configurée.'} <a href="#settings/data-keys" style="color:var(--accent-green);">Settings →</a></div>`);
  }
  const fmt = (v, suffix = '') => v == null ? '—' : `${Number(v).toFixed(2)}${suffix}`;
  const rows = [
    { label: 'Fed Funds Rate', val: fmt(macro.fed_funds?.value, '%') },
    { label: 'US 10Y', val: fmt(macro.us10y?.value, '%') },
    { label: 'US 2Y', val: fmt(macro.us2y?.value, '%') },
    { label: '10Y-2Y spread', val: fmt(macro.yield_curve_spread?.value, '%') },
    { label: 'VIX', val: fmt(macro.vix?.value) },
    { label: 'HY OAS spread', val: fmt(macro.high_yield_spread?.value, '%') },
    { label: 'WTI oil', val: fmt(macro.wti_oil?.value, ' $') },
    { label: 'USD index', val: fmt(macro.usd_index?.value) }
  ];
  return cardSkeleton('🏛️ Macro US (FRED)', `
    <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
      ${rows.map(r => `<tr><td style="padding:4px 0;color:var(--text-secondary);">${r.label}</td><td style="padding:4px 0;text-align:right;font-weight:600;font-family:var(--font-mono);">${r.val}</td></tr>`).join('')}
    </table>
  `);
}

function renderMarketsCard({ btc, eth, gold }, isEN) {
  const fmt = (v) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const fmtPct = (v) => v == null ? '' : `<span style="color:${v >= 0 ? '#4CAF50' : '#f44336'};font-size:11px;"> ${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%</span>`;
  const rows = [
    { label: '🪙 Bitcoin', val: fmt(btc?.price_usd), pct: fmtPct(btc?.price_change_24h_pct) },
    { label: '🪙 Ethereum', val: fmt(eth?.price_usd), pct: fmtPct(eth?.price_change_24h_pct) },
    { label: '🥇 Gold (XAU)', val: fmt(gold?.priceUSD), pct: '' }
  ];
  return cardSkeleton('💹 Marchés', `
    <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
      ${rows.map(r => `<tr><td style="padding:4px 0;color:var(--text-secondary);">${r.label}</td><td style="padding:4px 0;text-align:right;font-weight:600;font-family:var(--font-mono);">${r.val}${r.pct}</td></tr>`).join('')}
    </table>
  `);
}

function renderGeoCard(geo, isEN) {
  if (!geo) {
    return cardSkeleton('🌍 Géopolitique (ACLED)', `<div style="font-size:12px;color:var(--text-muted);">${isEN ? 'ACLED credentials not configured.' : 'Identifiants ACLED non configurés.'} <a href="#settings/data-keys" style="color:var(--accent-green);">Settings →</a></div>`);
  }
  const sevColor = { HIGH: '#f44336', MEDIUM: '#ff9800', LOW: '#4CAF50', UNKNOWN: 'var(--text-muted)' };
  const sevIcon = { HIGH: '🔴', MEDIUM: '🟠', LOW: '🟢', UNKNOWN: '⚪' };
  return cardSkeleton('🌍 Géopolitique (ACLED)', `
    ${Object.entries(geo).map(([region, r]) => {
      if (r?.error) return `<div style="padding:6px 0;font-size:12px;color:var(--accent-red);">${escHtml(region)} : ${escHtml(r.error)}</div>`;
      return `
        <div style="padding:6px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12.5px;font-weight:600;">${escHtml(region)}</span>
            <span style="font-size:11.5px;color:${sevColor[r?.severity] || 'var(--text-muted)'};font-weight:600;">${sevIcon[r?.severity] || '⚪'} ${escHtml(r?.severity || 'UNKNOWN')}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${r?.intensity || 0} ${isEN ? 'events 7d' : 'événements 7j'}</div>
        </div>
      `;
    }).join('')}
    <div style="margin-top:8px;font-size:11px;"><a href="#geo-risk" style="color:var(--accent-green);">→ ${isEN ? 'Open full Geo Risk view' : 'Ouvrir vue Risque Géo'}</a></div>
  `);
}

function renderNewsCard(news, isEN) {
  if (!news) {
    return cardSkeleton('📰 News', `<div style="font-size:12px;color:var(--text-muted);">${isEN ? 'NewsAPI key not configured.' : 'Clé NewsAPI non configurée.'} <a href="#settings/data-keys" style="color:var(--accent-green);">Settings →</a></div>`);
  }
  const sentColor = { BULLISH: '#4CAF50', BEARISH: '#f44336', NEUTRAL: 'var(--text-muted)' };
  const sentIcon = { BULLISH: '📈', BEARISH: '📉', NEUTRAL: '⚪' };
  return cardSkeleton(`📰 News · ${sentIcon[news.overallSentiment]} ${news.overallSentiment}`, `
    ${(news.articles || []).slice(0, 5).map(a => `
      <a href="${escHtml(a.url)}" target="_blank" rel="noopener" style="display:block;padding:6px 0;border-bottom:1px solid var(--border);text-decoration:none;color:var(--text-primary);">
        <div style="font-size:12px;font-weight:600;line-height:1.35;">
          <span style="color:${sentColor[a.sentiment]};margin-right:4px;">${sentIcon[a.sentiment]}</span>${escHtml((a.title || '').slice(0, 100))}${(a.title || '').length > 100 ? '…' : ''}
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">${escHtml(a.source)}</div>
      </a>
    `).join('')}
    <div style="margin-top:8px;font-size:11px;"><a href="#news-feed" style="color:var(--accent-green);">→ ${isEN ? 'Open full News view' : 'Ouvrir vue News complète'}</a></div>
  `);
}

function cardSkeleton(title, body) {
  return `<div class="card"><div class="card-title">${title}</div><div>${body}</div></div>`;
}
