// Cloudflare Workers AI — https://developers.cloudflare.com/workers-ai/
// Endpoint requires the user's Cloudflare account ID. Convention here: store the
// API key as "ACCOUNT_ID:API_TOKEN" and parse at request time.
import { OpenAICompatibleProvider } from './openai-compatible.js';

// Proxy CORS pour cet endpoint qui ne supporte pas les browser direct calls.
// Si window.ALPHA_CONFIG.LLM_PROXY_URL est défini, on route à travers.
function viaProxy(url) {
  const base = (typeof window !== 'undefined' && window.ALPHA_CONFIG?.LLM_PROXY_URL) || '/api/llm-proxy';
  return `${base}?url=${encodeURIComponent(url)}`;
}

export class CloudflareProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'cloudflare',
      displayName: 'Cloudflare Workers AI',
      icon: '☁️',
      baseUrl: '', // resolved per-request from account_id parsed in the key
      defaultModels: {
        // @cf/meta/llama-3.1-70b-instruct a été déprécié — remplacé par 3.3-70b-fp8-fast
        flagship: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        balanced: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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
    const target = !accountId
      ? 'https://api.cloudflare.com/client/v4/accounts/MISSING_ACCOUNT_ID/ai/v1/chat/completions'
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    return viaProxy(target);
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
      const res = await fetch(viaProxy('https://api.cloudflare.com/client/v4/user/tokens/verify'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenOnly}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success === true && data.result?.status === 'active') {
        // Token valide globalement — il faut aussi qu'il ait la permission Workers AI
        // sur l'account. tokens/verify ne le confirme PAS. On teste en listant les modèles AI.
        if (!accountId) {
          return { ok: false, error: '[Cloudflare] Token valide ✓ mais format attendu pour Workers AI : ACCOUNT_ID:API_TOKEN. Trouve ton Account ID sur dash.cloudflare.com → sidebar droite.' };
        }
        // Vraie vérification de la permission Workers AI : GET listing des modèles AI sur l'account.
        // Si 403 → token sans scope « Account → Workers AI : Read/Edit ».
        // Si 404 → account_id incorrect.
        try {
          const aiRes = await fetch(viaProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=1`), {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenOnly}`, 'Accept': 'application/json' }
          });
          if (aiRes.ok) return { ok: true };
          if (aiRes.status === 403) {
            return { ok: false, error: '[Cloudflare] Token sans permission Workers AI. Recrée-le avec le scope « Account → Workers AI : Edit » sur dash.cloudflare.com/profile/api-tokens.', status: 403 };
          }
          if (aiRes.status === 404) {
            return { ok: false, error: '[Cloudflare] Account ID introuvable côté Workers AI. Vérifie l\'Account ID (32 chars hex sur la sidebar dash.cloudflare.com).', status: 404 };
          }
          // Autre statut : on accepte (le token est valide) mais on warn
          return { ok: true };
        } catch {
          // Si ce 2nd appel CORS-fail, on accepte quand même puisque tokens/verify a réussi
          return { ok: true };
        }
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
