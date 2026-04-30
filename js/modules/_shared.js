// Helpers partagés par les modules : streaming + save + export + provider selector toolbar
import { uuid, fmtUSD } from '../core/utils.js';
import { saveAnalysis, getSettings, setSettings } from '../core/storage.js';
import { downloadMarkdown, copyToClipboard, printAnalysis, downloadAnalysisPdf } from '../core/export.js';
import { safeRender } from '../core/safe-render.js';
import { getModuleById } from '../ui/sidebar.js';
import { abortCurrentCall, analyzeStream, getOrchestrator, isConnected } from '../core/api.js';
import { t } from '../core/i18n.js';

// Loading rich state
export function showLoading(el, message = 'Analyzing...', { showAbort = true } = {}) {
  el.innerHTML = `
    <div class="loading-rich">
      <div class="loading-row">
        <span class="spinner"></span>
        <span class="loading-msg">${message}</span>
      </div>
      ${showAbort ? `<button class="btn-ghost loading-abort">${t('common.cancel')}</button>` : ''}
    </div>
  `;
  if (showAbort) el.querySelector('.loading-abort').addEventListener('click', () => {
    abortCurrentCall();
    el.innerHTML = '<div class="alert alert-warning">Requête annulée.</div>';
  });
}

// Crée un container pour streaming markdown progressif
export function prepareStreamContainer(container, module, _title) {
  const id = uuid();
  const mod = getModuleById(module);
  container.innerHTML = `
    <div class="result streaming">
      <div class="result-toolbar">
        <span class="result-meta">${mod ? mod.label : module} · <span class="provider-pill"></span><span class="streaming-status">${t('common.streaming')}</span></span>
        <span class="result-actions">
          <button class="btn-ghost" data-act="abort">${t('common.cancel')}</button>
        </span>
      </div>
      <div class="result-body" data-stream></div>
    </div>
  `;
  container.querySelector('[data-act="abort"]').addEventListener('click', () => abortCurrentCall());
  return {
    id,
    body: container.querySelector('[data-stream]'),
    setMd: (md) => {
      container.querySelector('[data-stream]').innerHTML = safeRender(md);
    },
    setStatus: (text) => {
      const s = container.querySelector('.streaming-status');
      if (s) s.textContent = text;
    },
    setProvider: (sel) => {
      const pill = container.querySelector('.provider-pill');
      if (!pill) return;
      pill.innerHTML = `<span class="prov-ic">${sel.provider.icon}</span> ${sel.provider.displayName} · ${sel.model} ${sel.isOptimal ? '<span style="color:var(--accent-green);">✓ optimal</span>' : '<span style="color:var(--accent-amber);">⚠ fallback</span>'} · `;
    }
  };
}

export function finalizeStream({ container, streamHandle, module, title, markdown, usage, provider, providerDisplay, isOptimal, model, inputForRecord }) {
  const id = streamHandle?.id || uuid();
  const createdAt = new Date().toISOString();
  const mod = getModuleById(module);
  const html = safeRender(markdown || '');
  const usageStr = usage
    ? `${(usage.input || 0).toLocaleString()} in / ${(usage.output || 0).toLocaleString()} out · ${fmtUSD(usage.costUSD || 0)}`
    : '';
  const provPill = provider ? `<span class="prov-ic">${providerIcon(provider)}</span> ${providerDisplay || provider}${model ? ' · ' + model : ''}${isOptimal ? '' : ' · ⚠ fallback'} · ` : '';

  container.innerHTML = `
    <div class="result">
      <div class="result-toolbar">
        <span class="result-meta">${mod ? mod.label : module} · ${provPill}${usageStr}</span>
        <span class="result-actions">
          <button class="btn-ghost" data-act="copy">${t('common.copy')}</button>
          <button class="btn-ghost" data-act="md">${t('common.export_md')}</button>
          <button class="btn-ghost" data-act="pdf" title="${t('common.export_pdf_tip')}">${t('common.export_pdf')}</button>
          <button class="btn-ghost" data-act="print" title="${t('common.print_pdf_tip')}">${t('common.print_pdf')}</button>
        </span>
      </div>
      <div class="result-body">${html}</div>
    </div>
  `;
  const record = {
    id, module,
    title: title || `${mod ? mod.label : module} · ${new Date().toLocaleString('fr-FR')}`,
    input: inputForRecord || {},
    output: markdown || '',
    usage: usage ? { ...usage, model, provider } : null,
    createdAt,
    starred: false
  };
  saveAnalysis(record).catch(err => console.error('Save failed:', err));
  wireToolbar(container, record);
  return record;
}

