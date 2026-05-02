// Module : veille actualités financières & macro via NewsAPI.
// Sentiment lexical (pas LLM). Cache de session uniquement.
import { $ , escHtml, fmtRelative } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';
import { newsSearch, newsTopHeadlines } from '../core/data-providers/newsapi.js';
import { getDataKey } from '../core/data-keys.js';

const MODULE_ID = 'news-feed';

const PRESET_QUERIES = [
  { id: 'crypto', label: 'Crypto / Bitcoin', q: 'bitcoin OR ethereum OR cryptocurrency' },
  { id: 'fed', label: 'Fed / taux US', q: 'federal reserve OR fed funds OR interest rates' },
  { id: 'gold', label: 'Or / inflation', q: 'gold price OR inflation OR cpi' },
  { id: 'geo', label: 'Géopolitique', q: 'iran israel OR russia ukraine OR taiwan china' },
  { id: 'tech', label: 'Tech / IA', q: 'AI artificial intelligence OR semiconductor OR nvidia' },
  { id: 'commodities', label: 'Pétrole / matières premières', q: 'oil price OR opec OR energy' }
];

export async function renderNewsFeedView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('📰 News', isEN ? 'Financial & macro news watch via NewsAPI. Lexical sentiment included.' : 'Veille actualités financières & macro via NewsAPI. Sentiment lexical inclus.', { moduleId: MODULE_ID })}

    <div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">
        <select id="news-preset" class="input" style="font-size:13px;">
          <option value="">— ${isEN ? 'Custom search' : 'Recherche libre'} —</option>
          ${PRESET_QUERIES.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
          <option value="__top">${isEN ? '🌐 Top headlines' : '🌐 Top headlines'}</option>
        </select>
        <input id="news-query" class="input" type="text" placeholder="${isEN ? 'e.g. bitcoin etf' : 'ex: bitcoin etf'}" style="flex:1;min-width:200px;font-size:13px;" />
        <select id="news-days" class="input" style="font-size:13px;">
          <option value="1">${isEN ? '1 day' : '1 jour'}</option>
          <option value="3">3 ${isEN ? 'days' : 'jours'}</option>
          <option value="7" selected>7 ${isEN ? 'days' : 'jours'}</option>
          <option value="30">30 ${isEN ? 'days' : 'jours'}</option>
        </select>
        <button id="news-go" class="btn-primary">🔄 ${isEN ? 'Search' : 'Chercher'}</button>
      </div>
      <div id="news-meta" style="font-size:12px;color:var(--text-muted);"></div>
    </div>

    <div id="news-results"></div>
  `;

  // Si la clé n'est pas configurée, on guide l'utilisateur sans crash
  if (!getDataKey('newsapi')) {
    $('#news-results').innerHTML = `
      <div class="card" style="border-left:3px solid var(--accent-amber);">
        <div style="font-size:13px;line-height:1.6;">
          ⚠️ <strong>${isEN ? 'NewsAPI key required' : 'Clé NewsAPI requise'}</strong><br>
          ${isEN ? 'Add your NewsAPI key in' : 'Ajoute ta clé NewsAPI dans'} <a href="#settings/data-keys" style="color:var(--accent-green);">Settings → Données</a>.
          ${isEN ? 'Free at' : 'Gratuit sur'} <a href="https://newsapi.org/register" target="_blank" rel="noopener">newsapi.org</a> (1000 ${isEN ? 'req/day' : 'req/jour'}).
        </div>
      </div>
    `;
    return;
  }

  $('#news-preset').addEventListener('change', (e) => {
    const v = e.target.value;
    if (!v) return;
    if (v === '__top') {
      $('#news-query').value = '';
    } else {
      const p = PRESET_QUERIES.find(x => x.id === v);
      if (p) $('#news-query').value = p.q;
    }
  });

  $('#news-go').addEventListener('click', () => doSearch(viewEl));

  // Première recherche par défaut
  $('#news-preset').value = 'crypto';
  $('#news-query').value = PRESET_QUERIES[0].q;
  await doSearch(viewEl);
}

async function doSearch(viewEl) {
  const isEN = getLocale() === 'en';
  const preset = $('#news-preset').value;
  const query = $('#news-query').value.trim();
  const days = parseInt($('#news-days').value, 10) || 7;
  const meta = $('#news-meta');
  const out = $('#news-results');
  const btn = $('#news-go');

  meta.textContent = isEN ? '⏳ Loading…' : '⏳ Chargement…';
  out.innerHTML = '';
  btn.disabled = true;

  try {
    let res;
    if (preset === '__top') {
      res = await newsTopHeadlines({ category: 'business', limit: 20 });
      meta.textContent = `${res.articles.length} ${isEN ? 'top headlines' : 'top headlines'} · ${sentimentBadge(res.overallSentiment)}`;
    } else {
      if (!query) { meta.textContent = isEN ? 'Enter a query.' : 'Saisis une recherche.'; btn.disabled = false; return; }
      res = await newsSearch(query, { limit: 20, days });
      meta.textContent = `${res.articles.length}/${res.total} ${isEN ? 'articles' : 'articles'} · "${query}" · ${sentimentBadge(res.overallSentiment)}`;
    }

    out.innerHTML = `<div class="card" style="padding:0;">
      ${res.articles.map(a => renderArticle(a, isEN)).join('')}
    </div>`;
  } catch (e) {
    out.innerHTML = `<div class="card" style="border-left:3px solid var(--accent-red);font-size:13px;color:var(--accent-red);">❌ ${escHtml(e?.message || 'Erreur NewsAPI')}</div>`;
    meta.textContent = '';
  } finally {
    btn.disabled = false;
  }
}

function sentimentBadge(s) {
  if (s === 'BULLISH') return '<span style="color:#4CAF50;">📈 BULLISH</span>';
  if (s === 'BEARISH') return '<span style="color:#f44336;">📉 BEARISH</span>';
  return '<span style="color:var(--text-muted);">⚪ NEUTRAL</span>';
}

function renderArticle(a, isEN) {
  const sentColor = a.sentiment === 'BULLISH' ? '#4CAF50' : a.sentiment === 'BEARISH' ? '#f44336' : 'var(--text-muted)';
  const sentLabel = a.sentiment === 'BULLISH' ? '📈' : a.sentiment === 'BEARISH' ? '📉' : '⚪';
  return `
    <a href="${escHtml(a.url)}" target="_blank" rel="noopener" style="display:block;padding:12px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:var(--text-primary);">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${a.image ? `<img src="${escHtml(a.image)}" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;" loading="lazy" />` : ''}
        <div style="flex:1;min-width:0;">
          <div style="font-size:13.5px;font-weight:600;line-height:1.35;color:var(--text-primary);">
            <span style="color:${sentColor};margin-right:4px;">${sentLabel}</span>${escHtml(a.title || '')}
          </div>
          ${a.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">${escHtml(a.description.slice(0, 200))}${a.description.length > 200 ? '…' : ''}</div>` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
            <strong>${escHtml(a.source)}</strong> · ${escHtml(fmtRelative(a.publishedAt))}
          </div>
        </div>
      </div>
    </a>
  `;
}
