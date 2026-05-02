// Stockage des clés "données financières" (en clair pour l'instant — usage local seulement)
// Future : intégrer dans le vault chiffré comme les LLM keys

const KEY = 'alpha-terminal:data-keys';

// Providers de DONNÉES (key requise — intégration active dans data-context)
export const DATA_PROVIDERS = [
  { id: 'fmp',            label: 'Financial Modeling Prep',    desc: 'Statements, ratios, structured 10-K · ★ recommended',  link: 'https://site.financialmodelingprep.com/developer/docs' },
  { id: 'alphavantage',   label: 'Alpha Vantage',              desc: 'Stock prices, fundamentals · 25 req/day free',         link: 'https://www.alphavantage.co/support/#api-key' },
  { id: 'finnhub',        label: 'Finnhub',                    desc: 'Quote, news, earnings · 60 req/min free',              link: 'https://finnhub.io/register' },
  { id: 'polygon',        label: 'Polygon.io',                 desc: 'EOD quotes, news, ticker details · 5 req/min free',    link: 'https://polygon.io/dashboard/api-keys' },
  { id: 'tiingo',         label: 'Tiingo',                     desc: 'IEX quotes, news, crypto · 500 req/hour free',         link: 'https://api.tiingo.com/account/api/token' },
  { id: 'twelvedata',     label: 'Twelve Data',                desc: 'Real-time prices, forex, ETF (★ best for European ETF) · 800 req/day free', link: 'https://twelvedata.com/pricing' },
  { id: 'fred',           label: 'FRED API',                   desc: 'US macro indicators · unlimited free',                 link: 'https://fred.stlouisfed.org/docs/api/api_key.html' },
  { id: 'etherscan',      label: 'Etherscan',                  desc: 'On-chain ETH (balance, contracts) · 100k req/day',     link: 'https://etherscan.io/myapikey' },
  { id: 'metals_api',     label: 'Metals-API',                 desc: 'Spot Or/Argent/Platine/Palladium · 50 req/mois free',  link: 'https://metals-api.com/register' }
];

// Sources gratuites SANS clé requise (intégrées automatiquement dans data-context)
export const KEYLESS_DATA_SOURCES = [
  { id: 'coingecko_free', label: 'CoinGecko',  desc: 'Crypto prices/market data (free, no key)' },
  { id: 'defillama',      label: 'DefiLlama',  desc: 'DeFi TVL, fees, yields (free, no key)' },
  { id: 'edgar',          label: 'SEC EDGAR',  desc: '10-K/10-Q/8-K filings (free, no key)' },
  { id: 'frankfurter',    label: 'Frankfurter',desc: 'ECB FX rates (free, no key)' }
];

export function getDataKeys() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

export function setDataKey(id, value) {
  const keys = getDataKeys();
  if (value) keys[id] = value;
  else delete keys[id];
  localStorage.setItem(KEY, JSON.stringify(keys));
}

export function getDataKey(id) {
  return getDataKeys()[id] || null;
}

// Statut : 'set' / 'empty'. Validation réelle = future quand les intégrations seront actives.
export function getDataKeyStatus(id) {
  return getDataKey(id) ? 'set' : 'empty';
}