// Back-compat helpers
export function renderResult(args) { return finalizeStream(args); }
export function renderExistingResult(container, record) {
  const mod = getModuleById(record.module);
  const html = safeRender(record.output || '');
  const usage = record.usage;
  const usageStr = usage
    ? `${(usage.input||0).toLocaleString()} in / ${(usage.output||0).toLocaleString()} out · ${fmtUSD(usage.costUSD||0)}`
    : '';
  const provider = usage?.provider;
  const provPill = provider ? `<span class="prov-ic">${providerIcon(provider)}</span> ${provider} · ` : '';
  container.innerHTML = `
    <div class="result">
      <div class="result-toolbar">
        <span class="result-meta">${mod ? mod.label : record.module} · ${new Date(record.createdAt).toLocaleString('fr-FR')} · ${provPill}${usageStr}</span>
        <span class="result-actions">
          <button class="btn-ghost" data-act="copy">${t('common.copy')}</button>
          <button class="btn-ghost" data-act="md">${t('common.export_md')}</button>
          <button class="btn-ghost" data-act="pdf" title="${t('common.export_pdf_tip')}">${t('common.export_pdf')}</button>
          <button class="btn-ghost" data-act="print" title="${t('common.print_pdf_tip')}">${t('common.print_pdf')}</button>
        </span>
      </div>
      <div class="result-body">${html}</div>
    </div>
  `;
  wireToolbar(container, record);
}

function providerIcon(name) {
  return ({
    claude: '🤖', openai: '🧠', gemini: '✨', grok: '🐦',
    openrouter: '🌀', perplexity: '🔎',
    mistral: '🇫🇷', cerebras: '⚡', github: '🐙', nvidia: '🟢',
    huggingface: '🤗', cloudflare: '☁️', together: '🟣', cohere: '🟦'
  })[name] || '·';
}

function wireToolbar(container, record) {
  const c = container.querySelector('[data-act="copy"]');
  if (c) c.addEventListener('click', async (e) => { await copyToClipboard(record.output); flashBtn(e.currentTarget, 'OK'); });
  const m = container.querySelector('[data-act="md"]');
  if (m) m.addEventListener('click', () => downloadMarkdown(`${record.module}-${record.id.slice(0, 8)}.md`, record.output));
  const p = container.querySelector('[data-act="print"]');
  if (p) p.addEventListener('click', () => printAnalysis({ title: record.title, module: record.module, createdAt: record.createdAt, markdown: record.output }));
  const pdf = container.querySelector('[data-act="pdf"]');
  if (pdf) pdf.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const old = btn.textContent;
    btn.textContent = '⏳ ' + t('common.generating');
    btn.disabled = true;
    try {
      await downloadAnalysisPdf({
        title: record.title, module: record.module, createdAt: record.createdAt, markdown: record.output
      });
      btn.textContent = '✓ PDF';
      setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1200);
    } catch (err) {
      btn.textContent = old; btn.disabled = false;
      console.error(err);
      // Fallback : print dialog si html2pdf KO
      printAnalysis({ title: record.title, module: record.module, createdAt: record.createdAt, markdown: record.output });
    }
  });
}

function flashBtn(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => btn.textContent = old, 800);
}

