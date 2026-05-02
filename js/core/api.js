// Orchestrateur multi-LLM. Remplace l'ancien wrapper Claude-only.
// API publique :
//   - setRuntimeKeys({claude, openai, gemini, grok})
//   - clearRuntimeKeys()
//   - isConnected() / getOrchestrator()
//   - analyzeStream(moduleId, params, callbacks) → utilisé par tous les modules

import { ClaudeProvider } from './providers/claude.js';
import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { GrokProvider }   from './providers/grok.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { PerplexityProvider } from './providers/perplexity.js';
import { MistralProvider } from './providers/mistral.js';
import { CerebrasProvider } from './providers/cerebras.js';
import { GitHubModelsProvider } from './providers/github.js';
import { NvidiaProvider } from './providers/nvidia.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import { CloudflareProvider } from './providers/cloudflare.js';
import { TogetherProvider } from './providers/together.js';
import { CohereProvider } from './providers/cohere.js';
import { SmartRouter, MODULE_ROUTING } from './router.js';
import { extractTextFromPDF } from './pdf-text-extractor.js';
import { addCost } from './cost-tracker.js';
import { getSettings } from './storage.js';
import { sleep } from './utils.js';

let _orchestrator = null;
const _listeners = new Set();

// AbortController par requestId — fix de la race condition singleton.
// Permet à l'utilisateur de lancer 2+ analyses en parallèle, et d'annuler
// individuellement l'une sans tuer les autres.
const _controllers = new Map(); // requestId -> AbortController
let _reqCounter = 0;

const PROVIDER_CLASSES = {
  claude:      ClaudeProvider,
  openai:      OpenAIProvider,
  gemini:      GeminiProvider,
  grok:        GrokProvider,
  openrouter:  OpenRouterProvider,
  perplexity:  PerplexityProvider,
  mistral:     MistralProvider,
  cerebras:    CerebrasProvider,
  github:      GitHubModelsProvider,
  nvidia:      NvidiaProvider,
  huggingface: HuggingFaceProvider,
  cloudflare:  CloudflareProvider,
  together:    TogetherProvider,
  cohere:      CohereProvider
};

export class APIOrchestrator {
  constructor(decryptedKeys, modelOverrides = {}) {
    this.providers = {};
    for (const [name, key] of Object.entries(decryptedKeys || {})) {
      if (key && PROVIDER_CLASSES[name]) {
        this.providers[name] = new PROVIDER_CLASSES[name](key, modelOverrides[name] || {});
      }
    }
    if (Object.keys(this.providers).length === 0) {
      throw new Error('Aucune clé API configurée');
    }
    this.router = new SmartRouter(this.providers);
  }

  getProviderNames() { return Object.keys(this.providers); }
  hasProvider(name) { return !!this.providers[name]; }
  getRoutingPreview() { return this.router.getRoutingPreview(); }

  // Sélection sans appel — utile pour afficher "qui va être utilisé"
  preview(moduleId, override = {}) {
    return this.router.selectProvider(moduleId, {
      forceProvider: override.provider,
      forceTier: override.tier,
      forceModel: override.model
    });
  }

