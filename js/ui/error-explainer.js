// Helper centralisé : transforme un résultat de validation API
// `{ ok, error?, status?, note? }` en messages compréhensibles pour l'utilisateur,
// avec une explication + une action recommandée.
//
// Utilisation :
//   import { explainValidationResult } from '../ui/error-explainer.js';
//   const { label, explanation, action, severity } = explainValidationResult(result);

import { getLocale } from '../core/i18n.js';

/**
 * @param {{ok:boolean, error?:string, status?:number, note?:string}} result
 * @returns {{ label:string, explanation:string, action:string|null, severity:'success'|'warning'|'error' }}
 */
export function explainValidationResult(result) {
  const en = getLocale() === 'en';
  if (!result) {
    return {
      label: en ? '— Unknown' : '— Inconnu',
      explanation: en ? 'No result returned.' : 'Aucun résultat renvoyé.',
      action: null,
      severity: 'error'
    };
  }

  // SUCCÈS
  if (result.ok) {
    if (result.note && /rate.?limit/i.test(result.note)) {
      return {
        label: en ? '✓ Valid (rate-limited)' : '✓ Valide (limite atteinte)',
        explanation: en
          ? 'Key is valid. Provider is rate-limiting you right now (free tier quota), but the key works.'
          : 'La clé est valide. Le provider t\'a temporairement bridé (quota du tier gratuit), mais la clé fonctionne.',
        action: en
          ? 'Wait a few minutes or upgrade to a higher tier for more requests/min.'
          : 'Attends quelques minutes ou passe à un tier supérieur pour plus de requêtes/min.',
        severity: 'warning'
      };
    }
    if (result.note && /provider error/i.test(result.note)) {
      return {
        label: en ? '✓ Valid (provider error 5xx)' : '✓ Valide (provider en erreur)',
        explanation: en
          ? 'Provider returned a 5xx server error, but your key is most likely valid.'
          : 'Le provider a renvoyé une erreur serveur (5xx), mais ta clé est probablement valide.',
        action: en ? 'Retry in a few minutes.' : 'Réessaie dans quelques minutes.',
        severity: 'warning'
      };
    }
    return {
      label: en ? '✓ OK' : '✓ OK',
      explanation: en ? 'Key is valid and working.' : 'Clé valide et opérationnelle.',
      action: null,
      severity: 'success'
    };
  }

  // ÉCHECS — par code HTTP
  const status = result.status;
  const errMsg = String(result.error || '').slice(0, 200);

  // BROWSER_INCOMPATIBLE — provider ne fonctionne PAS depuis browser
  // (validation ET analyses échoueront toutes les deux à cause de CORS)
  if (/^BROWSER_INCOMPATIBLE/.test(errMsg)) {
    const provider = errMsg.split(':')[1] || 'this provider';
    const proxyAdvice = {
      github: en
        ? 'Use OpenRouter instead (covers OpenAI/Llama models via GitHub). Or self-host an AI Gateway proxy.'
        : 'Utilise OpenRouter à la place (couvre les modèles OpenAI/Llama de GitHub). Ou self-host un proxy AI Gateway.',
      nvidia: en
        ? 'NVIDIA NIM only allows server-to-server calls. Use OpenRouter (carries Llama 3.x, Nemotron) or a backend proxy.'
        : 'NVIDIA NIM n\'autorise que les calls server-to-server. Utilise OpenRouter (qui propose Llama 3.x, Nemotron) ou un proxy backend.',
      huggingface: en
        ? 'Use OpenRouter (carries the same Llama/Qwen/Mistral models). HF Inference router blocks browser CORS.'
        : 'Utilise OpenRouter (qui propose les mêmes modèles Llama/Qwen/Mistral). Le router HF bloque le CORS browser.',
      cloudflare: en
        ? 'Cloudflare Workers AI requires their AI Gateway proxy for browser access. Setup: dash.cloudflare.com → AI → AI Gateway → enable.'
        : 'Cloudflare Workers AI nécessite leur proxy AI Gateway pour l\'accès browser. Setup : dash.cloudflare.com → AI → AI Gateway → activer.',
      fred: en
        ? 'FRED API CORS is intermittent. Most calls work but validation may fail. The key likely works in actual usage.'
        : 'L\'API FRED a un CORS intermittent. La plupart des appels fonctionnent mais la validation échoue. La clé fonctionne sûrement à l\'usage réel.'
    };
    return {
      label: en ? '⛔ Not browser-compatible' : '⛔ Incompatible navigateur',
      explanation: en
        ? `${provider} blocks direct calls from browsers (CORS). Your analyses with this provider will also fail.`
        : `${provider} bloque les appels directs depuis un navigateur (CORS). Tes analyses avec ce provider échoueront aussi.`,
      action: proxyAdvice[provider] || (en
        ? 'Use OpenRouter as a proxy or skip this provider.'
        : 'Utilise OpenRouter comme proxy ou n\'utilise pas ce provider.'),
      severity: 'error'
    };
  }

  // CORS bloqué générique (réseau / DNS / autre — la clé peut être valide)
  if (/cors|failed to fetch|networkerror/i.test(errMsg)) {
    return {
      label: en ? '⚠ Network/CORS issue' : '⚠ Réseau/CORS',
      explanation: en
        ? 'Couldn\'t reach the provider for validation. Could be a temporary network issue, ad blocker, or browser extension blocking the request.'
        : 'Impossible de joindre le provider pour validation. Peut être un problème réseau temporaire, ad-blocker, ou extension navigateur qui bloque la requête.',
      action: en
        ? 'Disable ad blockers / extensions, then retry. Try running an actual analysis — if it works, the key is fine.'
        : 'Désactive ad-blockers/extensions et réessaie. Si une vraie analyse fonctionne, la clé est bonne.',
      severity: 'warning'
    };
  }

  // 401 = Unauthorized → clé invalide ou révoquée
  if (status === 401) {
    return {
      label: en ? '✗ 401 — Invalid key' : '✗ 401 — Clé invalide',
      explanation: en
        ? 'The provider rejects this key. Either it\'s a typo, the key has been revoked, or it never existed.'
        : 'Le provider rejette cette clé. Soit faute de frappe, soit clé révoquée, soit elle n\'a jamais existé.',
      action: en
        ? 'Re-copy the key from the provider dashboard. Watch for trailing spaces or missing characters at the start (e.g. "sk-ant-...", "github_pat_...").'
        : 'Re-copie la clé depuis le dashboard du provider. Attention aux espaces en fin et aux caractères manquants au début (ex: "sk-ant-...", "github_pat_...").',
      severity: 'error'
    };
  }

  // 403 = Forbidden → clé valide mais permission insuffisante
  if (status === 403) {
    return {
      label: en ? '⚠ 403 — Insufficient access' : '⚠ 403 — Accès insuffisant',
      explanation: en
        ? 'Your key is valid but doesn\'t have permission for this resource. Usually means missing scope (GitHub PAT) or insufficient tier (Anthropic, NVIDIA).'
        : 'Ta clé est valide mais n\'a pas les permissions requises. Souvent : scope manquant (GitHub PAT) ou tier trop bas (Anthropic, NVIDIA).',
      action: en
        ? 'Check the provider dashboard: enable required scopes (e.g. "models:read" for GitHub) or upgrade your tier.'
        : 'Vérifie sur le dashboard du provider : active les scopes nécessaires (ex: "models:read" pour GitHub) ou monte de tier.',
      severity: 'error'
    };
  }

  // 404 = endpoint not found (rare)
  if (status === 404) {
    return {
      label: en ? '⚠ 404 — Endpoint not found' : '⚠ 404 — Endpoint introuvable',
      explanation: en
        ? 'The provider\'s API endpoint moved or was deprecated.'
        : 'L\'endpoint du provider a bougé ou été déprécié.',
      action: en ? 'Wait for an Alpha update — we\'ll fix it.' : 'Attends une mise à jour d\'Alpha — on corrigera.',
      severity: 'warning'
    };
  }

  // 429 = rate limit (devrait être traité comme OK, mais au cas où)
  if (status === 429) {
    return {
      label: en ? '⚠ 429 — Rate limited' : '⚠ 429 — Limite atteinte',
      explanation: en
        ? 'You\'re sending too many requests. Key is valid.'
        : 'Tu envoies trop de requêtes. La clé est valide.',
      action: en ? 'Wait a few minutes.' : 'Attends quelques minutes.',
      severity: 'warning'
    };
  }

  // 5xx = provider down (devrait être OK aussi)
  if (status >= 500 && status < 600) {
    return {
      label: en ? `⚠ ${status} — Provider error` : `⚠ ${status} — Erreur provider`,
      explanation: en
        ? 'The provider is down or having issues. Not your key\'s fault.'
        : 'Le provider est en panne. Pas ta faute.',
      action: en ? 'Retry later.' : 'Réessaie plus tard.',
      severity: 'warning'
    };
  }

  // Erreurs spécifiques par texte
  if (/scope.*models.?read/i.test(errMsg) || /models:read/i.test(errMsg)) {
    return {
      label: en ? '⚠ Missing scope «models:read»' : '⚠ Scope « models:read » manquant',
      explanation: en
        ? 'Your GitHub PAT exists but lacks the "Models" scope.'
        : 'Ton PAT GitHub existe mais n\'a pas le scope « Models ».',
      action: en
        ? 'Go to github.com → Settings → Developer settings → Personal access tokens → recreate with «Models» permission checked.'
        : 'Va sur github.com → Settings → Developer settings → Personal access tokens → recrée avec la permission « Models » cochée.',
      severity: 'error'
    };
  }
  if (/account.?id|ACCOUNT_ID/i.test(errMsg)) {
    return {
      label: en ? '⚠ Missing Account ID' : '⚠ Account ID manquant',
      explanation: en
        ? 'Cloudflare Workers AI needs your Account ID prefixed to the token.'
        : 'Cloudflare Workers AI a besoin de ton Account ID préfixé au token.',
      action: en
        ? 'Find Account ID at dash.cloudflare.com (right sidebar). Format: ACCOUNT_ID:cfut_yourtoken'
        : 'Trouve ton Account ID sur dash.cloudflare.com (sidebar droite). Format : ACCOUNT_ID:cfut_tonToken',
      severity: 'error'
    };
  }
  if (/quota|usage.?limit|exceeded|réessaie demain/i.test(errMsg)) {
    return {
      label: en ? '⚠ Quota exceeded' : '⚠ Quota dépassé',
      explanation: en
        ? 'You\'ve hit the provider\'s daily/monthly quota for the free tier.'
        : 'Tu as atteint le quota journalier/mensuel du free tier.',
      action: en
        ? 'Wait until tomorrow or upgrade to a paid tier.'
        : 'Attends demain ou passe à un tier payant.',
      severity: 'warning'
    };
  }
  if (/expired/i.test(errMsg)) {
    return {
      label: en ? '✗ Key expired' : '✗ Clé expirée',
      explanation: en ? 'This key has reached its expiration date.' : 'Cette clé a atteint sa date d\'expiration.',
      action: en ? 'Generate a new key on the provider dashboard.' : 'Génère une nouvelle clé sur le dashboard du provider.',
      severity: 'error'
    };
  }
  if (/format/i.test(errMsg) && /attendu|expected/i.test(errMsg)) {
    return {
      label: en ? '⚠ Wrong format' : '⚠ Mauvais format',
      explanation: errMsg,
      action: en ? 'Check the provider documentation for the expected key format.' : 'Vérifie la doc du provider pour le format attendu.',
      severity: 'error'
    };
  }

  // Default fallback : on garde le message brut mais on l'encadre
  return {
    label: status ? `✗ HTTP ${status}` : (en ? '✗ Failed' : '✗ Échec'),
    explanation: errMsg || (en ? 'Unknown error.' : 'Erreur inconnue.'),
    action: en
      ? 'Re-copy the key from the provider dashboard. If still failing, the provider may be temporarily down.'
      : 'Re-copie la clé depuis le dashboard du provider. Si ça persiste, le provider est peut-être en panne.',
    severity: 'error'
  };
}

