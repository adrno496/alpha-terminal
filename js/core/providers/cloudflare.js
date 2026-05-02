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

    // Format Cloudflare : ACCOUNT_ID:cfut_xxx ou juste cfut_xxx
    // ACCOUNT_ID = 32 hex chars · cfut_xxx = ~40 chars typiquement
    const cfTokenPart = raw.includes(':') ? raw.split(':')[1] : raw;
    if (!/^(cfut_)?[A-Za-z0-9_-]{20,}$/.test(cfTokenPart)) {
      return { ok: false, error: '[Cloudflare] Format de token invalide. Format attendu : ACCOUNT_ID:cfut_… (ou cfut_… seul).', status: 400 };
    }
    // Si format ACCOUNT_ID:TOKEN, vérifie que ACCOUNT_ID ressemble à un hex 32 chars
    if (raw.includes(':')) {
      const accId = raw.split(':')[0];
      if (!/^[a-f0-9]{32}$/i.test(accId)) {
        return { ok: false, error: '[Cloudflare] Account ID invalide. Doit être 32 caractères hex (trouvé : ' + accId.length + ' chars). Récupère-le sur dash.cloudflare.com → sidebar droite.', status: 400 };
      }
    }

    const { accountId, token } = this._parseKey();
    const tokenOnly = token || raw;

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
      // CORS bloque api.cloudflare.com depuis le browser sauf si AI Gateway custom
      return { ok: false, error: 'BROWSER_INCOMPATIBLE:cloudflare', status: 0 };
    }
  }
}
