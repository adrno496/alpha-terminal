// 🌡️ Fear & Greed Live — sentiment marché en temps réel.
// Sources :
//   - Crypto F&G : alternative.me (CORS OK, sans clé)
//   - Stocks F&G : CNN dataviz endpoint (CORS variable selon proxy)
//   - VIX : Stooq CSV (CORS OK)
import { $ } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'fear-greed';

function classify(val) {
  if (val == null) return { label: '—', color: 'var(--text-muted)' };
  if (val < 25)  return { label: 'Extreme Fear',  color: '#ff4b4b' };
  if (val < 45)  return { label: 'Fear',          color: '#ff8c42' };
  if (val < 55)  return { label: 'Neutral',       color: '#ffd166' };
  if (val < 75)  return { label: 'Greed',         color: '#06d6a0' };
  return            { label: 'Extreme Greed', color: '#00ff88' };
}

function classifyVix(v) {
  if (v == null) return { label: '—', color: 'var(--text-muted)' };
  if (v < 12) return { label: 'Très calme · faible volatilité', color: '#00ff88' };
  if (v < 20) return { label: 'Calme · volatilité normale',     color: '#06d6a0' };
  if (v < 30) return { label: 'Tendu · marché nerveux',          color: '#ff8c42' };
  return         { label: 'Panique · volatilité extrême',         color: '#ff4b4b' };
}

async function fetchCryptoFG() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=30', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j.data?.map(d => ({ value: Number(d.value), label: d.value_classification, ts: Number(d.timestamp) * 1000 }));
  } catch { return null; }
}

async function fetchStocksFG() {
  try {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!r.ok) return null;
    const j = await r.json();
    const score = j?.fear_and_greed?.score;
    const previousClose = j?.fear_and_greed?.previous_close;
    const oneWeekAgo = j?.fear_and_greed?.one_week_ago;
    const oneMonthAgo = j?.fear_and_greed?.one_month_ago;
    if (typeof score !== 'number') return null;
    return {
      value: Math.round(score),
      yesterday: previousClose != null ? Math.round(previousClose) : null,
      week: oneWeekAgo != null ? Math.round(oneWeekAgo) : null,
      month: oneMonthAgo != null ? Math.round(oneMonthAgo) : null
    };
  } catch { return null; }
}

async function fetchVix() {
  try {
    const r = await fetch('https://stooq.com/q/l/?s=^vix&f=sd2t2c&h&e=csv', { cache: 'no-store' });
    if (!r.ok) return null;
    const txt = await r.text();
    const lines = txt.trim().split('\n');
    if (lines.length < 2) return null;
    const cols = lines[1].split(',');
    const close = parseFloat(cols[3]);
    const date = cols[1];
    return isFinite(close) ? { value: close, date } : null;
  } catch { return null; }
}

function gauge(value, label) {
  if (value == null) return `<div style="color:var(--text-muted);text-align:center;padding:20px;">N/A</div>`;
  const c = classify(value);
  const pct = Math.max(0, Math.min(100, value));
  return `
    <div style="text-align:center;">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">${label}</div>
      <div style="position:relative;width:200px;height:110px;margin:0 auto;">
        <div style="position:absolute;inset:0;border-radius:200px 200px 0 0;background:linear-gradient(90deg, #ff4b4b 0%, #ff8c42 25%, #ffd166 50%, #06d6a0 75%, #00ff88 100%);clip-path:polygon(0 100%, 100% 100%, 100% 0, 0 0);"></div>
        <div style="position:absolute;inset:12px 12px 0 12px;border-radius:170px 170px 0 0;background:var(--bg-secondary);"></div>
        <div style="position:absolute;left:50%;bottom:0;width:3px;height:92px;background:var(--text-primary);transform-origin:bottom;transform:translateX(-50%) rotate(${(pct - 50) * 1.8}deg);box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>
        <div style="position:absolute;left:0;right:0;bottom:6px;text-align:center;font-family:var(--font-mono);">
          <div style="font-size:34px;font-weight:700;color:${c.color};line-height:1;">${value}</div>
          <div style="font-size:11px;color:${c.color};margin-top:2px;">${c.label}</div>
        </div>
      </div>
    </div>`;
}

function vixCard(data) {
  if (!data) {
    return `<div style="background:var(--bg-tertiary);padding:18px;border-radius:8px;text-align:center;color:var(--text-muted);">VIX N/A</div>`;
  }
  const c = classifyVix(data.value);
  return `
    <div style="background:var(--bg-tertiary);padding:18px;border-radius:8px;text-align:center;">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">VIX · CBOE Volatility</div>
      <div style="font-family:var(--font-mono);font-size:42px;font-weight:700;color:${c.color};line-height:1;">${data.value.toFixed(2)}</div>
      <div style="color:${c.color};font-size:12px;margin-top:6px;">${c.label}</div>
      <div style="color:var(--text-muted);font-size:10px;margin-top:8px;">Date : ${data.date} · Source Stooq</div>
    </div>
  `;
}