export function showApiError(container, err) {
  const msg = (err && err.message) || String(err);
  let action = '';
  if (/clé api|invalide|401|403/i.test(msg)) action = '<br><small>→ Vérifie tes clés dans Settings.</small>';
  else if (/rate|429|529|surcharge/i.test(msg)) action = '<br><small>Réessaie dans quelques secondes.</small>';
  container.innerHTML = `<div class="alert alert-danger"><strong>Erreur :</strong> ${msg}${action}</div>`;
}

// Module header avec barre de provider override + RAG toggle + bouton example
export function moduleHeader(title, desc, { example, moduleId } = {}) {
  return `
    <div class="module-header">
      <div class="module-header-top">
        <h2>${title}</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" data-module-toolbar="${moduleId || ''}">
          ${moduleId && moduleId !== 'knowledge-base' ? providerSelectorHtml(moduleId) : ''}
          ${moduleId && moduleId !== 'knowledge-base' ? `<label class="rag-toggle" title="${t('rag.title')}"><input type="checkbox" data-rag="${moduleId}" /> 📚 KB</label>` : ''}
          ${example ? `<button class="btn-ghost" data-example>${example}</button>` : ''}
        </div>
      </div>
      <div class="module-desc">${desc}</div>
    </div>
  `;
}

const PROVIDER_ICONS = {
  claude: '🤖', openai: '🧠', gemini: '✨', grok: '🐦',
  openrouter: '🌀', perplexity: '🔎',
  mistral: '🇫🇷', cerebras: '⚡', github: '🐙', nvidia: '🟢',
  huggingface: '🤗', cloudflare: '☁️', together: '🟣', cohere: '🟦'
};
const PROVIDER_NAMES = {
  claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', grok: 'Grok',
  openrouter: 'OpenRouter', perplexity: 'Perplexity',
  mistral: 'Mistral', cerebras: 'Cerebras', github: 'GitHub', nvidia: 'NVIDIA',
  huggingface: 'HuggingFace', cloudflare: 'Cloudflare', together: 'Together', cohere: 'Cohere'
};

function providerSelectorHtml(moduleId) {
  if (!isConnected()) return '';
  let avail = [];
  try {
    avail = getOrchestrator().getProviderNames();
  } catch { return ''; }
  if (avail.length === 0) return '';
  const settings = getSettings();
  const ovr = (settings.moduleOverrides || {})[moduleId];
  const current = ovr?.provider || 'auto';
  const currentModel = ovr?.model || '';
  return `
    <span class="provider-picker" data-module="${moduleId}">
      <select class="input provider-selector" data-module="${moduleId}" style="max-width:160px;font-size:11px;padding:4px 8px;">
        <option value="auto" ${current==='auto'?'selected':''}>${t('select.auto')}</option>
        ${avail.map(n => {
          const ic = PROVIDER_ICONS[n] || '·';
          const dn = PROVIDER_NAMES[n] || n;
          return `<option value="${n}" ${current===n?'selected':''}>${ic} ${dn}</option>`;
        }).join('')}
      </select>
      <select class="input model-selector" data-module="${moduleId}" style="max-width:200px;font-size:11px;padding:4px 8px;${current==='auto'?'display:none;':''}">
      </select>
      <span class="cost-estimate" data-module="${moduleId}"></span>
    </span>
  `;
}

