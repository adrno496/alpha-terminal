// Module 00 — Quick Analysis : LA killer feature. Verdict BUY/SELL/HOLD + score 0-100 en 30s.
import { $, toast, safeJsonParse, fmtUSD } from '../core/utils.js';
import { analyzeStream } from '../core/api.js';
import { SYSTEM_QUICK_ANALYSIS, buildQuickPrompt } from '../prompts/quick-analysis.js';
import { saveAnalysis } from '../core/storage.js';
import { uuid } from '../core/utils.js';
import { downloadMarkdown, copyToClipboard } from '../core/export.js';
import { abortCurrentCall } from '../core/api.js';
import { moduleHeader, wireProviderSelector, getModuleOverride, isRagEnabledFor } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { safeRender } from '../core/safe-render.js';

const MODULE_ID = 'quick-analysis';

const EXAMPLES = [
  { label: 'AAPL', input: 'AAPL', type: 'stock' },
  { label: 'TSLA', input: 'TSLA', type: 'stock' },
  { label: 'NVDA', input: 'NVDA', type: 'stock' },
  { label: 'BTC', input: 'BTC', type: 'crypto' },
  { label: 'ETH', input: 'ETH', type: 'crypto' },
  { label: 'Portfolio', input: 'AAPL 40%, BTC 30%, GOLD 30%', type: 'portfolio' }
];

export function renderQuickAnalysisView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader('⚡ ' + t('qa.title'), t('qa.desc'), { moduleId: MODULE_ID })}

    <div class="quick-input-card">
      <div class="qa-mode-tabs">
        <button class="qa-tab active" data-mode="single">${t('qa.mode.single')}</button>
        <button class="qa-tab" data-mode="portfolio">${t('qa.mode.portfolio')}</button>
      </div>

      <div id="qa-single" class="qa-input-block">
        <input id="qa-input" class="input qa-big-input" placeholder="${t('qa.placeholder')}" autofocus />
        <div class="qa-examples">
          <span class="qa-examples-label">${t('qa.examples')} :</span>
          ${EXAMPLES.filter(e => e.type !== 'portfolio').map(e =>
            `<button class="qa-example-pill" data-ex="${e.input}" data-type="${e.type}">${e.label}</button>`
          ).join('')}
        </div>
      </div>

      <div id="qa-portfolio" class="qa-input-block hidden">
        <button id="qa-import-wealth" class="btn-primary" style="margin-bottom:10px;background:rgba(0,255,136,0.15);color:var(--accent-green);border:1px solid var(--accent-green);">📥 Importer mon patrimoine</button>
        <div id="qa-import-status" style="font-size:12px;color:var(--text-muted);margin-bottom:10px;"></div>
        <textarea id="qa-portfolio-input" class="textarea" rows="5" placeholder="${t('qa.portfolio.placeholder')}"></textarea>
        <div class="qa-examples">
          <button class="qa-example-pill" data-ex="AAPL 40%, NVDA 25%, BTC 20%, GOLD 15%" data-type="portfolio">${t('qa.example.tech_heavy')}</button>
          <button class="qa-example-pill" data-ex="VTI 60%, BND 30%, GLD 10%" data-type="portfolio">${t('qa.example.classic_60_40')}</button>
          <button class="qa-example-pill" data-ex="BTC 50%, ETH 30%, SOL 20%" data-type="portfolio">${t('qa.example.crypto_heavy')}</button>
        </div>
      </div>

      <button id="qa-run" class="btn-primary qa-run-btn">${t('qa.run')}</button>

      <div class="qa-trust-row">
        <span data-tt-text="${t('trust.private')}">🔒 ${t('trust.private_short')}</span>
        <span data-tt-text="${t('trust.byok')}">🔑 ${t('trust.byok_short')}</span>
        <span data-tt-text="${t('trust.no_subscription')}">💳 ${t('trust.no_subscription_short')}</span>
      </div>
    </div>

    <div id="qa-output"></div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);

  // Mode tabs
  viewEl.querySelectorAll('.qa-tab').forEach(b => b.addEventListener('click', () => {
    const mode = b.getAttribute('data-mode');
    viewEl.querySelectorAll('.qa-tab').forEach(x => x.classList.toggle('active', x === b));
    $('#qa-single').classList.toggle('hidden', mode !== 'single');
    $('#qa-portfolio').classList.toggle('hidden', mode !== 'portfolio');
  }));

  // Examples
  viewEl.querySelectorAll('.qa-example-pill').forEach(p => p.addEventListener('click', () => {
    const ex = p.getAttribute('data-ex');
    const type = p.getAttribute('data-type');
    if (type === 'portfolio') {
      $('#qa-portfolio-input').value = ex;
      viewEl.querySelectorAll('.qa-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === 'portfolio'));
      $('#qa-single').classList.add('hidden');
      $('#qa-portfolio').classList.remove('hidden');
    } else {
      $('#qa-input').value = ex;
    }
    run();
  }));

  $('#qa-run').addEventListener('click', run);
  $('#qa-input').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

  // Import all wealth → format as portfolio string + auto-switch to portfolio mode
  const importBtn = $('#qa-import-wealth');
  if (importBtn) importBtn.addEventListener('click', importMyWealth);
}

