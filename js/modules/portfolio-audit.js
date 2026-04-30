// Module — Portfolio Audit (Buffett-style deep audit, distinct from Rebalancer)
import { $, toast } from '../core/utils.js';
import { SYSTEM_PORTFOLIO_AUDIT, SYSTEM_PORTFOLIO_AUDIT_EN } from '../prompts/portfolio-audit.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import { listWealth } from '../core/wealth.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'portfolio-audit';

export function renderPortfolioAuditView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.portfolio-audit.label'), t('mod.portfolio-audit.desc'), { example: t('mod.portfolio-audit.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.portfolio-audit.source_title')}</div>
      <div class="audit-tabs" style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="btn-ghost active" data-audit-tab="wealth">${t('mod.portfolio-audit.tab_wealth')}</button>
        <button class="btn-ghost" data-audit-tab="manual">${t('mod.portfolio-audit.tab_manual')}</button>
      </div>

      <div data-audit-pane="wealth">
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">${t('mod.portfolio-audit.wealth_help')}</p>
        <button id="audit-import-wealth" class="btn-ghost">${t('mod.portfolio-audit.import_wealth')}</button>
        <div id="audit-wealth-summary" style="margin-top:10px;font-size:12px;color:var(--text-secondary);"></div>
      </div>

      <div data-audit-pane="manual" style="display:none;">
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">${t('mod.portfolio-audit.manual_help')}</p>
        <textarea id="audit-manual" class="input" rows="8" placeholder="AAPL: 50 @ 180 USD (sector: tech)
MSFT: 30 @ 420 USD (sector: tech)
SAN.PA: 100 @ 15 EUR (sector: industrials)
BTC: 0.5 @ 95000 USD (sector: crypto)"></textarea>
      </div>

      <div class="field-row" style="margin-top:12px;">
        <div class="field"><label class="field-label">${t('mod.portfolio-audit.base_ccy')}</label>
          <select id="audit-ccy" class="input"><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option></select>
        </div>
        <div class="field"><label class="field-label">${t('mod.portfolio-audit.profile')}</label>
          <select id="audit-profile" class="input">
            <option value="long_term">${t('mod.portfolio-audit.profile_lt')}</option>
            <option value="balanced">${t('mod.portfolio-audit.profile_bal')}</option>
            <option value="aggressive">${t('mod.portfolio-audit.profile_agg')}</option>
          </select>
        </div>
      </div>

      <div class="field" style="margin-top:8px;">
        <label class="field-label">${t('mod.portfolio-audit.context')}</label>
        <textarea id="audit-context" class="input" rows="2" placeholder="${t('mod.portfolio-audit.context_placeholder')}"></textarea>
      </div>

      <button id="audit-run" class="btn-primary" style="margin-top:12px;">${t('mod.portfolio-audit.run')}</button>
    </div>
    <div id="audit-output" style="margin-top:18px;"></div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);
  bindDraft(MODULE_ID, 'audit-manual');
  bindDraft(MODULE_ID, 'audit-context');

  // Tabs
  viewEl.querySelectorAll('[data-audit-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      viewEl.querySelectorAll('[data-audit-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-audit-tab');
      viewEl.querySelectorAll('[data-audit-pane]').forEach(p => {
        p.style.display = p.getAttribute('data-audit-pane') === tab ? '' : 'none';
      });
    });
  });

  $('#audit-import-wealth').addEventListener('click', importFromWealth);
  $('#audit-run').addEventListener('click', run);

  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => {
    viewEl.querySelector('[data-audit-tab="manual"]').click();
    $('#audit-manual').value = `AAPL: 50 @ 180 USD (sector: tech)
MSFT: 30 @ 420 USD (sector: tech)
NVDA: 20 @ 145 USD (sector: tech)
SAN.PA: 100 @ 15 EUR (sector: industrials)
LVMH.PA: 5 @ 700 EUR (sector: luxury)
BTC: 0.5 @ 95000 USD (sector: crypto)`;
  });
}

