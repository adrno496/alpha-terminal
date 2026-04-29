// Provider Perplexity AI — chat avec web search natif intégré
// API OpenAI-compatible : https://api.perplexity.ai/chat/completions
import { BaseProvider, consumeSSE, friendlyHttpError } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const URL = 'https://api.perplexity.ai/chat/completions';

export class PerplexityProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'perplexity';
    this.displayName = 'Perplexity';
    this.icon = '🔎';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of MODEL_CATALOG.perplexity) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: false,
      supportsImages: false,
      supportsWebSearch: true, // ⭐ web search natif
      supportsXSearch: false,
      supportsLongContext: true,
      models: {
        flagship: this.modelOverrides.flagship || 'sonar-pro',
        balanced: this.modelOverrides.balanced || 'sonar',
        fast:     this.modelOverrides.fast     || 'sonar',
      },
      pricing
    };
  }
  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('perplexity', model);
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
        'authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });
  }

  async validate() {
    try {
      const res = await this._fetch({
        model: this.modelOverrides.fast || 'sonar',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8
      });
      if (res.ok) return { ok: true };
      const t = await res.text();
      return { ok: false, error: friendlyHttpError(res.status, t, this.displayName) };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async call(params) {
    const body = this._buildBody(params);
    const res = await this._fetch(body, params.signal);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(friendlyHttpError(res.status, t, this.displayName));
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
      throw new Error(friendlyHttpError(res.status, t, this.displayName));
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
