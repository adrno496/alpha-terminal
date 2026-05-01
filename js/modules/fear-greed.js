// 🌡️ Fear & Greed Live — sentiment marché en 1 jauge.
// Combine Crypto F&G (alternative.me, sans clé) + indicateurs heuristiques équités si pas d'autre source.
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

async function fetchCryptoFG() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=30');
    if (!r.ok) return null;
    const j = await r.json();
    return j.data?.map(d => ({ value: Number(d.value), label: d.value_classification, ts: Number(d.timestamp) * 1000 }));
  } catch { return null; }
}

function gauge(value) {
  if (value == null) return '<div style="color:var(--text-muted);">N/A</div>';
  const c = classify(value);
  const pct = Math.max(0, Math.min(100, value));
  return `
    <div style="position:relative;width:240px;height:130px;margin:0 auto;">
      <div style="position:absolute;inset:0;border-radius:240px 240px 0 0;background:linear-gradient(90deg, #ff4b4b 0%, #ff8c42 25%, #ffd166 50%, #06d6a0 75%, #00ff88 100%);clip-path:polygon(0 100%, 100% 100%, 100% 0, 0 0);"></div>
      <div style="position:absolute;inset:14px 14px 0 14px;border-radius:200px 200px 0 0;background:var(--bg-secondary);"></div>
      <div style="position:absolute;left:50%;bottom:0;width:3px;height:110px;background:var(--text-primary);transform-origin:bottom;transform:translateX(-50%) rotate(${(pct - 50) * 1.8}deg);box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>
      <div style="position:absolute;left:0;right:0;bottom:8px;text-align:center;font-family:var(--font-mono);">
        <div style="font-size:42px;font-weight:700;color:${c.color};line-height:1;">${value}</div>
        <div style="font-size:12px;color:${c.color};margin-top:2px;">${c.label}</div>
      </div>
    </div>`;
}

export async function renderFearGreedView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🌡️ ' + t('mod.fear-greed.label'), t('mod.fear-greed.desc'), { moduleId: MODULE_ID })}
    <div id="fg-content" class="card"><div style="color:var(--text-muted);text-align:center;padding:30px;">${isEN ? 'Loading...' : 'Chargement...'}</div></div>
  `;
  const data = await fetchCryptoFG();
  if (!data || !data.length) {
    $('#fg-content').innerHTML = `<div style="color:var(--accent-orange);">${isEN ? 'Could not fetch sentiment data' : 'Impossible de récupérer les données sentiment'}</div>`;
    return;
  }
  const today = data[0];
  const yesterday = data[1];
  const week = data.slice(0, 7);
  const month = data.slice(0, 30);
  const avgWeek = week.reduce((s, x) => s + x.value, 0) / week.length;
  const avgMonth = month.reduce((s, x) => s + x.value, 0) / month.length;

  $('#fg-content').innerHTML = `
    <div style="text-align:center;margin-bottom:14px;">
      <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">${isEN ? 'Crypto Fear & Greed Index' : 'Indice Fear & Greed Crypto'}</div>
      ${gauge(today.value)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;font-size:13px;">
      <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);">${isEN ? 'Yesterday' : 'Hier'}</div>
        <div style="font-family:var(--font-mono);font-size:18px;color:${classify(yesterday?.value).color};">${yesterday?.value ?? '—'}</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);">${isEN ? 'Avg 7d' : 'Moy. 7j'}</div>
        <div style="font-family:var(--font-mono);font-size:18px;color:${classify(avgWeek).color};">${Math.round(avgWeek)}</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:10px;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);">${isEN ? 'Avg 30d' : 'Moy. 30j'}</div>
        <div style="font-family:var(--font-mono);font-size:18px;color:${classify(avgMonth).color};">${Math.round(avgMonth)}</div>
      </div>
    </div>
    <div style="margin-top:14px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;line-height:1.6;">
      💡 ${isEN
        ? '<strong>Contrarian signal</strong>: Buffett famously said "be fearful when others are greedy, and greedy when others are fearful". Extreme Fear (< 25) historically marked good entry zones; Extreme Greed (> 75) often preceded corrections.'
        : '<strong>Signal contrarien</strong> : Buffett disait "Sois craintif quand les autres sont avides, avide quand ils sont craintifs". Extreme Fear (< 25) a historiquement marqué de bonnes zones d\\u2019entrée ; Extreme Greed (> 75) a souvent précédé des corrections.'}
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">
      ${isEN ? 'Source: alternative.me (crypto). Equities F&G coming soon.' : 'Source : alternative.me (crypto). F&G actions à venir.'}
    </div>
  `;
}
