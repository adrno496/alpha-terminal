// Provider xAI Grok (API OpenAI-compatible)
import { BaseProvider, consumeSSE, friendlyHttpError, makeHttpError, withTimeout, validateWithModelFallbacks } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const URL = 'https://api.x.ai/v1/chat/completions';

export class GrokProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'grok';
    this.displayName = 'xAI Grok';
    this.icon = '🐦';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of MODEL_CATALOG.grok) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: false,
      supportsImages: true,
      supportsWebSearch: true,
      supportsXSearch: true,
      supportsLongContext: true,
      models: {
        flagship: this.modelOverrides.flagship || 'grok-4',
        balanced: this.modelOverrides.balanced || 'grok-3',
        fast:     this.modelOverrides.fast     || 'grok-4-fast',
      },
      pricing
    };
  }
  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('grok', model);
    if (!p) return 0;
    return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  }

  _buildBody(params) {
    const msgs = [];
    if (params.system) msgs.push({ role: 'system', content: params.system });
    for (const m of (params.messages || [])) {
      let content = m.content;
      if (Array.isArray(content)) {
        content = content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('\n');
      }
      msgs.push({ role: m.role, content });
    }
    const body = {
      model: params.model,
      messages: msgs,
      max_tokens: params.maxTokens || 4096
    };
    if (typeof params.temperature === 'number') body.temperature = params.temperature;
    if (params.useWebSearch) {
      // xAI Live Search
      body.search_parameters = { mode: 'on', sources: [{ type: 'web' }, { type: 'x' }] };
    }
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
      signal: withTimeout(signal, body.stream ? 120_000 : 60_000)
    });
  }

  async validate() {
    // xAI fait évoluer son catalogue régulièrement et tous les comptes n'ont
    // pas accès à grok-4. On essaie une chaîne du plus récent au plus universel.
    const models = [
      this.modelOverrides.fast,
      'grok-4-fast',
      'grok-3-mini',
      'grok-3',
      'grok-2-1212',
      'grok-beta'
    ].filter(Boolean);
    return validateWithModelFallbacks(this.displayName, models, async (model) => {
      return this._fetch({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8
      });
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