  // Préparation : si le provider ne supporte pas PDF natif, extraire le texte
  async _preparePDFsIfNeeded(provider, files, messages) {
    if (!files || !files.length) return { messages, files: [] };
    const supportsPDF = provider.getCapabilities().supportsPDFNative;
    if (supportsPDF) return { messages, files };
    // Fallback : extraire texte des PDFs et le concaténer au dernier message user
    let extra = '';
    for (const f of files) {
      if (f.type === 'pdf') {
        let txt = f.extractedText;
        if (!txt && f.file) txt = await extractTextFromPDF(f.file);
        if (!txt && f.base64) {
          // Re-construire un blob depuis base64
          const bin = atob(f.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const file = new File([blob], f.name || 'document.pdf');
          txt = await extractTextFromPDF(file);
        }
        if (txt) extra += `\n\n[CONTENU DU PDF "${f.name || 'document'}"]\n${txt}`;
      }
    }
    if (extra) {
      const newMessages = messages.map(m => ({ ...m }));
      const last = newMessages[newMessages.length - 1];
      if (typeof last.content === 'string') last.content += extra;
      else if (Array.isArray(last.content)) {
        const txt = last.content.find(b => b.type === 'text');
        if (txt) txt.text = txt.text + extra;
        else last.content.push({ type: 'text', text: extra });
      }
      return { messages: newMessages, files: [] };
    }
    return { messages, files: [] };
  }

  // Streaming canonique pour modules
  async analyzeStream(moduleId, params, cbs = {}, _internalState = null) {
    const settings = getSettings();
    const sel = this.router.selectProvider(moduleId, {
      forceProvider: params.override?.provider,
      forceTier: params.override?.tier,
      forceModel: params.override?.model
    });

    // Etat interne pour suivre les retries 429 et providers déjà essayés
    const state = _internalState || {
      requestId: ++_reqCounter,
      attempt: 0,
      maxAttempts: 3,
      triedProviders: new Set(),
      backoffMs: 1500
    };
    state.triedProviders.add(sel.provider.name);

    const controller = new AbortController();
    _controllers.set(state.requestId, controller);

    const { messages, files } = await this._preparePDFsIfNeeded(
      sel.provider,
      params.files || [],
      params.messages
    );

    const callParams = {
      system: params.system,
      messages,
      model: sel.model,
      maxTokens: params.maxTokens || settings.maxTokens || 4096,
      temperature: params.temperature ?? settings.temperature,
      files,
      useWebSearch: params.useWebSearch || false,
      promptCaching: params.promptCaching || false,
      signal: controller.signal
    };

    if (cbs.onSelected) cbs.onSelected(sel);

    let result;
    try {
      result = await sel.provider.stream(callParams, { onDelta: cbs.onDelta });
    } catch (e) {
      _controllers.delete(state.requestId);

      // 429 RATE LIMIT — backoff exponentiel + retry sur même provider
      // (avec respect de Retry-After si fourni)
      if (e?.status === 429 && state.attempt < state.maxAttempts) {
        state.attempt++;
        let waitMs = state.backoffMs;
        if (e.retryAfter) {
          const ra = parseInt(e.retryAfter, 10);
          if (!isNaN(ra) && ra > 0) waitMs = Math.min(ra * 1000, 30_000);
        }
        if (cbs.onFallback) cbs.onFallback(sel.provider.name, sel.provider.name, `429 — retry dans ${Math.round(waitMs/1000)}s (${state.attempt}/${state.maxAttempts})`);
        await sleep(waitMs);
        state.backoffMs = Math.min(state.backoffMs * 2, 16_000);
        return await this.analyzeStream(moduleId, params, cbs, state);
      }

      // Si user a annulé : ne pas fallback, propager
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        throw e;
      }

      // Auto-fallback : essayer un autre provider non-encore-tenté (sauf override explicite)
      if (!params.override?.provider) {
        const candidates = Object.keys(this.providers).filter(n => !state.triedProviders.has(n));
        if (candidates.length) {
          const next = candidates[0];
          if (cbs.onFallback) cbs.onFallback(sel.provider.name, next, e.message);
          return await this.analyzeStream(moduleId, {
            ...params,
            override: { ...(params.override || {}), provider: next }
          }, cbs, state);
        }
      }
      throw e;
    }
    _controllers.delete(state.requestId);

    addCost(result.costUSD || 0, sel.provider.name);
    if (cbs.onDone) cbs.onDone(result);
    return {
      ...result,
      provider: sel.provider.name,
      providerDisplay: sel.provider.displayName,
      isOptimal: sel.isOptimal,
      reason: sel.reason,
      requestId: state.requestId
    };
  }
}

// === Runtime API ===
export function setRuntimeKeys(decryptedKeys) {
  const keys = {};
  for (const [k, v] of Object.entries(decryptedKeys || {})) {
    if (v) keys[k] = v;
  }
  if (!Object.keys(keys).length) {
    _orchestrator = null;
    _listeners.forEach(fn => fn(false));
    return;
  }
  const settings = getSettings();
  _orchestrator = new APIOrchestrator(keys, settings.modelOverrides || {});
  _listeners.forEach(fn => fn(true));
}

export function clearRuntimeKeys() {
  _orchestrator = null;
  _listeners.forEach(fn => fn(false));
}

export function getOrchestrator() {
  if (!_orchestrator) throw new Error('Orchestrateur non initialisé. Déverrouille ton vault.');
  return _orchestrator;
}

export function isConnected() { return !!_orchestrator; }
export function onConnectionChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
// Abort une requête spécifique (ou toutes si pas d'arg)
// Backwards-compatible : `abortCurrentCall()` sans arg abort TOUS les calls en cours.
// Avec un requestId : abort uniquement celui-ci → l'utilisateur peut lancer
// 2 analyses en parallèle et n'annuler que l'une.
export function abortCurrentCall(requestId) {
  if (requestId != null) {
    const c = _controllers.get(requestId);
    if (c) {
      try { c.abort(); } catch {}
      _controllers.delete(requestId);
    }
    return;
  }
  for (const [id, c] of _controllers) {
    try { c.abort(); } catch {}
  }
  _controllers.clear();
}

