// Cerebras Cloud — https://inference-docs.cerebras.ai/
// Ultra-fast Llama / Qwen inference (>2000 tok/s on Llama 3.1 70B)
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { validateViaGet } from './base.js';

export class CerebrasProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'cerebras',
      displayName: 'Cerebras',
      icon: '⚡',
      baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
      defaultModels: {
        flagship: 'llama-3.3-70b',
        balanced: 'llama-3.1-70b',
        fast: 'llama-3.1-8b'
      }
    });
  }

  // Override : GET /v1/models léger.
  async validate() {
    return validateViaGet(this.displayName, 'https://api.cerebras.ai/v1/models', {
      'Authorization': `Bearer ${this.apiKey}`
    });
  }
}
