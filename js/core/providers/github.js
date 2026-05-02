// GitHub Models — https://docs.github.com/en/github-models
// Free tier with rate limits, accessible via a GitHub PAT (or fine-grained token)
// Endpoint format: OpenAI-compatible at https://models.github.ai/inference
import { OpenAICompatibleProvider } from './openai-compatible.js';

// Proxy CORS pour cet endpoint qui ne supporte pas les browser direct calls.
// Si window.ALPHA_CONFIG.LLM_PROXY_URL est défini, on route à travers.
function viaProxy(url) {
  const base = (typeof window !== 'undefined' && window.ALPHA_CONFIG?.LLM_PROXY_URL) || '/api/llm-proxy';
  return `${base}?url=${encodeURIComponent(url)}`;
}

export class GitHubModelsProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'github',
      displayName: 'GitHub Models',
      icon: '🐙',
      baseUrl: viaProxy('https://models.github.ai/inference/chat/completions'),
      defaultModels: {
        flagship: 'openai/gpt-4o',
        balanced: 'openai/gpt-4o-mini',
        fast: 'openai/gpt-4o-mini'
      },
      validateModels: [
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
        'meta/Llama-3.3-70B-Instruct'
      ]
    });
  }

  async validate() {
    // Étape 0 : format check — rejette les fausses clés évidentes immédiatement
    // GitHub PAT : github_pat_xxx (fine-grained, ~93 chars) ou ghp_xxx (classic, ~40 chars)
    if (!/^(github_pat_[A-Za-z0-9_]{60,}|ghp_[A-Za-z0-9]{36,})$/.test(this.apiKey)) {
      return { ok: false, error: '[GitHub Models] Format de PAT invalide. Format attendu : github_pat_… (fine-grained) ou ghp_… (classic).', status: 400 };
    }
    // Étape 1 : VRAI POST chat ping — c'est ça qui détecte rate-limit + scope inférence manquant.
    // Le scope « models:read » suffit pour GET /catalog mais PAS pour POST inference (qui exige
    // « models » tout court / scope Models full). On veut la vérité, donc on fait le POST en premier.
    try {
      const r = await super.validate();
      if (r.ok) return r;
      if (r.status === 401) return { ok: false, error: '[GitHub Models] Token invalide ou expiré.', status: 401 };
      if (r.status === 403) return { ok: false, error: '[GitHub Models] Token valide mais sans scope « Models » complet. Recrée le PAT avec ce scope (Settings → Developer settings → Personal access tokens → cocher « Models »).', status: 403 };
      if (r.status === 429) return { ok: false, error: '[GitHub Models] Rate-limit free tier dépassé (50 req/jour, ~150k tokens). Attends 24h ou upgrade ton compte GitHub.', status: 429 };
      if (r.status >= 500) return { ok: false, error: `[GitHub Models] Erreur serveur GitHub (HTTP ${r.status}). Vérifie githubstatus.com.`, status: r.status };
    } catch {}
    // Étape 2 : fallback GET /catalog/models si le POST a CORS-failed (très rare avec le proxy)
    try {
      const res = await fetch(viaProxy('https://models.github.ai/catalog/models'), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
      });
      if (res.ok) return { ok: false, error: '[GitHub Models] Token valide pour le catalogue, mais l\'inférence chat a échoué. Vérifie le scope « Models » du PAT.', status: 0 };
      if (res.status === 401) return { ok: false, error: '[GitHub Models] Token invalide ou expiré.', status: 401 };
      if (res.status === 403) return { ok: false, error: '[GitHub Models] Token sans scope « models:read ».', status: 403 };
    } catch {}
    return { ok: false, error: 'BROWSER_INCOMPATIBLE:github', status: 0 };
  }
}