/**
 * Génère un HTML compact (label coloré + tooltip avec explication + action)
 * pour affichage dans les pills/grids.
 */
export function explainAsPillHTML(result) {
  const e = explainValidationResult(result);
  const color = e.severity === 'success' ? 'var(--accent-green)'
              : e.severity === 'warning' ? 'var(--accent-amber)'
              : 'var(--accent-red)';
  const tooltip = (e.explanation + (e.action ? '\n\n💡 ' + e.action : ''))
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return `<span style="color:${color};" title="${tooltip}">${e.label}</span>`;
}

/**
 * Génère un HTML "détaillé" pour afficher sous le pill : explication + action.
 * Sévérité : warning = orange, error = rouge, success = pas affiché.
 */
export function explainAsDetailHTML(result) {
  const e = explainValidationResult(result);
  if (e.severity === 'success') return '';
  const bg = e.severity === 'warning' ? 'rgba(255,170,0,0.08)' : 'rgba(255,80,80,0.08)';
  const border = e.severity === 'warning' ? '#ffaa00' : '#ff5555';
  const escapeHTML = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
    <div style="background:${bg};border-left:3px solid ${border};border-radius:4px;padding:8px 10px;margin-top:6px;font-size:11.5px;line-height:1.5;">
      <div style="color:var(--text-primary);">${escapeHTML(e.explanation)}</div>
      ${e.action ? `<div style="color:var(--text-secondary);margin-top:4px;"><strong>💡 ${escapeHTML(e.action)}</strong></div>` : ''}
    </div>
  `;
}