async function importFromWealth() {
  const out = $('#audit-wealth-summary');
  try {
    const list = await listWealth();
    const investable = list.filter(h => h.value > 0);
    if (!investable.length) {
      out.innerHTML = `<span style="color:var(--accent-amber);">${t('mod.portfolio-audit.wealth_empty')}</span>`;
      return;
    }
    const total = investable.reduce((s, h) => s + (h.value || 0), 0);
    const top = [...investable].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);
    out.innerHTML = `
      <div><strong>${investable.length}</strong> ${t('mod.portfolio-audit.positions_loaded')} · ${t('mod.portfolio-audit.total')}: ~${total.toLocaleString('fr-FR')}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Top: ${top.map(h => h.ticker || h.name).join(', ')}</div>
    `;
    out.dataset.imported = '1';
  } catch (e) {
    out.innerHTML = `<span style="color:var(--accent-red);">Erreur: ${e.message}</span>`;
  }
}

// Tolerant parser for manual input
// Accepts:
//   AAPL: 50 @ 180 USD (sector: tech, conviction: 4)
//   AAPL 50 180 USD
//   AAPL, 50, 180, USD, tech
function parseManualLine(line) {
  const orig = line.trim();
  if (!orig || orig.startsWith('#') || orig.startsWith('//')) return null;

  // Extract sector / notes from parenthesis
  let sector = '';
  let conviction = '';
  const parenMatch = orig.match(/\(([^)]+)\)/);
  let body = orig;
  if (parenMatch) {
    body = orig.replace(parenMatch[0], '').trim();
    const inner = parenMatch[1].toLowerCase();
    const sm = inner.match(/sector\s*[:=]\s*([\w\s\-\/&]+)/);
    if (sm) sector = sm[1].trim();
    const cm = inner.match(/conviction\s*[:=]\s*(\d)/);
    if (cm) conviction = cm[1];
  }

  // Extract ticker (first word, possibly with .PA / .L)
  const tickerMatch = body.match(/^([A-Z][A-Z0-9.\-]{0,15})\s*[:,]?\s*/i);
  if (!tickerMatch) return null;
  const ticker = tickerMatch[1].toUpperCase();
  const rest = body.slice(tickerMatch[0].length).trim();

  // Find numbers
  const numbers = rest.match(/[\d.,]+/g) || [];
  if (numbers.length < 2) return null;
  const qty = parseFloat(numbers[0].replace(/,/g, ''));
  const price = parseFloat(numbers[1].replace(/,/g, ''));
  if (isNaN(qty) || isNaN(price)) return null;

  // Currency
  const ccyMatch = rest.match(/\b(USD|EUR|GBP|CHF|JPY|CAD|AUD)\b/i);
  const currency = ccyMatch ? ccyMatch[1].toUpperCase() : 'USD';

  return {
    ticker,
    quantity: qty,
    unitPrice: price,
    value: qty * price,
    currency,
    sector,
    conviction
  };
}