// Bind listener pour que le selector update les settings + model picker dynamique + cost estimate
export function wireProviderSelector(viewEl, moduleId) {
  const provSel = viewEl.querySelector(`.provider-selector[data-module="${moduleId}"]`);
  const modelSel = viewEl.querySelector(`.model-selector[data-module="${moduleId}"]`);
  const costEl = viewEl.querySelector(`.cost-estimate[data-module="${moduleId}"]`);

  // Helper : popule le dropdown model selon le provider sélectionné
  async function refreshModelOptions() {
    if (!provSel || !modelSel) return;
    const prov = provSel.value;
    if (prov === 'auto') {
      modelSel.style.display = 'none';
      modelSel.innerHTML = '';
      if (costEl) costEl.innerHTML = '';
      return;
    }
    modelSel.style.display = '';
    try {
      const { MODEL_CATALOG } = await import('../core/models-catalog.js');
      const models = MODEL_CATALOG[prov] || [];
      const settings = getSettings();
      const ovr = (settings.moduleOverrides || {})[moduleId];
      const currentModel = ovr?.model || (settings.modelOverrides?.[prov]?.balanced) || (models.find(m => m.recommended)?.id) || (models[0]?.id);
      modelSel.innerHTML = models.map(m => {
        const stars = m.recommended ? ' ★' : '';
        const tier = m.tier;
        return `<option value="${m.id}" ${m.id===currentModel?'selected':''}>${m.label}${stars} (${tier})</option>`;
      }).join('');
      updateCostEstimate();
    } catch (e) { console.warn('Model options failed:', e); }
  }

  // Estimation coût (basée sur ~3K input + 2K output tokens estimés)
  async function updateCostEstimate() {
    if (!costEl) return;
    if (!provSel || provSel.value === 'auto') { costEl.innerHTML = ''; return; }
    try {
      const { modelPricing } = await import('../core/models-catalog.js');
      const model = modelSel?.value;
      if (!model) { costEl.innerHTML = ''; return; }
      const p = modelPricing(provSel.value, model);
      if (!p) { costEl.innerHTML = ''; return; }
      // Estimation : 3K input, 2K output (typique d'un module). Modules avec PDF = +30K input.
      const heavyModules = new Set(['decoder-10k', 'earnings-call', 'whitepaper-reader']);
      const inputTok = heavyModules.has(moduleId) ? 30000 : 3000;
      const outputTok = 2000;
      const cost = (inputTok / 1e6) * p.input + (outputTok / 1e6) * p.output;
      const color = cost < 0.05 ? 'var(--accent-green)' : cost < 0.30 ? 'var(--accent-amber)' : 'var(--accent-red)';
      costEl.innerHTML = `<span style="color:${color};font-family:var(--font-mono);font-size:11px;">~$${cost.toFixed(3)}</span>`;
      costEl.title = `Estimated cost: ~$${cost.toFixed(4)} (${(inputTok/1000)|0}K in × $${p.input}/M + ${outputTok/1000}K out × $${p.output}/M)`;
    } catch {}
  }

  if (provSel) {
    refreshModelOptions();
    provSel.addEventListener('change', () => {
      const settings = getSettings();
      const overrides = { ...(settings.moduleOverrides || {}) };
      if (provSel.value === 'auto') delete overrides[moduleId];
      else overrides[moduleId] = { provider: provSel.value };
      setSettings({ moduleOverrides: overrides });
      refreshModelOptions();
    });
  }
  if (modelSel) {
    modelSel.addEventListener('change', () => {
      const settings = getSettings();
      const overrides = { ...(settings.moduleOverrides || {}) };
      if (provSel.value !== 'auto') {
        overrides[moduleId] = { provider: provSel.value, model: modelSel.value };
        setSettings({ moduleOverrides: overrides });
      }
      updateCostEstimate();
    });
  }

  // Wire RAG toggle si présent
  const rag = viewEl.querySelector(`input[data-rag="${moduleId}"]`);
  if (rag) {
    rag.checked = isRagEnabledFor(moduleId);
    rag.addEventListener('change', () => setRagEnabled(moduleId, rag.checked));
  }
}

// Récupère l'override courant pour un module
export function getModuleOverride(moduleId) {
  const settings = getSettings();
  return (settings.moduleOverrides || {})[moduleId];
}

