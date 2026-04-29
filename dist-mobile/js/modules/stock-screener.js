// Module 14 — Stock Screener avec vraie source d'univers FMP (si clé configurée)
import { $, toast } from '../core/utils.js';
import { SYSTEM_STOCK_SCREENER } from '../prompts/stock-screener.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';
import { getDataKey } from '../core/data-keys.js';

const MODULE_ID = 'stock-screener';

const SECTOR_OPTIONS = [
  '', 'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Consumer Defensive', 'Industrials', 'Energy', 'Utilities', 'Real Estate',
  'Basic Materials', 'Communication Services'
];

export function renderStockScreenerView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.stock-screener.label'), t('mod.stock-screener.desc'), { example: t('mod.stock-screener.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.stock-screener.criteria')}
        <span style="float:right;font-size:11px;font-family:var(--font-mono);color:${getDataKey('fmp')?'var(--accent-green)':'var(--text-muted)'};">
          ${getDataKey('fmp') ? '✓ FMP universe (real screener)' : '⚠ no FMP key — LLM-only mode'}
        </span>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">${t('mod.stock-screener.market_label')}</label><select id="ss-country" class="input"><option value="">All</option><option value="US">US</option><option value="FR">France</option><option value="DE">Germany</option><option value="UK">UK</option><option value="JP">Japan</option><option value="CN">China</option></select></div>
        <div class="field"><label class="field-label">Sector</label><select id="ss-sector" class="input">${SECTOR_OPTIONS.map(s => `<option value="${s}">${s||'All'}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">Style</label><select id="ss-style" class="input"><option>Quality value</option><option>Deep value</option><option>Growth (GARP)</option><option>High growth</option><option>Dividend aristocrats</option><option>Cyclicals oversold</option><option>Spin-offs / Special situations</option></select></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Market cap ≥ ($)</label><input id="ss-mcap-min" class="input" type="number" placeholder="ex: 1000000000 (1B)" /></div>
        <div class="field"><label class="field-label">Market cap ≤ ($)</label><input id="ss-mcap-max" class="input" type="number" placeholder="ex: 100000000000 (100B)" /></div>
        <div class="field"><label class="field-label">Beta ≤</label><input id="ss-beta" class="input" type="number" step="0.1" placeholder="ex: 1.2" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">P/E max</label><input id="ss-pe" class="input" type="number" step="1" placeholder="ex: 20" /></div>
        <div class="field"><label class="field-label">ROIC min (%)</label><input id="ss-roic" class="input" type="number" step="1" placeholder="ex: 15" /></div>
        <div class="field"><label class="field-label">FCF yield min (%)</label><input id="ss-fcf" class="input" type="number" step="0.5" placeholder="ex: 5" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Volume min</label><input id="ss-vol-min" class="input" type="number" placeholder="ex: 1000000" /></div>
        <div class="field"><label class="field-label">Dividend min ($)</label><input id="ss-div-min" class="input" type="number" step="0.1" /></div>
        <div class="field"><label class="field-label">Limit candidates</label><input id="ss-limit" class="input" type="number" value="30" /></div>
      </div>
      <div class="field"><label class="field-label">Notes / contraintes additionnelles</label><textarea id="ss-notes" class="textarea" rows="2"></textarea></div>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0;cursor:pointer;">
        <input type="checkbox" id="ss-web" /> Web search complémentaire (validation chiffres récents)
      </label>
      <button id="ss-run" class="btn-primary">${t('mod.stock-screener.run')}</button>
    </div>
    <div id="ss-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#ss-run').addEventListener('click', run);
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    $('#ss-country').value = 'FR'; $('#ss-style').value = 'Quality value';
    $('#ss-mcap-min').value = 1000000000; $('#ss-pe').value = 18; $('#ss-roic').value = 15;
  });
}

async function run() {
  const out = $('#ss-output');
  const d = {
    country: $('#ss-country').value, sector: $('#ss-sector').value, style: $('#ss-style').value,
    mcapMin: $('#ss-mcap-min').value, mcapMax: $('#ss-mcap-max').value, beta: $('#ss-beta').value,
    pe: $('#ss-pe').value, roic: $('#ss-roic').value, fcf: $('#ss-fcf').value,
    volMin: $('#ss-vol-min').value, divMin: $('#ss-div-min').value, limit: $('#ss-limit').value || 30,
    notes: $('#ss-notes').value, web: $('#ss-web').checked
  };

  // 1. Si clé FMP : fetch un univers réel matching les filtres
  let universe = [];
  let universeSource = '';
  if (getDataKey('fmp')) {
    out.innerHTML = `<div class="loading"><span class="spinner"></span> <span>Fetching FMP universe (filters → real candidates)…</span></div>`;
    try {
      const { fmpScreener } = await import('../core/data-providers/fmp.js');
      const filters = {
        country: d.country || undefined,
        sector: d.sector || undefined,
        marketCapMoreThan: d.mcapMin || undefined,
        marketCapLowerThan: d.mcapMax || undefined,
        betaLowerThan: d.beta || undefined,
        volumeMoreThan: d.volMin || undefined,
        dividendMoreThan: d.divMin || undefined,
        limit: d.limit,
        isActivelyTrading: 'true'
      };
      universe = await fmpScreener(filters);
      universeSource = `FMP screener returned ${universe.length} candidates matching filters`;
    } catch (e) {
      universeSource = `FMP screener failed (${e.message}) — fallback to LLM-only`;
    }
  } else {
    universeSource = 'No FMP key configured — LLM will work from its own knowledge (less precise)';
  }

  // 2. Build user message — pass universe to LLM for ranking/analysis
  let universeBlock = '';
  if (universe.length) {
    universeBlock = `\n\n[REAL UNIVERSE — ${universe.length} pre-filtered candidates from FMP screener, you should ANALYZE these (not invent others)]:\n` +
      universe.map(s => `- ${s.symbol} | ${s.name} | ${s.sector || '-'} | MCap $${(s.market_cap/1e9).toFixed(2)}B | β ${s.beta?.toFixed(2) || '?'} | $${s.price?.toFixed(2) || '?'} | Vol ${(s.volume/1e6).toFixed(1)}M`).join('\n') +
      '\n[/UNIVERSE]\n';
  }

  const userMsg = `Critères de screening :

- Country : ${d.country || 'all'}
- Sector : ${d.sector || 'all'}
- Style : ${d.style}
- Market cap : ${d.mcapMin || '?'} → ${d.mcapMax || '?'} USD
- Beta max : ${d.beta || 'no limit'}
- P/E max : ${d.pe || 'no limit'}
- ROIC min : ${d.roic || 'no limit'}%
- FCF yield min : ${d.fcf || 'no limit'}%
- Notes : ${d.notes || 'none'}

Source : ${universeSource}.${universeBlock}

${universe.length ? 'Identify the BEST candidates from the universe above. Score each on the criteria. Top 5 deep-dive.' : 'Identify candidates matching these criteria from your knowledge.'}`;

  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_STOCK_SCREENER,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      useWebSearch: d.web,
      recordInput: { ...d, universeCount: universe.length }
    }, out, { onTitle: () => `Screener · ${d.style} · ${d.country || 'global'} · ${universe.length} candidates` });
    toast('Screening done', 'success');
  } catch {}
}