async function run() {
  const out = $('#audit-output');
  const baseCcy = $('#audit-ccy').value;
  const profile = $('#audit-profile').value;
  const context = $('#audit-context').value.trim();

  let positions = [];
  const importedFromWealth = $('#audit-wealth-summary').dataset.imported === '1';
  const visibleTab = document.querySelector('[data-audit-tab].active')?.getAttribute('data-audit-tab') || 'wealth';

  if (visibleTab === 'wealth' || importedFromWealth) {
    const list = await listWealth();
    const investable = list.filter(h => h.value > 0);
    positions = investable.map(h => ({
      ticker: h.ticker || h.name,
      name: h.name,
      quantity: h.quantity || 0,
      unitPrice: h.unitPrice || h.lastPrice || (h.quantity ? (h.value / h.quantity) : null),
      value: h.value || 0,
      currency: h.currency || 'EUR',
      category: h.category,
      sector: h.notes?.toLowerCase().includes('sector:') ? h.notes.split('sector:')[1].split(/[,;]/)[0].trim() : ''
    }));
  } else {
    const text = $('#audit-manual').value;
    positions = text.split(/\r?\n/).map(parseManualLine).filter(Boolean);
  }

  if (!positions.length) {
    out.innerHTML = `<div class="alert alert-danger">${t('mod.portfolio-audit.no_positions')}</div>`;
    return;
  }

  // Local pre-computation
  const total = positions.reduce((s, p) => s + (p.value || 0), 0);
  const sorted = [...positions].sort((a, b) => (b.value || 0) - (a.value || 0));
  const top3 = sorted.slice(0, 3);
  const top3Pct = total > 0 ? (top3.reduce((s, p) => s + p.value, 0) / total * 100) : 0;

  const bySector = {};
  const byCurrency = {};
  for (const p of positions) {
    const sec = p.sector || p.category || 'unknown';
    bySector[sec] = (bySector[sec] || 0) + p.value;
    byCurrency[p.currency] = (byCurrency[p.currency] || 0) + p.value;
  }

  // HHI (Herfindahl) — concentration index
  const hhi = total > 0 ? positions.reduce((s, p) => s + Math.pow(p.value / total * 100, 2), 0) : 0;

  // Build context block for the LLM
  const positionsBlock = sorted.map(p => {
    const pct = total > 0 ? (p.value / total * 100).toFixed(1) : '0';
    return `- ${p.ticker}${p.name && p.name !== p.ticker ? ' (' + p.name + ')' : ''}: ${p.quantity} × ${p.unitPrice || '?'} ${p.currency} = ${p.value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${p.currency} [${pct}%]${p.sector ? ' · sector: ' + p.sector : ''}${p.conviction ? ' · conviction: ' + p.conviction + '/5' : ''}`;
  }).join('\n');

  const sectorsBlock = Object.entries(bySector)
    .sort((a, b) => b[1] - a[1])
    .map(([s, v]) => `  - ${s}: ${(v / total * 100).toFixed(1)}%`)
    .join('\n');

  const currenciesBlock = Object.entries(byCurrency)
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `  - ${c}: ${(v / total * 100).toFixed(1)}%`)
    .join('\n');

  const profileLabels = {
    long_term: 'Investisseur long terme (>5 ans)',
    balanced: 'Profil équilibré (2-5 ans)',
    aggressive: 'Profil agressif (croissance, court-moyen terme)'
  };

  const userMsg = `Audite ce portefeuille en détail.

## INPUTS

- **Devise de base** : ${baseCcy}
- **Profil** : ${profileLabels[profile] || profile}
- **Total estimé** : ~${total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${baseCcy}
- **Nombre de positions** : ${positions.length}

## STATS LOCALES PRÉ-CALCULÉES

- Top 3 = ${top3Pct.toFixed(1)}% du portefeuille
- HHI (Herfindahl) = ${hhi.toFixed(0)} ${hhi > 2500 ? '(très concentré)' : hhi > 1500 ? '(concentré)' : '(diversifié)'}

## POSITIONS DÉTAILLÉES

${positionsBlock}

## RÉPARTITION SECTEURS

${sectorsBlock}

## RÉPARTITION DEVISES

${currenciesBlock}

${context ? `## CONTEXTE UTILISATEUR\n\n${context}\n` : ''}

Suis le format de réponse imposé. Sois honnête et précis. Donne le score final.`;

  try {
    const isEn = getLocale() === 'en';
    await runAnalysis(MODULE_ID, {
      system: isEn ? SYSTEM_PORTFOLIO_AUDIT_EN : SYSTEM_PORTFOLIO_AUDIT,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      recordInput: { positions, total, top3Pct, hhi, profile, baseCcy, context }
    }, out, { onTitle: () => `Audit · ${positions.length} positions · ${baseCcy}` });
    toast(t('mod.portfolio-audit.toast_done'), 'success');
  } catch {}
}
