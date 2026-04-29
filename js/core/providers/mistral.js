// Mistral AI — https://docs.mistral.ai/api/
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class MistralProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'mistral',
      displayName: 'Mistral AI',
      icon: '🇫🇷',
      baseUrl: 'https://api.mistral.ai/v1/chat/completions',
      defaultModels: {
        flagship: 'mistral-large-latest',
        balanced: 'mistral-medium-latest',
        fast: 'mistral-small-latest'
      }
    });
  }
}
