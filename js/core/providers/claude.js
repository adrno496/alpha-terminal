// Provider Anthropic Claude
import { BaseProvider, consumeSSE, friendlyHttpError, makeHttpError, withTimeout } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const URL = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export class ClaudeProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'claude';
    this.displayName = 'Anthropic Claude';
    this.icon = '🤖';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of MODEL_CATALOG.claude) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: true,
      supportsImages: true,
      supportsWebSearch: true,
      supportsXSearch: false,
      supportsLongContext: true,
      models: {
        flagship: this.modelOverrides.flagship || 'claude-opus-4-7',
        balanced: this.modelOverrides.balanced || 'claude-sonnet-4-6',
        fast:     this.modelOverrides.fast     || 'claude-haiku-4-5',
      },
      pricing
    };
  }
  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('claude', model);
    if (!p) return 0;
    return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  }

  // Construit les messages au format Anthropic
  // params.messages = [{role,content:string|blocks}], params.files = [{type:'pdf',base64,name}]
  _buildBody(params) {
    const messages = (params.messages || []).map(m => ({ ...m }));
    if (params.files && params.files.length) {
      // Injecte les blocs document dans le dernier message user
      const last = messages[messages.length - 1];
      const blocks = [];
      for (const f of params.files) {
        if (f.type === 'pdf' && f.base64) {
          blocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: f.base64 },
            title: f.name
          });
        }
      }
      if (blocks.length) {
        const txt = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content;
        last.content = [...blocks, ...txt];
      }
    }
    const body = {
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 1.0,
      messages
    };
    if (params.system) body.system = params.system;
    if (params.useWebSearch) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];
    }
    if (params.stream) body.stream = true;
    return body;
  }

  async _fetch(body, signal) {
    return fetch(URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body),
      signal: withTimeout(signal, body.stream ? 120_000 : 60_000)
    });
  }

  async validate() {
    try {
      const res = await this._fetch({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
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
      throw makeHttpError(res.status, t, this.displayName, res.headers.get('Retry-After'));
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').filter(Boolean).join('\n');
    const usage = data.usage || {};
    const u = { input: usage.input_tokens || 0, output: usage.output_tokens || 0 };
    return {
      text,
      raw: data,
      usage: u,
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
      if (evt.type === 'message_start' && evt.message?.usage) {
        usage.input = evt.message.usage.input_tokens || 0;
        modelUsed = evt.message.model || modelUsed;
      } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        const t = evt.delta.text || '';
        fullText += t;
        onDelta && onDelta(t, fullText);
      } else if (evt.type === 'message_delta' && evt.usage) {
        usage.output = evt.usage.output_tokens || usage.output;
      }
    });
    return {
      text: fullText,
      usage,
      costUSD: this.estimateCostUSD(usage.input, usage.output, modelUsed),
      model: modelUsed
    };
  }
}
