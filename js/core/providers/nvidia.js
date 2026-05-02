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

  // Override : utilise l'endpoint /v1/models (listing) au lieu de POST chat.
  // Plus léger, ne consomme pas de crédit, et plus tolérant côté CORS.
  async validate() {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });
      if (res.ok) return { ok: true };
      if (res.status === 401) {
        return { ok: false, error: '[NVIDIA NIM] Clé invalide ou révoquée.', status: 401 };
      }
      if (res.status === 403) {
        return { ok: false, error: '[NVIDIA NIM] Clé valide mais sans accès aux modèles. Vérifie les crédits restants sur build.nvidia.com.', status: 403 };
      }
      // Si /v1/models n'est pas dispo, fallback sur le POST chat habituel
      return await super.validate();
    } catch (e) {
      // Erreur réseau / CORS
      return await super.validate();
    }
  }
}
