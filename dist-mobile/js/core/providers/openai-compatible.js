// Shared base for OpenAI-compatible chat/completions providers.
// Mistral, Cerebras, GitHub Models, NVIDIA NIM, Hugging Face Router,
// Cloudflare Workers AI (with account_id), Together AI all expose
// /v1/chat/completions with OpenAI-style request/response and SSE streaming.

import { BaseProvider, consumeSSE, friendlyHttpError } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

export class OpenAICompatibleProvider extends BaseProvider {
  // Subclasses must set: name, displayName, icon, modelOverrides, BASE_URL,
  // and may override: extraHeaders, defaultModels, _resolveUrl(apiKey, body)
  constructor(apiKey, modelOverrides = {}, opts = {}) {
    super(apiKey);
    this.modelOverrides = modelOverrides;
    this.name = opts.name || 'openai-compat';
    this.displayName = opts.displayName || 'OpenAI-compatible';
    this.icon = opts.icon || '·';
    this.BASE_URL = opts.baseUrl || '';
    this.defaultModels = opts.defaultModels || { flagship: '', balanced: '', fast: '' };
    this.useMaxCompletion = !!opts.useMaxCompletion;
    this.extraHeaders = opts.extraHeaders || {};
    this.authPrefix = opts.authPrefix || 'Bearer';
  }

  getCapabilities() {
    const pricing = {};
    for (const m of (MODEL_CATALOG[this.name] || [])) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: false,
      supportsImages: false,
      supportsWebSearch: false,
      supportsXSearch: false,
      supportsLongContext: false,
      models: {
        flagship: this.modelOverrides.flagship || this.defaultModels.flagship,
        balanced: this.modelOverrides.balanced || this.defaultModels.balanced,
        fast:     this.modelOverrides.fast     || this.defaultModels.fast
      },
      pricing
    };
  }

  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing(this.name, model);
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
    const body = { model: params.model, messages: msgs };
    if (this.useMaxCompletion) body.max_completion_tokens = params.maxTokens || 4096;
    else body.max_tokens = params.maxTokens || 4096;
    if (typeof params.temperature === 'number') body.temperature = params.temperature;
    if (params.stream) body.stream = true;
    return body;
  }

  _resolveUrl(_apiKey, _body) {
    return this.BASE_URL;
  }

  _resolveAuth() {
    return `${this.authPrefix} ${this.apiKey}`;
  }

  async _fetch(body, signal) {
    const url = this._resolveUrl(this.apiKey, body);
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': this._resolveAuth(),
        ...this.extraHeaders
      },
      body: JSON.stringify(body),
      signal
    });
  }

  async validate() {
    try {
      const res = await this._fetch({
        model: this.modelOverrides.fast || this.defaultModels.fast || this.defaultModels.balanced,
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
