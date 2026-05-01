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

  // === A2 : Persiste le résultat dans le cache 24h pour dedup ===
  try {
    const settings = getSettings();
    if (settings.cacheResults !== false && inputForRecord) {
      const key = makeCacheKey(module, inputForRecord);
      writeResultCache(key, {
        markdown: markdown || '',
        title: record.title,
        costUSD: usage?.costUSD || 0,
        provider, model
      });
    }
  } catch (e) { console.warn('[cache] write failed:', e); }

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
// Modules où le toggle "💼 Patrimoine" n'a pas de sens (modules pure-local sans LLM
// OU modules dont le contexte patrimoine n'apporte rien d'analytique)
const NO_WEALTH_TOGGLE = new Set([
  'knowledge-base', 'budget', 'csv-import', 'price-alerts', 'live-watcher',
  'macro-events-calendar', 'earnings-calendar', 'subscriptions-detector',
  'estate-doc-generator', 'whitepaper-reader'
]);

function wealthToggleHtml(moduleId) {
  if (!moduleId || NO_WEALTH_TOGGLE.has(moduleId)) return '';
  // Lecture sync via localStorage (évite import async ici)
  const disabled = (() => {
    try { return JSON.parse(localStorage.getItem('alpha-terminal:wealth-context-disabled') || '[]').includes(moduleId); }
    catch { return false; }
  })();
  const on = !disabled;
  const titleOn = 'Patrimoine complet injecte dans le prompt — clique pour desactiver';
  const titleOff = 'Patrimoine non injecte — clique pour activer';
  return `<label class="wealth-toggle ${on ? 'on' : ''}" title="${on ? titleOn : titleOff}">
    <input type="checkbox" data-wealth-toggle="${moduleId}" ${on ? 'checked' : ''} />
    💼 ${on ? 'Patrimoine ✓' : 'Patrimoine'}
  </label>`;
}

