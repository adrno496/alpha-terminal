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

// Erreur enrichie avec status HTTP (utilisée par l'orchestrator pour le retry 429)
export function makeHttpError(status, text, providerName, retryAfter) {
  const err = new Error(friendlyHttpError(status, text, providerName));
  err.status = status;
  err.providerName = providerName;
  if (retryAfter != null) err.retryAfter = retryAfter;
  return err;
}

// Timeout helper. Compose un AbortSignal user (optionnel) avec un timeout.
// Retourne un signal qui s'abort si l'un des deux trigger.
//   const signal = withTimeout(userSignal, 30_000);
//   fetch(url, { signal });
const DEFAULT_TIMEOUT_MS = 60_000;

export function withTimeout(userSignal, ms = DEFAULT_TIMEOUT_MS) {
  // AbortSignal.any est natif depuis Chrome 116/Safari 17.4 — fallback manuel sinon
  const timeoutSignal = AbortSignal.timeout
    ? AbortSignal.timeout(ms)
    : (() => {
        const c = new AbortController();
        setTimeout(() => c.abort(new DOMException('Request timed out', 'TimeoutError')), ms);
        return c.signal;
      })();
  if (!userSignal) return timeoutSignal;
  if (AbortSignal.any) {
    try { return AbortSignal.any([userSignal, timeoutSignal]); } catch {}
  }
  // Fallback : combiner manuellement
  const combined = new AbortController();
  const onAbort = () => combined.abort(userSignal.reason || timeoutSignal.reason);
  if (userSignal.aborted) onAbort();
  else userSignal.addEventListener('abort', onAbort, { once: true });
  if (timeoutSignal.aborted) onAbort();
  else timeoutSignal.addEventListener('abort', onAbort, { once: true });
  return combined.signal;
}

// Wrapper user-friendly pour catch les erreurs réseau (timeout vs autre)
export function isTimeoutError(err) {
  if (!err) return false;
  if (err.name === 'TimeoutError' || err.name === 'AbortError') {
    if ((err.message || '').toLowerCase().includes('timed out')) return true;
    if (err.cause && err.cause.name === 'TimeoutError') return true;
  }
  return false;
}

// Détecte les erreurs "Failed to fetch" qui sont presque toujours du CORS
// (l'API ne renvoie pas Access-Control-Allow-Origin pour notre origine browser).
// `fetch` jette un TypeError sans status ni body — impossible de distinguer
// CORS pur d'une vraie erreur réseau, mais le contexte (browser BYOK) rend
// CORS la cause la plus probable.
export function isLikelyCORSError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return err.name === 'TypeError' && (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||         // Safari
    msg.includes('network request failed') // Firefox
  );
}

// Wrap un message d'erreur de validate() avec hint CORS si applicable.
export function corsHint(providerName, err) {
  if (!isLikelyCORSError(err)) return null;
  return `[${providerName}] L'API a refusé l'appel depuis le navigateur (CORS). Cette plateforme ne permet pas les appels directs depuis un browser — utilise OpenRouter ou Hugging Face Router pour accéder à ces modèles.`;
}

// Valide une clé en essayant plusieurs modèles (parfois le default n'est pas
// disponible pour le tier de l'utilisateur). Retourne dès qu'un modèle réussit.
// Si tous échouent : retourne la dernière erreur (en privilégiant les vraies
// erreurs d'auth 401/403 sur les 404 model-not-found).
export async function validateWithModelFallbacks(displayName, models, doFetch) {
  let lastAuthErr = null;
  let lastOtherErr = null;
  for (const model of models) {
    try {
      const res = await doFetch(model);
      if (res.ok) return { ok: true, modelTested: model };
      const t = await res.text();
      const status = res.status;
      const hint = friendlyHttpError(status, t, displayName);
      if (status === 401 || status === 403) {
        // Vraie erreur d'auth : la clé est rejetée. Inutile de tester d'autres modèles.
        return { ok: false, error: hint, status };
      }
      // 404 / 400 / autre : peut-être juste un model name pas disponible — on retente.
      lastOtherErr = { ok: false, error: hint, status };
    } catch (e) {
      const cors = corsHint(displayName, e);
      if (cors) return { ok: false, error: cors, isCors: true };
      lastOtherErr = { ok: false, error: `[${displayName}] ${e.message}` };
    }
  }
  return lastAuthErr || lastOtherErr || { ok: false, error: `[${displayName}] Validation échouée` };
}
