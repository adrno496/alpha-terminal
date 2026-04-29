// Demo mode : galerie des analyses pré-générées (zéro clé API requise)
import { $ } from '../core/utils.js';
import { DEMO_QUICK, formatDemoAsMarkdown } from '../core/demo-data.js';
import { showGenericModal } from './modal.js';
import { t } from '../core/i18n.js';

export function showDemoGallery() {
  const html = `
    <div class="demo-banner">
      <span class="demo-badge">DEMO MODE</span>
      <p style="margin:0;font-size:13px;color:var(--text-secondary);">
        ${t('qa.desc')}<br>
        <strong style="color:var(--accent-green);">${t('demo.no_api')}</strong>
      </p>
    </div>
    <div class="demo-gallery">
      ${DEMO_QUICK.map((d, i) => {
        const v = d.verdict;
        const color = v === 'BUY' ? 'var(--accent-green)' : v === 'SELL' ? 'var(--accent-red)' : 'var(--accent-amber)';
        const emoji = v === 'BUY' ? '🟢' : v === 'SELL' ? '🔴' : '🟡';
        const label = t('qa.verdict.' + v.toLowerCase());
        const sc = d.global_score;
        return `
          <div class="demo-card" data-i="${i}">
            <div class="demo-card-asset">${d.asset_name}</div>
            <div class="demo-card-verdict" style="color:${color};">
              <span style="font-size:24px;">${emoji}</span>
              <span>${label}</span>
            </div>
            <div class="demo-card-score">
              <div class="demo-score-num" style="color:${sc<40?'var(--accent-red)':sc<70?'var(--accent-amber)':'var(--accent-green)'};">${sc}</div>
              <div class="demo-score-label">${t('qa.global_score')}</div>
            </div>
            <div class="demo-card-cta">${t('demo.see_full')} →</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  showGenericModal('🎬 ' + t('demo.title'), html, { wide: true });

  document.querySelectorAll('.demo-card').forEach(c => c.addEventListener('click', () => {
    const i = +c.getAttribute('data-i');
    showDemoFullAnalysis(DEMO_QUICK[i]);
  }));
}

function showDemoFullAnalysis(demo) {
  const md = formatDemoAsMarkdown(demo);
  const html = window.marked ? window.marked.parse(md) : `<pre>${md}</pre>`;
  const v = demo.verdict;
  const color = v === 'BUY' ? 'var(--accent-green)' : v === 'SELL' ? 'var(--accent-red)' : 'var(--accent-amber)';
  const emoji = v === 'BUY' ? '🟢' : v === 'SELL' ? '🔴' : '🟡';
  const label = t('qa.verdict.' + v.toLowerCase());
  const sc = demo.global_score;
  const scoreColor = sc<40?'var(--accent-red)':sc<70?'var(--accent-amber)':'var(--accent-green)';

  const out = `
    <div class="qa-result">
      <div class="qa-verdict-banner" style="background:linear-gradient(135deg, ${color}22 0%, ${color}05 100%); border-color:${color};">
        <div class="qa-verdict-left">
          <div class="qa-verdict-emoji">${emoji}</div>
          <div>
            <div class="qa-verdict-label" style="color:${color};">${label}</div>
            <div class="qa-verdict-asset">${demo.asset_name}</div>
          </div>
        </div>
        <div class="qa-verdict-right">
          <div class="qa-score-ring" style="--score-color:${scoreColor};">
            <span class="qa-score-num">${sc}</span>
            <span class="qa-score-label">${t('qa.global_score')}</span>
          </div>
          <div class="qa-conviction">${t('qa.conviction')} <strong>${demo.conviction}/10</strong></div>
        </div>
      </div>
      <div class="qa-breakdown">
        ${Object.entries(demo.breakdown).map(([k, val]) => {
          const pct = +val;
          const c = pct < 40 ? 'red' : pct < 70 ? 'amber' : 'green';
          return `<div class="qa-breakdown-bar">
            <div class="qa-breakdown-label">${t('qa.bd.' + k) || k} <span class="qa-bd-val ${c}">${pct}</span></div>
            <div class="qa-bd-track"><div class="qa-bd-fill ${c}" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="qa-body result-body">${html}</div>
      <p style="text-align:center;margin-top:14px;color:var(--text-secondary);font-size:12.5px;">
        ${t('demo.upsell')} <strong style="color:var(--accent-green);">${t('demo.upsell_action')}</strong>
      </p>
    </div>
  `;
  showGenericModal('🎬 ' + demo.asset_name, out, { wide: true });
}
