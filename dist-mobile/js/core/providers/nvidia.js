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
      }
    });
  }
}
