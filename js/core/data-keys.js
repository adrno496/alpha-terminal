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
// Retour : { ok: bool, error?: string }
export async function validateDataKey(id, key) {
  if (!key || !String(key).trim()) return { ok: false, error: 'Clé vide' };
  const k = String(key).trim();
  try {
    let url, parser;
    switch (id) {
      case 'fmp':
        // /quote-short est l'endpoint le plus léger toujours dispo en free tier.
        // Retourne juste { symbol, price, volume } — utilisé pour valider la clé.
        url = `https://financialmodelingprep.com/api/v3/quote-short/AAPL?apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide (401/403)' };
          if (r.status === 429) return { ok: false, error: 'Quota dépassé (réessaie demain)' };
          const text = await r.text();
          let j; try { j = JSON.parse(text); } catch { return { ok: false, error: 'Réponse non-JSON: ' + text.slice(0, 60) }; }
          if (j && j['Error Message']) return { ok: false, error: j['Error Message'] };
          if (Array.isArray(j) && j.length > 0 && j[0].symbol) return { ok: true };
          // Tolérant : si 200 + JSON vide, on essaie le fallback /profile
          if (r.ok && Array.isArray(j) && j.length === 0) {
            // Probable que la clé est OK mais le tier free a des limites — on retente avec /profile
            try {
              const r2 = await fetch(`https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${encodeURIComponent(k)}`, { cache: 'no-store' });
              if (r2.ok) {
                const j2 = await r2.json();
                if (Array.isArray(j2) && j2.length > 0) return { ok: true };
              }
            } catch {}
            return { ok: false, error: 'Réponse vide — tier limité ?' };
          }
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      case 'alphavantage':
        url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          const j = await r.json();
          if (j['Error Message']) return { ok: false, error: j['Error Message'] };
          if (j['Note'] && /invalid api key/i.test(j['Note'])) return { ok: false, error: 'Clé invalide' };
          if (j['Information'] && /api key/i.test(j['Information'])) return { ok: false, error: j['Information'].slice(0, 80) };
          if (j['Global Quote']) return { ok: true };
          return { ok: false, error: 'Format réponse inconnu' };
        };
        break;
      case 'finnhub':
        url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide' };
          const j = await r.json();
          if (j.error) return { ok: false, error: j.error };
          if (typeof j.c === 'number') return { ok: true };
          return { ok: false, error: 'Réponse inattendue' };
        };
        break;
      case 'polygon':
        url = `https://api.polygon.io/v3/reference/tickers/AAPL?apiKey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide (401/403)' };
          const j = await r.json();
          if (j.status === 'ERROR' || j.error) return { ok: false, error: j.error || j.message || 'Erreur API' };
          if (j.results) return { ok: true };
          return { ok: false, error: 'Format inattendu' };
        };
        break;
      case 'tiingo':
        // Endpoint officiel de test : /api/test
        url = `https://api.tiingo.com/api/test?token=${encodeURIComponent(k)}`;
        parser = async (r) => {
          if (r.status === 401) return { ok: false, error: 'Token invalide' };
          if (r.ok) return { ok: true };
          return { ok: false, error: `HTTP ${r.status}` };
        };
        break;
      case 'twelvedata':
        url = `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${encodeURIComponent(k)}`;
        parser = async (r) => {
          const j = await r.json();
          if (j.code === 401 || j.code === 400) return { ok: false, error: j.message || 'Clé invalide' };
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
          if (r.status === 403) return { ok: false, error: 'Clé révoquée ou bloquée (403)' };
          if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
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
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'Clé invalide' };
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
          const j = await r.json();
          if (j.success === true) return { ok: true };
          if (j.error) return { ok: false, error: j.error.info || j.error.type || 'Erreur API' };
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
