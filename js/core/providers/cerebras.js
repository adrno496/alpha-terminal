// Cerebras Cloud — https://inference-docs.cerebras.ai/
// Ultra-fast Llama / Qwen inference (>2000 tok/s sur Llama 3.3 70B et Qwen3 32B)
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class CerebrasProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'cerebras',
      displayName: 'Cerebras',
      icon: '⚡',
      baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
      defaultModels: {
        // llama-3.1-70b a été déprécié par Cerebras en 2025 — remplacé par llama-3.3-70b
        flagship: 'llama-3.3-70b',
        balanced: 'llama-3.3-70b',
        fast: 'llama-3.1-8b'
      },
      // Pour validate() — teste un VRAI POST chat avec ces modèles, pas juste un GET listing.
      // Ça détecte les modèles dépréciés en plus du token invalide.
      validateModels: ['llama-3.1-8b', 'llama-3.3-70b']
    });
  }

  // Override : format check d'abord, puis super.validate() qui fait un POST chat ping.
  async validate() {
    if (!/^csk-[A-Za-z0-9_-]{30,}$/.test(this.apiKey)) {
      return { ok: false, error: '[Cerebras] Format de clé invalide. Format attendu : csk-…', status: 400 };
    }
    return super.validate();
  }
}
