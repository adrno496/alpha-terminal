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
      }
    });
  }
}
