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
        fast: 'meta/Llama-3.2-11B-Vision-Instruct'
      }
    });
  }
}
