// Mistral AI — https://docs.mistral.ai/api/
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { validateViaGet } from './base.js';

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

  // Override : GET /v1/models au lieu de POST chat (aucun coût, pas de modèle requis).
  async validate() {
    // Format Mistral : 32 chars alphanumériques sans préfixe spécifique
    if (!/^[A-Za-z0-9]{20,}$/.test(this.apiKey)) {
      return { ok: false, error: '[Mistral] Format de clé invalide. Doit contenir au moins 20 caractères alphanumériques.', status: 400 };
    }
    return validateViaGet(this.displayName, 'https://api.mistral.ai/v1/models', {
      'Authorization': `Bearer ${this.apiKey}`
    });
  }
}
