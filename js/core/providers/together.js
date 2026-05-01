// Together AI — https://docs.together.ai/
// OpenAI-compatible inference for open-source models.
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class TogetherProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'together',
      displayName: 'Together AI',
      icon: '🟣',
      baseUrl: 'https://api.together.xyz/v1/chat/completions',
      defaultModels: {
        flagship: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        balanced: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
        fast: 'meta-llama/Llama-3.1-8B-Instruct-Turbo'
      },
      // Together free tier ne donne accès qu'aux modèles `-Free`. Si le compte
      // n'a pas de crédit, seul ces modèles passent. Chaîne de fallback :
      // -Free → Turbo standard (avec/sans préfixe Meta-).
      validateModels: [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        'meta-llama/Llama-3.1-8B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'meta-llama/Llama-3.3-70B-Instruct-Turbo'
      ]
    });
  }
}
