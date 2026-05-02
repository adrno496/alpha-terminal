// NVIDIA NIM — https://docs.nvidia.com/nim/
// OpenAI-compatible cloud endpoints for NIM-hosted models (Llama, Mistral, Nemotron, etc.)
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class NvidiaProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'nvidia',
      displayName: 'NVIDIA NIM',
      icon: '🟢',
      baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
      defaultModels: {
        flagship: 'nvidia/llama-3.1-nemotron-70b-instruct',
        balanced: 'meta/llama-3.3-70b-instruct',
        fast: 'meta/llama-3.1-8b-instruct'
      },
      validateModels: [
        'meta/llama-3.1-8b-instruct',
        'meta/llama-3.3-70b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct'
      ]
    });
  }

  async validate() {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
      });
      if (res.ok) return { ok: true };
      if (res.status === 401) return { ok: false, error: '[NVIDIA NIM] Clé invalide ou révoquée.', status: 401 };
      if (res.status === 403) return { ok: false, error: '[NVIDIA NIM] Clé valide mais sans accès aux modèles.', status: 403 };
    } catch {}
    try {
      const r2 = await super.validate();
      if (r2.ok) return r2;
      if (r2.status === 401 || r2.status === 403) return r2;
    } catch {}
    return { ok: false, error: 'BROWSER_INCOMPATIBLE:nvidia', status: 0 };
  }
}