// Validation d'une clé arbitraire (pour le wizard)
export async function validateProviderKey(name, key) {
  const Cls = PROVIDER_CLASSES[name];
  if (!Cls) return { ok: false, error: 'Provider inconnu' };
  const provider = new Cls(key);
  return await provider.validate();
}

// Sucre : analyse d'un module via l'orchestrateur (utilisé partout)
export async function analyzeStream(moduleId, params, cbs) {
  return getOrchestrator().analyzeStream(moduleId, params, cbs);
}

// Liste des providers connus pour la UI
export const KNOWN_PROVIDERS = [
  { name: 'claude',      displayName: 'Anthropic Claude',     icon: '🤖', linkKey: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...',                  recommendedFor: '10-K, fiscal, newsletter, raisonnement nuancé' },
  { name: 'openai',      displayName: 'OpenAI ChatGPT',       icon: '🧠', linkKey: 'https://platform.openai.com/api-keys',         placeholder: 'sk-...',                       recommendedFor: 'analyse générale, polyvalent' },
  { name: 'gemini',      displayName: 'Google Gemini',        icon: '✨', linkKey: 'https://aistudio.google.com/app/apikey',       placeholder: 'AIza...',                      recommendedFor: 'long contexte, PDF natif' },
  { name: 'grok',        displayName: 'xAI Grok',             icon: '🐦', linkKey: 'https://console.x.ai',                         placeholder: 'xai-...',                      recommendedFor: 'sentiment X temps réel (unique)' },
  { name: 'openrouter',  displayName: 'OpenRouter',           icon: '🌀', linkKey: 'https://openrouter.ai/keys',                   placeholder: 'sk-or-v1-...',                 recommendedFor: 'accès 200+ modèles (Llama, DeepSeek, Mistral, Qwen…)' },
  { name: 'perplexity',  displayName: 'Perplexity',           icon: '🔎', linkKey: 'https://www.perplexity.ai/settings/api',       placeholder: 'pplx-...',                     recommendedFor: 'recherche web augmentée native' },
  { name: 'mistral',     displayName: 'Mistral AI',           icon: '🇫🇷', linkKey: 'https://console.mistral.ai/api-keys/',          placeholder: 'mistral key',                  recommendedFor: 'modèles européens, code (Codestral)' },
  { name: 'cerebras',    displayName: 'Cerebras',             icon: '⚡', linkKey: 'https://cloud.cerebras.ai/?tab=api-keys',       placeholder: 'csk-...',                      recommendedFor: 'inférence ultra-rapide (Llama 70B >2000 tok/s)' },
  { name: 'github',      displayName: 'GitHub Models',        icon: '🐙', linkKey: 'https://github.com/settings/tokens',           placeholder: 'ghp_... ou github_pat_...',    recommendedFor: 'tier gratuit (rate limits) avec PAT GitHub',                browserIncompatible: true, alternativeProvider: 'openrouter' },
  { name: 'nvidia',      displayName: 'NVIDIA NIM',           icon: '🟢', linkKey: 'https://build.nvidia.com/explore/discover',    placeholder: 'nvapi-...',                    recommendedFor: 'Nemotron 70B, Llama 405B, Mixtral',                       browserIncompatible: true, alternativeProvider: 'openrouter' },
  { name: 'huggingface', displayName: 'Hugging Face',         icon: '🤗', linkKey: 'https://huggingface.co/settings/tokens',       placeholder: 'hf_...',                       recommendedFor: 'router multi-provider (1 clé = 10+ providers)',           browserIncompatible: true, alternativeProvider: 'openrouter' },
  { name: 'cloudflare',  displayName: 'Cloudflare Workers AI', icon: '☁️', linkKey: 'https://dash.cloudflare.com/profile/api-tokens', placeholder: 'ACCOUNT_ID:API_TOKEN',      recommendedFor: 'edge inference, bas coût (format ACCOUNT_ID:TOKEN)',     browserIncompatible: true, alternativeProvider: 'openrouter', altSetup: 'AI Gateway' },
  { name: 'together',    displayName: 'Together AI',          icon: '🟣', linkKey: 'https://api.together.xyz/settings/api-keys',   placeholder: 'together key',                 recommendedFor: 'Llama 405B Turbo, DeepSeek, Qwen' },
  { name: 'cohere',      displayName: 'Cohere',               icon: '🟦', linkKey: 'https://dashboard.cohere.com/api-keys',        placeholder: 'cohere key',                   recommendedFor: 'Command R+, RAG-tuned, multilingue' }
];

export { MODULE_ROUTING };
