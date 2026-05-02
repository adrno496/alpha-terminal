// Provider OpenRouter — proxy LLM aggregator (200+ modèles)
// API OpenAI-compatible : https://openrouter.ai/api/v1/chat/completions
import { BaseProvider, consumeSSE, friendlyHttpError, makeHttpError, withTimeout, validateViaGet } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'openrouter';
    this.displayName = 'OpenRouter';
    this.icon = '🌀';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of MODEL_CATALOG.openrouter) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: false, // dépend du modèle, mais on assume non
      supportsImages: true,
      supportsWebSearch: false,
      supportsXSearch: false,
      supportsLongContext: true,
      models: {
        flagship: this.modelOverrides.flagship || 'anthropic/claude-opus-4',
        balanced: this.modelOverrides.balanced || 'openai/gpt-5-mini',
        fast:     this.modelOverrides.fast     || 'meta-llama/llama-3.3-70b-instruct',
      },
      pricing
    };
  }
  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('openrouter', model);
    if (!p) return 0;
    return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  }

  _buildBody(params) {
    const msgs = [];
    if (params.system) msgs.push({ role: 'system', content: params.system });
    for (const m of (params.messages || [])) {
      let content = m.content;
      if (Array.isArray(content)) content = content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('\n');
      msgs.push({ role: m.role, content });
    }
    const body = {
      model: params.model,
      messages: msgs,
      max_tokens: params.maxTokens || 4096
    };
    if (typeof params.temperature === 'number') body.temperature = params.temperature;
    if (params.stream) body.stream = true;
    return body;
  }

  async _fetch(body, signal) {
    return fetch(URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`,
        'http-referer': 'https://alpha-terminal.local',
        'x-title': 'Alpha'
      },
      body: JSON.stringify(body),
      signal: withTimeout(signal, body.stream ? 120_000 : 60_000)
    });
  }

  async validate() {
    // Format OpenRouter : sk-or-v1-… (~73 chars)
    if (!/^sk-or-v1-[a-f0-9]{60,}$/.test(this.apiKey)) {
      return { ok: false, error: '[OpenRouter] Format de clé invalide. Format attendu : sk-or-v1-…', status: 400 };
    }
    return validateViaGet(this.displayName, 'https://openrouter.ai/api/v1/key', {
      'Authorization': `Bearer ${this.apiKey}`
    });
  }

  async call(params) {
    const body = this._buildBody(params);
    const res = await this._fetch(body, params.signal);
    if (!res.ok) {
      const t = await res.text();
      throw makeHttpError(res.status, t, this.displayName, res.headers.get('Retry-After'));
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const u = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0
    };
    return {
      text, raw: data, usage: u,
      costUSD: this.estimateCostUSD(u.input, u.output, data.model || body.model),
      model: data.model || body.model
    };
  }

  async stream(params, { onDelta } = {}) {
    const body = this._buildBody({ ...params, stream: true });
    body.stream_options = { include_usage: true };
    const res = await this._fetch(body, params.signal);
    if (!res.ok) {
      const t = await res.text();
      throw makeHttpError(res.status, t, this.displayName, res.headers.get('Retry-After'));
    }
    let fullText = '';
    let usage = { input: 0, output: 0 };
    let modelUsed = body.model;
    await consumeSSE(res, (evt) => {
      if (evt.choices?.[0]?.delta?.content) {
        const t = evt.choices[0].delta.content;
        fullText += t;
        onDelta && onDelta(t, fullText);
      }
      if (evt.model) modelUsed = evt.model;
      if (evt.usage) {
        usage.input = evt.usage.prompt_tokens || usage.input;
        usage.output = evt.usage.completion_tokens || usage.output;
      }
    });
    return {
      text: fullText, usage,
      costUSD: this.estimateCostUSD(usage.input, usage.output, modelUsed),
      model: modelUsed
    };
  }
}
