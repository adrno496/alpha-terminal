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
let _currentAbort = null;

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
  async analyzeStream(moduleId, params, cbs = {}) {
    const settings = getSettings();
    const sel = this.router.selectProvider(moduleId, {
      forceProvider: params.override?.provider,
      forceTier: params.override?.tier,
      forceModel: params.override?.model
    });

    const controller = new AbortController();
    _currentAbort = controller;

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
      signal: controller.signal
    };

    if (cbs.onSelected) cbs.onSelected(sel);

    let result;
    try {
      result = await sel.provider.stream(callParams, { onDelta: cbs.onDelta });
    } catch (e) {
      _currentAbort = null;
      // Auto-fallback : essai avec un autre provider configuré (sauf si override explicite)
      if (!params.override?.provider && Object.keys(this.providers).length > 1) {
        const otherNames = Object.keys(this.providers).filter(n => n !== sel.provider.name);
        if (otherNames.length) {
          if (cbs.onFallback) cbs.onFallback(sel.provider.name, otherNames[0], e.message);
          return await this.analyzeStream(moduleId, {
            ...params,
            override: { ...(params.override || {}), provider: otherNames[0] }
          }, cbs);
        }
      }
      throw e;
    }
    _currentAbort = null;

    addCost(result.costUSD || 0, sel.provider.name);
    if (cbs.onDone) cbs.onDone(result);
    return {
      ...result,
      provider: sel.provider.name,
      providerDisplay: sel.provider.displayName,
      isOptimal: sel.isOptimal,
      reason: sel.reason
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
export function abortCurrentCall() {
  if (_currentAbort) {
    try { _currentAbort.abort(); } catch {}
    _currentAbort = null;
  }
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
  { name: 'github',      displayName: 'GitHub Models',        icon: '🐙', linkKey: 'https://github.com/settings/tokens',           placeholder: 'ghp_... ou github_pat_...',    recommendedFor: 'tier gratuit (rate limits) avec PAT GitHub' },
  { name: 'nvidia',      displayName: 'NVIDIA NIM',           icon: '🟢', linkKey: 'https://build.nvidia.com/explore/discover',    placeholder: 'nvapi-...',                    recommendedFor: 'Nemotron 70B, Llama 405B, Mixtral' },
  { name: 'huggingface', displayName: 'Hugging Face',         icon: '🤗', linkKey: 'https://huggingface.co/settings/tokens',       placeholder: 'hf_...',                       recommendedFor: 'router multi-provider (1 clé = 10+ providers)' },
  { name: 'cloudflare',  displayName: 'Cloudflare Workers AI', icon: '☁️', linkKey: 'https://dash.cloudflare.com/profile/api-tokens', placeholder: 'ACCOUNT_ID:API_TOKEN',      recommendedFor: 'edge inference, bas coût (format ACCOUNT_ID:TOKEN)' },
  { name: 'together',    displayName: 'Together AI',          icon: '🟣', linkKey: 'https://api.together.xyz/settings/api-keys',   placeholder: 'together key',                 recommendedFor: 'Llama 405B Turbo, DeepSeek, Qwen' },
  { name: 'cohere',      displayName: 'Cohere',               icon: '🟦', linkKey: 'https://dashboard.cohere.com/api-keys',        placeholder: 'cohere key',                   recommendedFor: 'Command R+, RAG-tuned, multilingue' }
];

export { MODULE_ROUTING };
