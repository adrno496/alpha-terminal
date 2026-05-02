// Hugging Face Inference Router — https://huggingface.co/docs/inference-providers/
// One endpoint, multi-provider routing (Together, Fireworks, Cerebras, etc. — billed via HF)
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'huggingface',
      displayName: 'Hugging Face',
      icon: '🤗',
      baseUrl: 'https://router.huggingface.co/v1/chat/completions',
      defaultModels: {
        flagship: 'meta-llama/Llama-3.3-70B-Instruct',
        balanced: 'Qwen/Qwen2.5-72B-Instruct',
        fast: 'meta-llama/Llama-3.1-8B-Instruct'
      }
    });
  }

  // Override : utilise l'endpoint officiel `whoami-v2` qui valide le token sans
  // consommer de quota d'inférence et sans dépendre d'un modèle spécifique.
  // Endpoint conçu pour ça : https://huggingface.co/docs/api-inference
  async validate() {
    try {
      const res = await fetch('https://huggingface.co/api/whoami-v2', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.name || data.type)) return { ok: true };
        return { ok: true };
      }
      if (res.status === 401) return { ok: false, error: '[Hugging Face] Token invalide ou révoqué.', status: 401 };
      if (res.status === 403) return { ok: false, error: '[Hugging Face] Token sans permission inference suffisante.', status: 403 };
      return { ok: false, error: `[Hugging Face] HTTP ${res.status}`, status: res.status };
    } catch {
      // CORS sur whoami-v2 → on tente le router chat
      try {
        const r2 = await super.validate();
        if (r2.ok) return r2;
        if (r2.status === 401 || r2.status === 403) return r2;
      } catch {}
      return { ok: false, error: 'BROWSER_INCOMPATIBLE:huggingface', status: 0 };
    }
  }
}
