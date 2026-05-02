// Cohere — https://docs.cohere.com/reference/chat
// v2 chat endpoint accepts OpenAI-style "messages" but uses different field names
// for response/usage. SSE streaming format is also Cohere-specific.
import { BaseProvider, consumeSSE, friendlyHttpError, makeHttpError, withTimeout, validateViaGet } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const URL = 'https://api.cohere.com/v2/chat';

export class CohereProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'cohere';
    this.displayName = 'Cohere';
    this.icon = '🟦';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of (MODEL_CATALOG.cohere || [])) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: false,
      supportsImages: false,
      supportsWebSearch: true, // Command R+ supports tool/web_search
      supportsXSearch: false,
      supportsLongContext: true,
      models: {
        flagship: this.modelOverrides.flagship || 'command-r-plus-08-2024',
        balanced: this.modelOverrides.balanced || 'command-r-08-2024',
        fast:     this.modelOverrides.fast     || 'command-r7b-12-2024'
      },
      pricing
    };
  }

  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('cohere', model);
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
        'accept': body.stream ? 'text/event-stream' : 'application/json'
      },
      body: JSON.stringify(body),
      signal: withTimeout(signal, body.stream ? 120_000 : 60_000)
    });
  }

  async validate() {
    // Endpoint léger : GET /v1/models. Aucun coût.
    return validateViaGet(this.displayName, 'https://api.cohere.ai/v1/models', {
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
    // Cohere v2 chat: data.message.content[0].text
    let text = '';
    if (Array.isArray(data.message?.content)) {
      text = data.message.content.map(c => c.text || '').filter(Boolean).join('');
    } else if (typeof data.message?.content === 'string') {
      text = data.message.content;
    }
    const u = {
      input: data.usage?.tokens?.input_tokens || data.usage?.billed_units?.input_tokens || 0,
      output: data.usage?.tokens?.output_tokens || data.usage?.billed_units?.output_tokens || 0
    };
    return {
      text, raw: data, usage: u,
      costUSD: this.estimateCostUSD(u.input, u.output, body.model),
      model: body.model
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
    const modelUsed = body.model;
    await consumeSSE(res, (evt) => {
      // Cohere v2 stream: { type: 'content-delta', delta: { message: { content: { text: '...' } } } }
      if (evt.type === 'content-delta') {
        const t = evt.delta?.message?.content?.text || '';
        if (t) {
          fullText += t;
          onDelta && onDelta(t, fullText);
        }
      } else if (evt.type === 'message-end') {
        const u = evt.delta?.usage?.tokens || evt.delta?.usage?.billed_units;
        if (u) {
          usage.input = u.input_tokens || usage.input;
          usage.output = u.output_tokens || usage.output;
        }
      }
    });
    return {
      text: fullText, usage,
      costUSD: this.estimateCostUSD(usage.input, usage.output, modelUsed),
      model: modelUsed
    };
  }
}
