// Hugging Face Inference Router — https://huggingface.co/docs/inference-providers/
// One endpoint, multi-provider routing (Together, Fireworks, Cerebras, etc. — billed via HF)
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'huggingface',
      displayName: 'Hugging Face',
      icon: '🤗',
      baseUrl: 'https://router.huggingface.co/v1/chat/completions',
      defaultModels: {
        flagship: 'meta-llama/Llama-3.3-70B-Instruct',
        balanced: 'Qwen/Qwen2.5-72B-Instruct',
        fast: 'meta-llama/Llama-3.1-8B-Instruct'
      }
    });
  }
}