async function importMyWealth() {
  const status = $('#qa-import-status');
  const ta = $('#qa-portfolio-input');
  try {
    const { listWealth } = await import('../core/wealth.js');
    const list = await listWealth();
    if (!list.length) {
      status.innerHTML = `<span style="color:var(--accent-orange);">⚠️ Aucune ligne dans ton patrimoine. Va dans 💼 Patrimoine pour en ajouter.</span>`;
      return;
    }
    const total = list.reduce((s, h) => s + (Number(h.value) || 0), 0);
    if (total <= 0) {
      status.innerHTML = `<span style="color:var(--accent-orange);">⚠️ Patrimoine sans valeur. Vérifie les valorisations dans 💼 Patrimoine.</span>`;
      return;
    }
    // Format : "Name [Ticker] X% (compte) [catégorie]"
    const lines = list
      .filter(h => (Number(h.value) || 0) > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .map(h => {
        const pct = ((h.value / total) * 100).toFixed(2);
        const name = h.name || h.ticker || '?';
        const tk = h.ticker && h.ticker !== name ? ` [${h.ticker}]` : '';
        const acc = h.account ? ` · ${h.account}` : '';
        const cat = h.category ? ` (${h.category})` : '';
        return `${name}${tk} ${pct}%${acc}${cat}`;
      });
    ta.value = lines.join('\n');
    status.innerHTML = `<span style="color:var(--accent-green);">✅ ${lines.length} positions importées · Total ${Math.round(total).toLocaleString('fr-FR')} € · Clique <strong>${t('qa.run')}</strong> pour analyser.</span>`;
    ta.focus();
  } catch (e) {
    status.innerHTML = `<span style="color:var(--accent-red);">Erreur: ${e.message}</span>`;
  }
}

async function run() {
  const out = $('#qa-output');
  const isPortfolio = !$('#qa-portfolio').classList.contains('hidden');
  const input = isPortfolio ? $('#qa-portfolio-input').value.trim() : $('#qa-input').value.trim();
  if (!input) { toast(t('qa.input_required'), 'warning'); return; }

  const type = isPortfolio ? 'portfolio' : 'auto';
  const lang = getLocale() === 'en' ? 'English' : 'français';
  const sys = SYSTEM_QUICK_ANALYSIS.replace('${LANG}', lang)
    .replace('${VERDICT_EMOJI}', '<emoji from verdict>')
    .replace('${VERDICT_LABEL}', '<label from verdict>');

  // UI loading state
  out.innerHTML = `
    <div class="qa-loading">
      <div class="spinner"></div>
      <div class="qa-loading-text">${t('qa.analyzing')} <strong>${escapeHtml(input.slice(0, 60))}</strong>…</div>
      <button class="btn-ghost" id="qa-abort">${t('common.cancel')}</button>
    </div>
  `;
  $('#qa-abort').addEventListener('click', () => abortCurrentCall());

  let userMsg = buildQuickPrompt(input, type);

  // Wealth context si toggle ON pour quick-analysis
  try {
    const { isWealthContextEnabledFor, buildWealthContext } = await import('../core/wealth.js');
    if (isWealthContextEnabledFor(MODULE_ID)) {
      const wb = await buildWealthContext('EUR');
      if (wb) userMsg = wb + userMsg;
    }
  } catch {}

  // Auto-inject data context (FMP / Alpha Vantage / CoinGecko / FRED) — économise web_search
  let dataContextInjected = false;
  try {
    const { fetchDataContext, formatContextAsText, hasAnyDataKey } = await import('../core/data-context.js');
    if (hasAnyDataKey() || !isPortfolio) {
      const ctx = await fetchDataContext({ moduleId: MODULE_ID, input, type: isPortfolio ? 'portfolio' : 'auto' });
      if (ctx) {
        const block = formatContextAsText(ctx);
        if (block) {
          userMsg = block + userMsg;
          dataContextInjected = true;
        }
      }
    }
  } catch (e) { console.warn('Quick Analysis data context skipped:', e.message); }

  let fullText = '';
  try {
    const result = await analyzeStream(MODULE_ID, {
      system: sys,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 3000,
      // Si data déjà injectée, on peut désactiver web_search (ÉCONOMIE !)
      useWebSearch: !isPortfolio && !dataContextInjected,
      override: getModuleOverride(MODULE_ID)
    }, {
      onDelta: (_c, full) => { fullText = full; }
    });

    const txt = result.text || fullText;
    renderQuickResult(out, input, txt, result, isPortfolio);

    // Save
    const id = uuid();
    saveAnalysis({
      id, module: MODULE_ID,
      title: `Quick · ${input.slice(0, 50)}`,
      input: { input, type, isPortfolio },
      output: txt,
      usage: { ...result.usage, costUSD: result.costUSD, model: result.model, provider: result.provider },
      createdAt: new Date().toISOString(),
      starred: false
    }).catch(()=>{});
  } catch (e) {
    out.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

function renderQuickResult(out, input, text, apiResult, isPortfolio) {
  // Extract JSON header
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  const data = jsonMatch ? safeJsonParse(jsonMatch[1]) : null;
  const md = jsonMatch ? text.slice(text.indexOf('```', jsonMatch.index + 7) + 3).trim() : text;

  const verdict = (data?.verdict || 'HOLD').toUpperCase();
  const VERDICT_INFO = {
    BUY:  { color: '#00ff88', emoji: '🟢', labelKey: 'qa.verdict.buy' },
    SELL: { color: '#ff3355', emoji: '🔴', labelKey: 'qa.verdict.sell' },
    HOLD: { color: '#ffaa00', emoji: '🟡', labelKey: 'qa.verdict.hold' }
  };
  const v = VERDICT_INFO[verdict] || VERDICT_INFO.HOLD;

  const score = Math.max(0, Math.min(100, parseInt(data?.global_score, 10) || 50));
  const conviction = parseInt(data?.conviction, 10) || 0;
  const scoreColor = score < 40 ? '#ff3355' : score < 70 ? '#ffaa00' : '#00ff88';
  const breakdown = data?.score_breakdown || {};

  const html = safeRender(md || '');

  out.innerHTML = `
    <div class="qa-result">
      <div class="qa-verdict-banner" style="background:linear-gradient(135deg, ${v.color}22 0%, ${v.color}05 100%); border-color:${v.color};">
        <div class="qa-verdict-left">
          <div class="qa-verdict-emoji">${v.emoji}</div>
          <div>
            <div class="qa-verdict-label" style="color:${v.color};">${t(v.labelKey)}</div>
            <div class="qa-verdict-asset">${escapeHtml(data?.asset_name || input)}</div>
          </div>
        </div>
        <div class="qa-verdict-right">
          <div class="qa-score-ring" style="--score: ${score}; --score-color: ${scoreColor};">
            <span class="qa-score-num">${score}</span>
            <span class="qa-score-label">${t('qa.global_score')}</span>
          </div>
          ${conviction ? `<div class="qa-conviction">${t('qa.conviction')} <strong>${conviction}/10</strong></div>` : ''}
        </div>
      </div>

      ${Object.keys(breakdown).length ? `
      <div class="qa-breakdown">
        ${Object.entries(breakdown).map(([k, val]) => {
          const pct = Math.max(0, Math.min(100, +val || 0));
          const c = pct < 40 ? 'red' : pct < 70 ? 'amber' : 'green';
          return `
            <div class="qa-breakdown-bar">
              <div class="qa-breakdown-label">${t('qa.bd.' + k) || k} <span class="qa-bd-val ${c}">${pct}</span></div>
              <div class="qa-bd-track"><div class="qa-bd-fill ${c}" style="width:${pct}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>` : ''}

      <div class="qa-body result-body">${html}</div>

      <div class="qa-actions">
        <button class="btn-ghost" data-act="copy">${t('common.copy')}</button>
        <button class="btn-ghost" data-act="md">${t('common.export_md')}</button>
        <button class="btn-ghost" data-act="redo">↻ ${t('qa.redo')}</button>
        <span class="qa-meta">${apiResult.providerDisplay || apiResult.provider} · ${apiResult.model} · ${fmtUSD(apiResult.costUSD || 0)}</span>
      </div>
    </div>
  `;

  out.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
    await copyToClipboard(text);
    e.currentTarget.textContent = '✓';
    setTimeout(() => e.currentTarget.textContent = t('common.copy'), 800);
  });
  out.querySelector('[data-act="md"]').addEventListener('click', () => {
    downloadMarkdown(`quick-${input.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.md`, text);
  });
  out.querySelector('[data-act="redo"]').addEventListener('click', () => run());
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