async function loadAndRender(viewEl) {
  const isEN = getLocale() === 'en';
  const content = $('#fg-content');
  if (!content) return;
  content.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:30px;">${isEN ? '⏳ Loading market sentiment…' : '⏳ Chargement du sentiment marché…'}</div>`;

  const [crypto, stocks, vix] = await Promise.all([fetchCryptoFG(), fetchStocksFG(), fetchVix()]);

  const today = crypto?.[0];
  const yesterdayCrypto = crypto?.[1];
  const week = crypto?.slice(0, 7) || [];
  const month = crypto?.slice(0, 30) || [];
  const avgWeek = week.length ? week.reduce((s, x) => s + x.value, 0) / week.length : null;
  const avgMonth = month.length ? month.reduce((s, x) => s + x.value, 0) / month.length : null;

  const stocksHistory = stocks ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:10px;font-size:13px;">
      <div style="background:var(--bg-tertiary);padding:8px;border-radius:6px;text-align:center;">
        <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? 'Yesterday' : 'Hier'}</div>
        <div style="font-family:var(--font-mono);font-size:16px;color:${classify(stocks.yesterday).color};">${stocks.yesterday ?? '—'}</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:8px;border-radius:6px;text-align:center;">
        <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? '7d ago' : 'Il y a 7j'}</div>
        <div style="font-family:var(--font-mono);font-size:16px;color:${classify(stocks.week).color};">${stocks.week ?? '—'}</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:8px;border-radius:6px;text-align:center;">
        <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? '30d ago' : 'Il y a 30j'}</div>
        <div style="font-family:var(--font-mono);font-size:16px;color:${classify(stocks.month).color};">${stocks.month ?? '—'}</div>
      </div>
    </div>` : '';

  const cryptoHistory = today ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:10px;font-size:13px;">
      <div style="background:var(--bg-tertiary);padding:8px;border-radius:6px;text-align:center;">
        <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? 'Yesterday' : 'Hier'}</div>
        <div style="font-family:var(--font-mono);font-size:16px;color:${classify(yesterdayCrypto?.value).color};">${yesterdayCrypto?.value ?? '—'}</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:8px;border-radius:6px;text-align:center;">
        <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? 'Avg 7d' : 'Moy. 7j'}</div>
        <div style="font-family:var(--font-mono);font-size:16px;color:${classify(avgWeek).color};">${avgWeek != null ? Math.round(avgWeek) : '—'}</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:8px;border-radius:6px;text-align:center;">
        <div style="font-size:10.5px;color:var(--text-muted);">${isEN ? 'Avg 30d' : 'Moy. 30j'}</div>
        <div style="font-family:var(--font-mono);font-size:16px;color:${classify(avgMonth).color};">${avgMonth != null ? Math.round(avgMonth) : '—'}</div>
      </div>
    </div>` : '';

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">
      <!-- Crypto F&G card -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:18px;">
        ${gauge(today?.value, isEN ? 'Crypto Fear &amp; Greed' : 'F&amp;G Crypto')}
        ${cryptoHistory}
        <div style="margin-top:10px;font-size:10.5px;color:var(--text-muted);text-align:center;">Source : alternative.me</div>
      </div>

      <!-- Stocks F&G card -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:18px;">
        ${stocks
          ? gauge(stocks.value, isEN ? 'Stocks Fear &amp; Greed (CNN)' : 'F&amp;G Actions (CNN)')
          : `<div style="text-align:center;color:var(--text-muted);padding:35px 10px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">${isEN ? 'Stocks Fear &amp; Greed' : 'F&amp;G Actions'}</div>
              <div>⚠️ ${isEN ? 'Not available (CORS blocked)' : 'Indisponible (CORS bloqué)'}</div>
              <div style="font-size:11px;margin-top:6px;"><a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener" style="color:var(--accent-green);">${isEN ? 'View on CNN →' : 'Voir sur CNN →'}</a></div>
            </div>`}
        ${stocksHistory}
        <div style="margin-top:10px;font-size:10.5px;color:var(--text-muted);text-align:center;">Source : CNN Business</div>
      </div>

      <!-- VIX card -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:18px;">
        ${vixCard(vix)}
        <div style="margin-top:14px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:11px;color:var(--text-muted);line-height:1.5;">
          💡 ${isEN
            ? '<strong>VIX</strong> = "fear gauge" of stocks. < 20 = calm market, > 30 = panic. Extreme spikes (> 40) often mark bottoms.'
            : '<strong>VIX</strong> = jauge de peur des actions. < 20 = marché calme, > 30 = panique. Pics extrêmes (> 40) marquent souvent les bas.'}
        </div>
      </div>
    </div>

    <div style="margin-top:18px;padding:14px;background:var(--bg-tertiary);border-radius:8px;font-size:12.5px;line-height:1.6;">
      💡 ${isEN
        ? '<strong>Contrarian signal</strong>: Buffett famously said "be fearful when others are greedy, and greedy when others are fearful". Extreme Fear (< 25) historically marked good entry zones; Extreme Greed (> 75) often preceded corrections.'
        : '<strong>Signal contrarien</strong> : Buffett disait "Sois craintif quand les autres sont avides, avide quand ils sont craintifs". Extreme Fear (< 25) a historiquement marqué de bonnes zones d\'entrée ; Extreme Greed (> 75) a souvent précédé des corrections.'}
    </div>
  `;
}

export async function renderFearGreedView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🌡️ ' + t('mod.fear-greed.label'), t('mod.fear-greed.desc'), { moduleId: MODULE_ID })}
    <div style="display:flex;justify-content:flex-end;margin:0 0 12px;">
      <button id="fg-refresh" class="btn-secondary" style="font-size:12.5px;padding:6px 14px;">🔄 ${isEN ? 'Refresh' : 'Rafraîchir'}</button>
    </div>
    <div id="fg-content"></div>
  `;
  await loadAndRender(viewEl);

  const refreshBtn = $('#fg-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = isEN ? '⏳ Refreshing…' : '⏳ Rafraîchissement…';
      await loadAndRender(viewEl);
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '🔄 ' + (isEN ? 'Refresh' : 'Rafraîchir');
    });
  }
}