export function moduleHeader(title, desc, { example, moduleId } = {}) {
  return `
    <div class="module-header">
      <div class="module-header-top">
        <h2>${title}</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" data-module-toolbar="${moduleId || ''}">
          ${moduleId && moduleId !== 'knowledge-base' ? providerSelectorHtml(moduleId) : ''}
          ${wealthToggleHtml(moduleId)}
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

// Global delegation : un seul handler pour TOUS les toggles 💼 Patrimoine,
// quels que soient les modules qui rendent moduleHeader (avec ou sans wireProviderSelector).
if (typeof document !== 'undefined' && !window.__wealthToggleWired) {
  window.__wealthToggleWired = true;
  document.addEventListener('change', async (e) => {
    const cb = e.target.closest('input[data-wealth-toggle]');
    if (!cb) return;
    const moduleId = cb.getAttribute('data-wealth-toggle');
    const { setWealthContextEnabled } = await import('../core/wealth.js');
    setWealthContextEnabled(moduleId, cb.checked);
    const label = cb.closest('.wealth-toggle');
    if (label) {
      label.classList.toggle('on', cb.checked);
      label.title = cb.checked
        ? "Patrimoine complet injecte dans le prompt — clique pour desactiver"
        : "Patrimoine non injecte — clique pour activer";
      for (const node of label.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = cb.checked ? ' 💼 Patrimoine ✓' : ' 💼 Patrimoine';
        }
      }
    }
  });
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

  // === Budget cap check ===
  // On vérifie avant de lancer l'analyse que le budget n'est pas dépassé.
  // Si action='block' on refuse, sinon on warn via toast.
  try {
    const { checkBudgetCap, getBudgetLimits } = await import('../core/cost-tracker.js');
    const limits = getBudgetLimits();
    if (limits.enabled) {
      // Estimation grossière : moyenne ~$0.05 par analyse (sera affinée si possible)
      const estimated = 0.05;
      const check = checkBudgetCap(estimated);
      if (!check.ok) {
        const isEN = (await import('../core/i18n.js')).getLocale() === 'en';
        const reasonLabel = {
          'per-call':  isEN ? 'per-call cap' : 'plafond par analyse',
          'daily':     isEN ? 'daily cap'    : 'plafond journalier',
          'monthly':   isEN ? 'monthly cap'  : 'plafond mensuel'
        }[check.reason] || check.reason;
        const msg = isEN
          ? `⚠️ Budget ${reasonLabel} reached: $${check.current.toFixed(2)} / $${check.limit.toFixed(2)}.`
          : `⚠️ Budget atteint (${reasonLabel}) : $${check.current.toFixed(2)} / $${check.limit.toFixed(2)}.`;
        if (check.action === 'block') {
          if (container) container.innerHTML = `<div class="card" style="border-left:3px solid var(--accent-red);padding:14px;">
            <strong style="color:var(--accent-red);">${msg}</strong>
            <p style="margin:10px 0 0;font-size:13px;color:var(--text-secondary);">
              ${isEN ? 'Increase your budget in <strong>Settings → Costs → Budget control</strong> or wait for the period to reset.' : 'Augmente ton budget dans <strong>Paramètres → Coûts → Contrôle budget</strong> ou attends la réinitialisation de la période.'}
            </p>
          </div>`;
          const { toast } = await import('../core/utils.js');
          toast(msg, 'error');
          return null;
        } else {
          const { toast } = await import('../core/utils.js');
          toast(msg + (isEN ? ' (warn only — analysis runs)' : ' (avertissement — analyse lancée)'), 'warning');
        }
      }
    }
  } catch (e) { console.warn('[budget] check failed:', e); }

  // === A2 : Cache résultats 24h ===
  // Si activé dans settings + même input dans la dernière 24h → renvoie le résultat cached.
  const settings = getSettings();
  if (params._bypassCache) settings.cacheResults = false;
  if (settings.cacheResults !== false && container && params.recordInput) {
    try {
      const cacheKey = makeCacheKey(moduleId, params.recordInput);
      const cached = readResultCache(cacheKey);
      if (cached && (Date.now() - cached.cachedAt) < 24 * 3600 * 1000) {
        const isEN = (await import('../core/i18n.js')).getLocale() === 'en';
        const ageMin = Math.round((Date.now() - cached.cachedAt) / 60000);
        container.innerHTML = `
          <div class="card" style="border-left:3px solid var(--accent-green);padding:14px;margin-bottom:10px;background:rgba(0,255,136,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              <div>
                <strong>⚡ ${isEN ? 'Cached result' : 'Résultat caché'}</strong>
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">
                  ${isEN ? `from ${ageMin} min ago` : `il y a ${ageMin} min`}
                  ${cached.costUSD ? ` · ${isEN ? 'saved' : 'économisé'} $${cached.costUSD.toFixed(4)}` : ''}
                </span>
              </div>
              <button id="cache-rerun" class="btn-secondary" style="font-size:11px;">🔄 ${isEN ? 'Re-run anyway' : 'Re-lancer quand même'}</button>
            </div>
          </div>
          <div class="result"><div class="result-body">${(await import('../core/safe-render.js')).safeRender(cached.markdown || '')}</div></div>
        `;
        container.querySelector('#cache-rerun')?.addEventListener('click', () => {
          deleteResultCache(cacheKey);
          // Re-run sans cache cette fois
          runAnalysis(moduleId, { ...params, _bypassCache: true }, container, { onTitle, suggestFollowUps });
        });
        // Normalise la shape pour les modules qui font `result.text` après runAnalysis :
        // le cache stocke `markdown`, l'API retourne `text`. On expose les deux.
        return { ...cached, text: cached.markdown, usage: { input: 0, output: 0, costUSD: 0 } };
      }
    } catch (e) { console.warn('[cache] read failed:', e); }
  }

  const stream = prepareStreamContainer(container, moduleId, '');
  let selection = null;
  let fullText = '';
  const sys = await applyCustomPrompt(moduleId, params.system);
  let messages = params.messages;

  // Clone des params modifiables — ne JAMAIS muter l'objet du caller (évite des
  // bugs sneaky si le module réutilise le même params à travers plusieurs runs).
  let runOverride = params.override ? { ...params.override } : undefined;
  let promptCaching = params.promptCaching;

  // === A3 : Mode Éco — force le tier balanced ===
  if (settings.ecoMode && !runOverride?.tier) {
    runOverride = { ...(runOverride || {}), tier: 'balanced' };
  }

  // === A1 : Prompt caching Anthropic ===
  // Forwardé jusqu'au provider Claude qui marque le system prompt avec cache_control.
  if (settings.promptCaching !== false) {
    promptCaching = true;
  }

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

  // FINANCE CONTEXT : profil utilisateur (salaire, charges, TMI, objectifs) — toujours injecté
  // si rempli dans le questionnaire d'onboarding. Permet à toutes les analyses fiscales,
  // FIRE, budget, audit patrimoine, etc. d'être personnalisées sans demander à chaque fois.
  try {
    const { buildFinanceContext } = await import('../core/user-profile.js');
    const finBlock = buildFinanceContext();
    if (finBlock) {
      messages = messages.map(m => ({ ...m }));
      const last = messages[messages.length - 1];
      if (typeof last.content === 'string') last.content = finBlock + last.content;
      else if (Array.isArray(last.content)) {
        const txt = last.content.find(b => b.type === 'text');
        if (txt) txt.text = finBlock + txt.text;
        else last.content.unshift({ type: 'text', text: finBlock });
      }
    }
  } catch (e) { console.warn('Finance context skipped:', e.message); }

  // WEALTH CONTEXT : si l'utilisateur a activé le toggle pour ce module, injecte son patrimoine
  try {
    const { isWealthContextEnabledFor, buildWealthContext } = await import('../core/wealth.js');
    if (isWealthContextEnabledFor(moduleId)) {
      const wealthBlock = await buildWealthContext('EUR', moduleId);
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
      override: runOverride || getModuleOverride(moduleId),
      promptCaching
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
    // Annulation utilisateur : ne pas afficher "Erreur : AbortError" — l'UI a déjà
    // remplacé le container avec le message d'annulation côté abort button.
    if (e?.name === 'AbortError' || /aborted/i.test(e?.message || '')) {
      if (container && !container.querySelector('.alert-warning')) {
        container.innerHTML = '<div class="alert alert-warning">Requête annulée.</div>';
      }
      return null;
    }
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

// ===== A2 — Cache résultats 24h =====
const RESULT_CACHE_KEY = 'alpha-terminal:result-cache';
const RESULT_CACHE_MAX = 60; // 60 résultats cachés max (rotation FIFO)

function readResultCacheAll() {
  try { return JSON.parse(localStorage.getItem(RESULT_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function writeResultCacheAll(obj) {
  try {
    // Trim si trop d'entries
    const keys = Object.keys(obj);
    if (keys.length > RESULT_CACHE_MAX) {
      const sorted = keys.sort((a, b) => (obj[a].cachedAt || 0) - (obj[b].cachedAt || 0));
      for (const k of sorted.slice(0, keys.length - RESULT_CACHE_MAX)) delete obj[k];
    }
    localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(obj));
  } catch {}
}
export function makeCacheKey(moduleId, recordInput) {
  // Hash simple des champs significatifs de l'input
  const significant = {};
  if (!recordInput || typeof recordInput !== 'object') return moduleId + ':default';
  for (const k of Object.keys(recordInput).sort()) {
    const v = recordInput[k];
    if (v == null || typeof v === 'function') continue;
    if (typeof v === 'object') {
      try { significant[k] = JSON.stringify(v).slice(0, 400); } catch {}
    } else {
      significant[k] = String(v).slice(0, 400);
    }
  }
  // SHA-1-like hash via simple sum (suffisant pour dedup, pas crypto)
  const str = moduleId + ':' + JSON.stringify(significant);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return moduleId + ':' + Math.abs(hash).toString(36);
}
export function readResultCache(key) {
  return readResultCacheAll()[key] || null;
}
export function writeResultCache(key, data) {
  const all = readResultCacheAll();
  all[key] = { ...data, cachedAt: Date.now() };
  writeResultCacheAll(all);
}
export function deleteResultCache(key) {
  const all = readResultCacheAll();
  delete all[key];
  writeResultCacheAll(all);
}

// ===== A7 — Budget cap par analyse =====
// Vérifie pendant le streaming si le coût estimé dépasse le plafond. Abort si oui.
export function checkBudgetCap(currentCostUSD, settings) {
  const cap = Number(settings?.budgetCapUSD) || 0;
  if (cap <= 0) return false; // pas de cap
  return currentCostUSD > cap;
}