// RAG toggle par module (persistant)
const RAG_KEY = 'alpha-terminal:rag-enabled';
function getRagSet() {
  try { return new Set(JSON.parse(localStorage.getItem(RAG_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveRagSet(s) { localStorage.setItem(RAG_KEY, JSON.stringify([...s])); }
export function isRagEnabledFor(moduleId) { return getRagSet().has(moduleId); }
export function setRagEnabled(moduleId, on) {
  const s = getRagSet();
  if (on) s.add(moduleId); else s.delete(moduleId);
  saveRagSet(s);
}

// Toggle RAG inline dans un module (à côté du provider selector)
export function makeRagToggle(moduleId) {
  const wrap = document.createElement('label');
  wrap.className = 'rag-toggle';
  wrap.innerHTML = `<input type="checkbox" ${isRagEnabledFor(moduleId) ? 'checked' : ''} /> 📚 KB`;
  wrap.title = 'Enrichir avec ma Knowledge Base personnelle';
  wrap.querySelector('input').addEventListener('change', e => setRagEnabled(moduleId, e.target.checked));
  return wrap;
}

// Applique le custom prompt utilisateur si présent + suffixe i18n
async function applyCustomPrompt(moduleId, system) {
  const settings = getSettings();
  const cp = (settings.customPrompts || {})[moduleId];
  let base = cp || system || '';
  // Suffixe locale (FR par défaut, EN si demandé)
  try {
    const { languageSuffix } = await import('../core/i18n.js');
    base += languageSuffix();
  } catch {}
  return base;
}

// Helper canonique : run un module via l'orchestrateur, en streaming
export async function runAnalysis(moduleId, params, container, { onTitle, suggestFollowUps = true } = {}) {
  // Garde providers : on vérifie que ce module spécifique a au moins un provider compatible
  // configuré. Sinon, on affiche un message DÉTAILLÉ avec la liste exacte des providers requis.
  const { getModuleProviderStatus, renderMissingKeysMessage } = await import('../core/module-providers.js');
  const status = getModuleProviderStatus(moduleId);
  if (!status.isLocalOnly && !status.runnable) {
    const isEN = (await import('../core/i18n.js')).getLocale() === 'en';
    if (container) {
      container.innerHTML = `<div class="card">${renderMissingKeysMessage(moduleId, isEN)}</div>`;
      const btn = container.querySelector('#run-need-keys');
      if (btn) btn.addEventListener('click', async () => {
        const { openLockFlow } = await import('../ui/modal.js');
        localStorage.removeItem('alpha-terminal:browse-mode');
        openLockFlow();
      });
    }
    return null;
  }

  const stream = prepareStreamContainer(container, moduleId, '');
  let selection = null;
  let fullText = '';
  const sys = await applyCustomPrompt(moduleId, params.system);
  let messages = params.messages;

  // Auto-inject DATA CONTEXT (Alpha Vantage / FMP / Twelve Data / FRED / CoinGecko)
  // pour économiser sur les web_search LLM. Détection automatique du ticker/asset.
  if (params.fetchDataContext !== false) {
    try {
      const { fetchDataContext, formatContextAsText, hasAnyDataKey } = await import('../core/data-context.js');
      // On extrait l'input depuis recordInput.ticker / .symbol / .input ou le dernier message user
      const recordInput = params.recordInput || {};
      const possibleInput = recordInput.ticker || recordInput.symbol || recordInput.input || recordInput.asset || '';
      if (possibleInput && (hasAnyDataKey() || moduleId === 'crypto-fundamental')) {
        const ctx = await fetchDataContext({ moduleId, input: possibleInput, type: recordInput.type });
        if (ctx) {
          const block = formatContextAsText(ctx);
          if (block) {
            messages = messages.map(m => ({ ...m }));
            const last = messages[messages.length - 1];
            if (typeof last.content === 'string') last.content = block + last.content;
            else if (Array.isArray(last.content)) {
              const txt = last.content.find(b => b.type === 'text');
              if (txt) txt.text = block + txt.text;
              else last.content.unshift({ type: 'text', text: block });
            }
            stream.setStatus(`📡 data context injected · streaming…`);
          }
        }
      }
    } catch (e) { console.warn('Data context injection skipped:', e.message); }
  }

  // WEALTH CONTEXT : si l'utilisateur a activé le toggle pour ce module, injecte son patrimoine
  try {
    const { isWealthContextEnabledFor, buildWealthContext } = await import('../core/wealth.js');
    if (isWealthContextEnabledFor(moduleId)) {
      const wealthBlock = await buildWealthContext('EUR');
      if (wealthBlock) {
        messages = messages.map(m => ({ ...m }));
        const last = messages[messages.length - 1];
        if (typeof last.content === 'string') last.content = wealthBlock + last.content;
        else if (Array.isArray(last.content)) {
          const txt = last.content.find(b => b.type === 'text');
          if (txt) txt.text = wealthBlock + txt.text;
          else last.content.unshift({ type: 'text', text: wealthBlock });
        }
        stream.setStatus(`💼 wealth context injected · streaming…`);
      }
    }
  } catch (e) { console.warn('Wealth context skipped:', e.message); }

  // TRANSCRIPT MEMORY : si un transcript est marqué actif, injecte son memorySnapshot.
  // Utile pour cross-référencer un earnings call avec sentiment-tracker, decoder-10k, etc.
  // Le module qui a produit le transcript lui-même n'en bénéficie pas (évite la duplication).
  if (moduleId !== 'youtube-transcript') {
    try {
      const { buildTranscriptContext, getActiveTranscriptId } = await import('../core/transcripts.js');
      if (getActiveTranscriptId()) {
        const tBlock = await buildTranscriptContext();
        if (tBlock) {
          messages = messages.map(m => ({ ...m }));
          const last = messages[messages.length - 1];
          if (typeof last.content === 'string') last.content = tBlock + last.content;
          else if (Array.isArray(last.content)) {
            const txt = last.content.find(b => b.type === 'text');
            if (txt) txt.text = tBlock + txt.text;
            else last.content.unshift({ type: 'text', text: tBlock });
          }
          stream.setStatus(`🎙 transcript memory injected · streaming…`);
        }
      }
    } catch (e) { console.warn('Transcript context skipped:', e.message); }
  }

  // RAG : si le toggle est ON pour ce module, retrieve et injecte le contexte
  if (isRagEnabledFor(moduleId)) {
    try {
      const { retrieve, buildRagContext } = await import('../core/rag.js');
      // Query = dernier message user (premiers ~1500 chars)
      const last = messages?.[messages.length - 1];
      const q = typeof last?.content === 'string' ? last.content : (Array.isArray(last?.content) ? last.content.find(b => b.type === 'text')?.text || '' : '');
      const retrieved = await retrieve(q.slice(0, 1500), { topK: 6 });
      if (retrieved.length) {
        const ragBlock = buildRagContext(retrieved);
        messages = messages.map(m => ({ ...m }));
        const lm = messages[messages.length - 1];
        if (typeof lm.content === 'string') lm.content = ragBlock + lm.content;
        else if (Array.isArray(lm.content)) {
          const txt = lm.content.find(b => b.type === 'text');
          if (txt) txt.text = ragBlock + txt.text;
          else lm.content.unshift({ type: 'text', text: ragBlock });
        }
        stream.setStatus(`RAG: ${retrieved.length} chunks injectés…`);
      }
    } catch (e) {
      console.warn('RAG retrieval failed:', e.message);
    }
  }
  try {
    const result = await analyzeStream(moduleId, {
      ...params,
      system: sys,
      messages,
      override: getModuleOverride(moduleId)
    }, {
      onSelected: (sel) => { selection = sel; stream.setProvider(sel); stream.setStatus('streaming…'); },
      onFallback: (from, to, err) => { stream.setStatus(`fallback ${from}→${to}…`); },
      onDelta: (_c, full) => { fullText = full; stream.setMd(full); stream.setStatus(`${full.length} chars`); }
    });
    const record = finalizeStream({
      container,
      streamHandle: stream,
      module: moduleId,
      title: onTitle ? onTitle(result) : `${getModuleById(moduleId)?.label || moduleId} · ${new Date().toLocaleString('fr-FR')}`,
      markdown: result.text || fullText,
      usage: { input: result.usage.input, output: result.usage.output, costUSD: result.costUSD },
      provider: result.provider,
      providerDisplay: result.providerDisplay,
      isOptimal: result.isOptimal,
      model: result.model,
      inputForRecord: params.recordInput || {}
    });
    if (suggestFollowUps) injectFollowUps(container, moduleId, record);
    return result;
  } catch (e) {
    showApiError(container, e);
    throw e;
  }
}

// Suggestions de follow-up sous chaque résultat
function injectFollowUps(container, moduleId, record) {
  const FOLLOWS = {
    'decoder-10k': [
      { label: '🎙 Analyser le dernier earnings call', goto: 'earnings-call' },
      { label: '📡 Sentiment retail sur ce ticker', goto: 'sentiment-tracker' },
      { label: '🎯 Calculer la taille de position', goto: 'position-sizing' }
    ],
    'macro-dashboard': [
      { label: '💼 Stress-tester mon portfolio', goto: 'stress-test' },
      { label: '⚔️ Battle Mode entre 2 actifs', goto: 'battle-mode' },
    ],
    'crypto-fundamental': [
      { label: '⚠️ Lire le whitepaper', goto: 'whitepaper-reader' },
      { label: '📡 Sentiment crypto', goto: 'sentiment-tracker' },
    ],
    'sentiment-tracker': [
      { label: '🎯 Trade contrarian setup', goto: 'position-sizing' },
      { label: '📊 Décoder le 10-K', goto: 'decoder-10k' }
    ],
    'portfolio-rebalancer': [
      { label: '💼 Stress-tester le portfolio', goto: 'stress-test' },
      { label: '🇫🇷 Optimiser fiscalement', goto: 'tax-optimizer-fr' }
    ]
  };
  const suggestions = FOLLOWS[moduleId];
  if (!suggestions) return;
  const wrap = document.createElement('div');
  wrap.className = 'follow-ups';
  wrap.innerHTML = `
    <div class="follow-ups-title">Suggestions de suite</div>
    <div class="follow-ups-list">
      ${suggestions.map(s => `<button class="btn-ghost follow-up" data-goto="${s.goto}">${s.label} →</button>`).join('')}
    </div>
  `;
  container.appendChild(wrap);
  wrap.querySelectorAll('.follow-up').forEach(b => b.addEventListener('click', () => {
    location.hash = '#' + b.getAttribute('data-goto');
  }));
}

// Auto-save de drafts pour textareas longs (par moduleId + fieldName)
const DRAFTS_KEY = 'alpha-terminal:drafts';
export function bindDraft(moduleId, fieldId, debounceMs = 500) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  const key = `${moduleId}:${fieldId}`;
  // Restore
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
    if (drafts[key] && !el.value) el.value = drafts[key];
  } catch {}
  // Save on input
  let t;
  el.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      try {
        const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
        drafts[key] = el.value;
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
      } catch {}
    }, debounceMs);
  });
}

// Export CSV : extrait les tables markdown du résultat
export function markdownToCsv(md) {
  const lines = md.split('\n');
  const tables = [];
  let cur = null;
  for (const ln of lines) {
    if (/^\|.+\|$/.test(ln.trim())) {
      if (!cur) cur = [];
      // Skip separator |---|---|
      if (/^\|[\s\-\|:]+\|$/.test(ln.trim())) continue;
      const cells = ln.split('|').slice(1, -1).map(c => c.trim().replace(/"/g, '""'));
      cur.push(cells);
    } else if (cur && cur.length) {
      tables.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length) tables.push(cur);
  if (!tables.length) return '';
  return tables.map(t => t.map(row => row.map(c => `"${c}"`).join(',')).join('\n')).join('\n\n');
}
