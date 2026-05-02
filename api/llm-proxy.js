// Vercel Edge Function — proxy CORS pour les providers (LLM + data) qui ne supportent pas
// les browser direct calls. Whitelist stricte. Aucune clé stockée serveur — pass-through.

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = [
  // LLM providers CORS-incompatibles
  'models.github.ai',                  // GitHub Models
  'integrate.api.nvidia.com',          // NVIDIA NIM
  'router.huggingface.co',             // HuggingFace router
  'huggingface.co',                    // HF whoami-v2
  'api.cloudflare.com',                // Cloudflare Workers AI
  // Data providers CORS-blocked depuis le browser
  'api.stlouisfed.org',                // FRED API (Federal Reserve)
  'metals-api.com',                    // Metals-API (or/argent/platine)
  'newsapi.org',                       // NewsAPI (free tier bloque les browser direct calls)
  'api.acleddata.com'                  // ACLED (conflits/géopolitique)
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, apikey',
  'Access-Control-Max-Age': '86400'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  // Sécurité : whitelist stricte des hosts autorisés
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
  if (!ALLOWED_HOSTS.some(h => target.hostname === h || target.hostname.endsWith('.' + h))) {
    return new Response(JSON.stringify({ error: 'Host not allowed', host: target.hostname }), {
      status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  // Forward la requête (clé API dans Authorization passe through, pas stockée)
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('cookie');

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text();
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });
    // Stream la réponse upstream avec headers CORS
    const respHeaders = new Headers(upstream.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => respHeaders.set(k, v));
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: String(e?.message || e) }), {
      status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}
