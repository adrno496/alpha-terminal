// GitHub Models — https://docs.github.com/en/github-models
// Free tier with rate limits, accessible via a GitHub PAT (or fine-grained token)
// Endpoint format: OpenAI-compatible at https://models.github.ai/inference
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class GitHubModelsProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'github',
      displayName: 'GitHub Models',
      icon: '🐙',
      baseUrl: 'https://models.github.ai/inference/chat/completions',
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
    try {
      const res = await fetch('https://models.github.ai/catalog/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
      });
      if (res.ok) return { ok: true };
      if (res.status === 401) return { ok: false, error: '[GitHub Models] Token invalide ou expiré.', status: 401 };
      if (res.status === 403) return { ok: false, error: '[GitHub Models] Token valide mais sans scope « models:read ». Recrée le PAT avec ce scope (Settings → Developer settings → Personal access tokens → cocher « Models »).', status: 403 };
    } catch {}
    try {
      const r2 = await super.validate();
      if (r2.ok) return r2;
      if (r2.status === 401 || r2.status === 403) return r2;
    } catch {}
    // CORS bloque tout → on est honnête : provider non utilisable depuis browser
    return { ok: false, error: 'BROWSER_INCOMPATIBLE:github', status: 0 };
  }
}
