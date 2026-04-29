// Interface commune pour les 4 providers (Claude, OpenAI, Gemini, Grok)
// Chaque provider expose : capabilities, call(), stream(), validate()

export class BaseProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'base';
    this.displayName = 'Base';
  }

  getCapabilities() {
    return {
      supportsPDFNative: false,
      supportsImages: false,
      supportsWebSearch: false,
      supportsXSearch: false,
      supportsLongContext: false,
      models: { flagship: '', balanced: '', fast: '' },
      pricing: {} // {modelId: {input: $/1M, output: $/1M}}
    };
  }

  // Appel non-streaming → { text, usage:{input,output}, costUSD, model }
  async call(_params) { throw new Error('not implemented'); }

  // Appel streaming → { text, usage, costUSD, model } (avec onDelta(chunk, full))
  async stream(_params, _cbs) { throw new Error('not implemented'); }

  // Ping minimal → { ok, error? }
  async validate() { throw new Error('not implemented'); }

  estimateCostUSD(inputTokens, outputTokens, model) {
    const p = this.getCapabilities().pricing[model];
    if (!p) return 0;
    return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  }
}

// Helper SSE générique : itère sur les events `data: {...}\n\n`
export async function consumeSSE(response, parseEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const ev of events) {
      const lines = ev.split('\n');
      let dataStr = '';
      for (const ln of lines) {
        if (ln.startsWith('data:')) dataStr += ln.slice(5).trim();
      }
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        await parseEvent(evt);
      } catch {}
    }
  }
}

// Erreurs HTTP user-friendly
export function friendlyHttpError(status, text, providerName) {
  const t = (text || '').slice(0, 300);
  const prefix = `[${providerName}]`;
  if (status === 401 || status === 403) return `${prefix} Clé API invalide ou refusée. ${t}`;
  if (status === 429) return `${prefix} Rate limit atteint. ${t}`;
  if (status === 529 || status === 503) return `${prefix} Surcharge serveur. Réessaie dans ~30s.`;
  if (status === 400) return `${prefix} Requête mal formée : ${t}`;
  if (status >= 500) return `${prefix} Erreur serveur (${status}).`;
  return `${prefix} HTTP ${status}: ${t}`;
}
