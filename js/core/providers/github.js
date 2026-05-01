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
      // GitHub Models exige un PAT avec scope `models:read` (classic) ou
      // permission `Models` (fine-grained). Sans ce scope → 401, peu importe
      // le modèle. gpt-4o-mini est le plus universellement dispo, on l'essaie
      // en premier puis fallback Llama (parfois plus accessible en free tier).
      validateModels: [
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
        'meta/Llama-3.3-70B-Instruct'
      ]
    });
  }
}
