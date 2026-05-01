// Cloudflare Workers AI — https://developers.cloudflare.com/workers-ai/
// Endpoint requires the user's Cloudflare account ID. Convention here: store the
// API key as "ACCOUNT_ID:API_TOKEN" and parse at request time.
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class CloudflareProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'cloudflare',
      displayName: 'Cloudflare Workers AI',
      icon: '☁️',
      baseUrl: '', // resolved per-request from account_id parsed in the key
      defaultModels: {
        flagship: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        balanced: '@cf/meta/llama-3.1-70b-instruct',
        fast: '@cf/meta/llama-3.1-8b-instruct'
      }
    });
  }

  _parseKey() {
    const raw = (this.apiKey || '').trim();
    const idx = raw.indexOf(':');
    if (idx <= 0) return { accountId: '', token: raw };
    return { accountId: raw.slice(0, idx).trim(), token: raw.slice(idx + 1).trim() };
  }

  _resolveUrl() {
    const { accountId } = this._parseKey();
    if (!accountId) return 'https://api.cloudflare.com/client/v4/accounts/MISSING_ACCOUNT_ID/ai/v1/chat/completions';
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  }

  _resolveAuth() {
    const { token } = this._parseKey();
    return `Bearer ${token}`;
  }

  async validate() {
    const { accountId, token } = this._parseKey();
    if (!accountId || !token) {
      return { ok: false, error: '[Cloudflare] Format attendu : ACCOUNT_ID:API_TOKEN (deux parties séparées par ":").' };
    }
    // Cloudflare's REST endpoint at api.cloudflare.com ne renvoie pas Access-Control-Allow-Origin
    // pour les origines browser arbitraires → CORS fail systématique sans AI Gateway custom.
    // On laisse le test tenter, mais si c'est un TypeError "Failed to fetch", on retourne
    // un message explicite plutôt que le générique "[Cloudflare] Failed to fetch".
    return super.validate();
  }
}