// === Validation réelle des clés data via appel minimal ===
// Chaque provider est testé via son endpoint le moins coûteux.
// Retour : { ok: bool, error?: string, status?: number }
// Conventions :
//   - 429 → { ok: true } (rate limit ⇒ la clé existe)
//   - 5xx → { ok: true } (serveur du provider, pas la faute de la clé)
//   - 401/403 → { ok: false, error: ... } (clé invalide / scope manquant)
//   - TypeError "Failed to fetch" → message CORS actionnable
export async function validateDataKey(id, key) {
  if (!key || !String(key).trim()) return { ok: false, error: 'Clé vide' };
  const k = String(key).trim();
  try {
    let url, parser;
    switch (id) {
      case 'fmp': {
        // FMP a migré vers la "Stable API" en 2024-2025 (docs officielles :
        // https://site.financialmodelingprep.com/developer/docs).
        // Deux méthodes d'auth supportées :
        //   1. Header : `apikey: KEY` (recommandé par FMP, plus sécurisé)
        //   2. URL : `?apikey=KEY` (legacy, encore actif)
        // On essaie 3 endpoints en cascade pour maximiser les chances de succès :
        //   1. Stable API /stable/profile (nouveau, free tier)
        //   2. Legacy /api/v3/quote (free tier toujours actif)
        //   3. Legacy /api/v3/profile (free tier toujours actif)
        //
        // Pour chacun on utilise les 2 méthodes d'auth (header + URL) — couvre
        // les cas où le tier free n'autorise qu'une des deux.
        const symbol = 'AAPL';
        const candidates = [
          { name: 'Stable API /profile',  url: `https://financialmodelingprep.com/stable/profile?symbol=${symbol}` },
          { name: 'v3 /quote',            url: `https://financialmodelingprep.com/api/v3/quote/${symbol}` },
          { name: 'v3 /profile',          url: `https://financialmodelingprep.com/api/v3/profile/${symbol}` },
          { name: 'v3 /quote-short',      url: `https://financialmodelingprep.com/api/v3/quote-short/${symbol}` }
        ];

        // Tentative chaînée : pour chaque endpoint, on essaie d'abord avec header
        // `apikey: KEY` (méthode officielle recommandée), puis URL `?apikey=KEY`.
        let lastError = 'Tous les endpoints FMP ont échoué';
        let lastStatus = null;
        for (const cand of candidates) {
          // Tentative 1 : header apikey
          try {
            const r1 = await fetch(cand.url, {
              method: 'GET',
              cache: 'no-store',
              headers: { 'apikey': k, 'Accept': 'application/json' }
            });
            if (r1.status === 401) { lastError = 'Clé invalide ou révoquée.'; lastStatus = 401; continue; }
            if (r1.status === 403) { lastError = 'Clé valide mais accès refusé (tier insuffisant pour cet endpoint).'; lastStatus = 403; continue; }
            if (r1.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
            if (r1.status >= 500) { lastError = `Provider error ${r1.status}`; lastStatus = r1.status; continue; }
            if (r1.ok) {
              const j = await r1.json().catch(() => null);
              if (Array.isArray(j) && j.length > 0 && (j[0].symbol || j[0].companyName)) {
                return { ok: true };
              }
              if (j && typeof j === 'object' && (j.symbol || j.companyName)) return { ok: true };
              if (j && j['Error Message']) { lastError = j['Error Message']; continue; }
            }
          } catch (e) {
            // Réseau / CORS — on essaie l'URL param en fallback
          }
          // Tentative 2 : URL ?apikey=
          try {
            const sep = cand.url.includes('?') ? '&' : '?';
            const r2 = await fetch(`${cand.url}${sep}apikey=${encodeURIComponent(k)}`, {
              method: 'GET',
              cache: 'no-store',
              headers: { 'Accept': 'application/json' }
            });
            if (r2.status === 401) { lastError = 'Clé invalide ou révoquée.'; lastStatus = 401; continue; }
            if (r2.status === 403) { lastError = 'Clé valide mais accès refusé (tier insuffisant pour cet endpoint).'; lastStatus = 403; continue; }
            if (r2.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
            if (r2.status >= 500) { lastError = `Provider error ${r2.status}`; lastStatus = r2.status; continue; }
            if (r2.ok) {
              const j = await r2.json().catch(() => null);
              if (Array.isArray(j) && j.length > 0 && (j[0].symbol || j[0].companyName)) return { ok: true };
              if (j && typeof j === 'object' && (j.symbol || j.companyName)) return { ok: true };
              if (j && j['Error Message']) { lastError = j['Error Message']; continue; }
            }
          } catch (e) {
            // Si même URL fallback échoue, on passe au candidat suivant
            lastError = e?.message || 'Erreur réseau';
          }
        }
        return { ok: false, error: lastError, status: lastStatus };
      }
      case 'alphavantage':
        url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          const j = await r.json().catch(() => ({}));
          if (j['Error Message']) return { ok: false, error: j['Error Message'] };
          if (j['Note'] && /invalid api key/i.test(j['Note'])) return { ok: false, error: 'Clé invalide' };
          // "Note" sans "invalid" = rate limit (Alpha Vantage utilise 200 + Note pour quota)
          if (j['Note'] && /thank you/i.test(j['Note'])) return { ok: true, note: 'rate-limited but key valid' };
          if (j['Information'] && /(invalid|premium)/i.test(j['Information'])) return { ok: false, error: j['Information'].slice(0, 120) };
          if (j['Information']) return { ok: true, note: 'rate-limited but key valid' };
          if (j['Global Quote']) return { ok: true };
          return { ok: false, error: 'Format réponse inconnu' };
        };
        break;
      case 'finnhub':
        url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401) return { ok: false, error: 'Clé invalide ou révoquée.', status: 401 };
          if (r.status === 403) return { ok: false, error: 'Clé valide mais accès refusé.', status: 403 };
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          const j = await r.json().catch(() => ({}));
          if (j.error) return { ok: false, error: j.error };
          if (typeof j.c === 'number') return { ok: true };
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      case 'polygon':
        url = `https://api.polygon.io/v3/reference/tickers/AAPL?apiKey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401) return { ok: false, error: 'Clé invalide ou révoquée.', status: 401 };
          if (r.status === 403) return { ok: false, error: 'Clé valide mais accès refusé (tier insuffisant).', status: 403 };
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          const j = await r.json().catch(() => ({}));
          if (j.status === 'ERROR' || j.error) return { ok: false, error: j.error || j.message || 'Erreur API' };
          if (j.results) return { ok: true };
          return { ok: false, error: 'Format inattendu' };
        };
        break;
      case 'tiingo':
        // Endpoint officiel de test : /api/test
        url = `https://api.tiingo.com/api/test?token=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.ok) return { ok: true };
          if (r.status === 401) return { ok: false, error: 'Token invalide ou révoqué.', status: 401 };
          if (r.status === 403) return { ok: false, error: 'Token valide mais accès refusé.', status: 403 };
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          return { ok: false, error: `HTTP ${r.status}`, status: r.status };
        };
        break;
      case 'twelvedata':
        url = `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          const j = await r.json().catch(() => ({}));
          if (j.code === 401) return { ok: false, error: j.message || 'Clé invalide ou révoquée.', status: 401 };
          if (j.code === 403) return { ok: false, error: j.message || 'Clé valide mais accès refusé.', status: 403 };
          if (j.code === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (j.code === 400) return { ok: false, error: j.message || 'Requête mal formée' };
          if (j.status === 'error') return { ok: false, error: j.message || 'Erreur API' };
          if (j.symbol) return { ok: true };
          return { ok: false, error: 'Format inattendu' };
        };
        break;
      case 'fred':
        // /fred/series (metadata) est plus léger que /observations et plus tolérant.
        // FRED API supporte CORS depuis 2023 sur les endpoints GET.
        url = `https://api.stlouisfed.org/fred/series?series_id=DGS10&api_key=${encodeURIComponent(k)}&file_type=json`;
        parser = async (r) => {
          if (r.status === 400) {
            const text = await r.text();
            try {
              const j = JSON.parse(text);
              if (j.error_message && /api.?key/i.test(j.error_message)) {
                return { ok: false, error: 'Clé FRED invalide ou format incorrect' };
              }
              return { ok: false, error: j.error_message || 'Erreur 400' };
            } catch {
              return { ok: false, error: 'Erreur 400: ' + text.slice(0, 80) };
            }
          }
          if (r.status === 401) return { ok: false, error: 'Clé invalide ou révoquée.', status: 401 };
          if (r.status === 403) return { ok: false, error: 'Clé valide mais accès refusé.', status: 403 };
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, status: r.status };
          // 200 → on parse pour valider la structure mais on est tolérant
          const text = await r.text();
          let j; try { j = JSON.parse(text); } catch { return { ok: true }; /* 200 + non-JSON = clé OK */ }
          if (j.seriess && j.seriess.length > 0) return { ok: true };
          // Réponse vide mais 200 = clé probablement OK
          return { ok: true };
        };
        break;
      case 'etherscan':
        // Etherscan a migré vers V2 multichain en 2024. V2 nécessite chainid=1 pour Ethereum.
        // V1 (api.etherscan.io/api) reste compatible mais peut retourner des erreurs sur les
        // nouvelles clés. On utilise V2 avec chainid=1 par défaut.
        url = `https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethsupply&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401) return { ok: false, error: 'Clé invalide ou révoquée.', status: 401 };
          if (r.status === 403) return { ok: false, error: 'Clé valide mais accès refusé.', status: 403 };
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          const text = await r.text();
          let j; try { j = JSON.parse(text); } catch { return { ok: false, error: 'Réponse non-JSON' }; }
          // Format Etherscan : { status: '1'|'0', message: 'OK'|'NOTOK', result: '...' }
          if (j.status === '1') return { ok: true };
          if (j.message === 'NOTOK' && j.result) {
            // Erreur typique : "Invalid API Key" ou "Max calls per sec rate limit reached (5/sec)"
            if (/invalid.*api.?key/i.test(j.result)) return { ok: false, error: 'Clé invalide' };
            if (/rate limit/i.test(j.result)) return { ok: true }; // Rate limit = clé valide mais trop d'appels
            return { ok: false, error: j.result };
          }
          // Fallback V1 si V2 ne répond pas comme prévu
          try {
            const r2 = await fetch(`https://api.etherscan.io/api?module=stats&action=ethsupply&apikey=${encodeURIComponent(k)}`, { cache: 'no-store' });
            const j2 = await r2.json();
            if (j2.status === '1') return { ok: true };
            if (j2.result && /rate limit/i.test(j2.result)) return { ok: true };
            return { ok: false, error: j2.result || j2.message || 'Réponse inattendue' };
          } catch {
            return { ok: false, error: 'Validation échouée (V1 + V2)' };
          }
        };
        break;
      case 'metals_api':
        url = `https://metals-api.com/api/latest?access_key=${encodeURIComponent(k)}&base=USD&symbols=XAU`;
        parser = async (r) => {
          if (r.status === 429) return { ok: true, status: 429, note: 'rate-limited but key valid' };
          if (r.status >= 500) return { ok: true, status: r.status, note: 'provider error' };
          const j = await r.json().catch(() => ({}));
          if (j.success === true) return { ok: true };
          if (j.error) {
            const code = j.error.code;
            const info = j.error.info || j.error.type || 'Erreur API';
            // 101 = invalid_access_key, 102 = inactive, 105 = function_access_restricted
            if (code === 101 || code === 102 || /invalid|access/i.test(String(j.error.type || ''))) {
              return { ok: false, error: info, status: 401 };
            }
            if (code === 104 || /usage_limit|monthly/i.test(info)) {
              return { ok: true, note: 'rate-limited but key valid' };
            }
            return { ok: false, error: info };
          }
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      default:
        return { ok: false, error: 'Provider inconnu' };
    }
    const res = await fetch(url, { cache: 'no-store' });
    return await parser(res);
  } catch (e) {
    const msg = e?.message || 'Erreur réseau';
    // Détection CORS : "Failed to fetch" / "NetworkError" sont les patterns Chrome/Firefox/Safari
    // pour un blocage CORS. On retourne un message actionnable.
    if (/failed to fetch|networkerror|cors/i.test(msg)) {
      return { ok: false, error: 'CORS bloqué : ce provider ne permet pas la validation depuis le navigateur. La clé peut être valide — teste-la directement en lançant une analyse.' };
    }
    return { ok: false, error: msg };
  }
}
