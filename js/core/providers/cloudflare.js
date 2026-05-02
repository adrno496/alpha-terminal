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
    const raw = (this.apiKey || '').trim();
    if (!raw) return { ok: false, error: '[Cloudflare] Clé vide.' };

    // L'endpoint /user/tokens/verify accepte juste le token (pas besoin d'account_id).
    // C'est l'endpoint officiel de validation Cloudflare. CORS-friendly.
    const { accountId, token } = this._parseKey();
    const tokenOnly = token || raw; // si pas de ':', traite tout comme token

    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenOnly}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success === true && data.result?.status === 'active') {
        // Token valide — vérifie aussi qu'on a l'account_id pour pouvoir utiliser Workers AI
        if (!accountId) {
          return { ok: false, error: '[Cloudflare] Token valide ✓ mais format attendu pour Workers AI : ACCOUNT_ID:API_TOKEN. Trouve ton Account ID sur dash.cloudflare.com → sidebar droite.' };
        }
        return { ok: true };
      }
      if (res.status === 401 || (data && data.success === false)) {
        const msg = data?.errors?.[0]?.message || 'Token invalide';
        return { ok: false, error: `[Cloudflare] ${msg}`, status: res.status };
      }
      return { ok: false, error: `[Cloudflare] HTTP ${res.status}`, status: res.status };
    } catch (e) {
      return { ok: false, error: `[Cloudflare] ${e?.message || 'Erreur réseau'} — vérifie que le token n'a pas expiré.` };
    }
  }
}
