// Provider Google Gemini
import { BaseProvider, consumeSSE, friendlyHttpError, makeHttpError, withTimeout, validateViaGet } from './base.js';
import { MODEL_CATALOG, modelPricing } from '../models-catalog.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider extends BaseProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey);
    this.name = 'gemini';
    this.displayName = 'Google Gemini';
    this.icon = '✨';
    this.modelOverrides = modelOverrides;
  }

  getCapabilities() {
    const pricing = {};
    for (const m of MODEL_CATALOG.gemini) pricing[m.id] = m.pricing;
    return {
      supportsPDFNative: true,
      supportsImages: true,
      supportsWebSearch: true,
      supportsXSearch: false,
      supportsLongContext: true,
      models: {
        flagship: this.modelOverrides.flagship || 'gemini-2.5-pro',
        balanced: this.modelOverrides.balanced || 'gemini-2.5-flash',
        fast:     this.modelOverrides.fast     || 'gemini-2.5-flash-lite',
      },
      pricing
    };
  }
  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = modelPricing('gemini', model);
    if (!p) return 0;
    return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  }

  _buildBody(params) {
    const contents = [];
    for (const m of (params.messages || [])) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts = [];
      if (Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b.type === 'text') parts.push({ text: b.text });
        }
      } else {
        parts.push({ text: m.content });
      }
      contents.push({ role, parts });
    }
    // Inject PDFs in last user message
    if (params.files && params.files.length) {
      const last = contents[contents.length - 1];
      for (const f of params.files) {
        if (f.type === 'pdf' && f.base64) {
          last.parts.push({ inline_data: { mime_type: 'application/pdf', data: f.base64 } });
        }
      }
    }
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: params.temperature ?? 1.0
      }
    };
    if (params.system) body.systemInstruction = { parts: [{ text: params.system }] };
    if (params.useWebSearch) body.tools = [{ google_search: {} }];
    return body;
  }

  _url(model, action, { sse = false } = {}) {
    // Key passé en HEADER (x-goog-api-key) — JAMAIS en query param.
    // Garde uniquement le path + flag SSE quand streaming.
    return `${BASE}/models/${encodeURIComponent(model)}:${action}${sse ? '?alt=sse' : ''}`;
  }

  _headers() {
    return {
      'content-type': 'application/json',
      'x-goog-api-key': this.apiKey
    };
  }

  async validate() {
    // Endpoint léger officiel : GET /v1beta/models?key=KEY (CORS-enabled).
    const url = `${BASE}/models?key=${encodeURIComponent(this.apiKey)}`;
    return validateViaGet(this.displayName, url);
  }

  async call(params) {
    const body = this._buildBody(params);
    const res = await fetch(this._url(params.model, 'generateContent'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: withTimeout(params.signal, 60_000)
    });
    if (!res.ok) {
      const t = await res.text();
      throw makeHttpError(res.status, t, this.displayName, res.headers.get('Retry-After'));
    }
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').filter(Boolean).join('\n');
    const u = {
      input: data.usageMetadata?.promptTokenCount || 0,
      output: data.usageMetadata?.candidatesTokenCount || 0
    };
    return {
      text, raw: data, usage: u,
      costUSD: this.estimateCostUSD(u.input, u.output, params.model),
      model: params.model
    };
  }

  async stream(params, { onDelta } = {}) {
    const body = this._buildBody(params);
    const res = await fetch(this._url(params.model, 'streamGenerateContent', { sse: true }), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: withTimeout(params.signal, 120_000)
    });
    if (!res.ok) {
      const t = await res.text();
      throw makeHttpError(res.status, t, this.displayName, res.headers.get('Retry-After'));
    }
    let fullText = '';
    let usage = { input: 0, output: 0 };
    await consumeSSE(res, (evt) => {
      const parts = evt.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.text) {
          fullText += p.text;
          onDelta && onDelta(p.text, fullText);
        }
      }
      if (evt.usageMetadata) {
        usage.input = evt.usageMetadata.promptTokenCount || usage.input;
        usage.output = evt.usageMetadata.candidatesTokenCount || usage.output;
      }
    });
    return {
      text: fullText, usage,
      costUSD: this.estimateCostUSD(usage.input, usage.output, params.model),
      model: params.model
    };
  }
}
