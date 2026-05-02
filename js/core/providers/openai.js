// Provider OpenAI ChatGPT
import { BaseProvider, consumeSSE, friendlyHttpError, makeHttpError, withTimeout, validateViaGet } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'openai';
    this.displayName = 'OpenAI ChatGPT';
    this.icon = '🧠';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of MODEL_CATALOG.openai) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: false,
      supportsImages: true,
      supportsWebSearch: false,
      supportsXSearch: false,
      supportsLongContext: false,
      models: {
        flagship: this.modelOverrides.flagship || 'gpt-5',
        balanced: this.modelOverrides.balanced || 'gpt-5-mini',
        fast:     this.modelOverrides.fast     || 'gpt-5-nano',
      },
      pricing
    };
  }
  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('openai', model);
    if (!p) return 0;
    return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  }

  _buildBody(params) {
    const msgs = [];
    if (params.system) msgs.push({ role: 'system', content: params.system });
    for (const m of (params.messages || [])) {
      // Si content est un tableau de blocks, on extrait le texte. PDFs déjà gérés en amont (extraction texte).
      let content = m.content;
      if (Array.isArray(content)) {
        content = content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('\n');
      }
      msgs.push({ role: m.role, content });
    }
    const body = {
      model: params.model,
      messages: msgs,
      max_completion_tokens: params.maxTokens || 4096
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
      signal: withTimeout(signal, body.stream ? 120_000 : 60_000)
    });
  }

  async validate() {
    // Format OpenAI : sk-proj-… (project keys) ou sk-… (legacy)
    if (!/^sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}$/.test(this.apiKey)) {
      return { ok: false, error: '[OpenAI] Format de clé invalide. Format attendu : sk-… ou sk-proj-…', status: 400 };
    }
    return validateViaGet(this.displayName, 'https://api.openai.com/v1/models', {
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
