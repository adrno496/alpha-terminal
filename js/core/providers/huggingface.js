// Hugging Face Inference Router — https://huggingface.co/docs/inference-providers/
// One endpoint, multi-provider routing (Together, Fireworks, Cerebras, etc. — billed via HF)
import { OpenAICompatibleProvider } from './openai-compatible.js';

// Proxy CORS pour cet endpoint qui ne supporte pas les browser direct calls.
// Si window.ALPHA_CONFIG.LLM_PROXY_URL est défini, on route à travers.
function viaProxy(url) {
  const base = (typeof window !== 'undefined' && window.ALPHA_CONFIG?.LLM_PROXY_URL) || '/api/llm-proxy';
  return `${base}?url=${encodeURIComponent(url)}`;
}

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  constructor(apiKey, modelOverrides = {}) {
    super(apiKey, modelOverrides, {
      name: 'huggingface',
      displayName: 'Hugging Face',
      icon: '🤗',
      // HF a déprécié le route flat `/v1/chat/completions`. Désormais, l'OpenAI-compatible
      // router exige un sub-provider dans le path : /{provider}/v1/chat/completions.
      // `nebius` = sub-provider gratuit avec quota correct + bonne couverture modèles.
      // L'utilisateur doit l'avoir activé sur huggingface.co/settings/inference-providers.
      baseUrl: viaProxy('https://router.huggingface.co/nebius/v1/chat/completions'),
      defaultModels: {
        flagship: 'meta-llama/Llama-3.3-70B-Instruct',
        balanced: 'Qwen/Qwen2.5-72B-Instruct',
        fast: 'meta-llama/Llama-3.1-8B-Instruct'
      },
      validateModels: ['meta-llama/Llama-3.1-8B-Instruct']
    });
  }

  // Override : format check d'abord (rejette les fausses clés), puis whoami-v2 pour
  // valider le token sans consommer de quota. Si whoami passe ET le format est OK, on retourne OK.
  // L'inférence elle-même peut quand même 404 si le sub-provider n'est pas connecté côté HF
  // — d'où le bouton "tester maintenant" qui passe par super.validate() pour un VRAI POST chat.
  async validate() {
    if (!/^hf_[A-Za-z0-9]{30,}$/.test(this.apiKey)) {
      return { ok: false, error: '[Hugging Face] Format de token invalide. Format attendu : hf_…', status: 400 };
    }
    // 1. Tente d'abord un VRAI POST chat (super.validate) — c'est ça qui détecte si l'inference
    //    est réellement utilisable avec le model courant.
    try {
      const r = await super.validate();
      if (r.ok) return r;
      // 404 = model/sub-provider absent → suggère la cause
      if (r.status === 404) {
        return { ok: false, error: '[Hugging Face] Modèle non disponible via le router. Connecte un sub-provider (Nebius/Together/Fireworks) sur huggingface.co/settings/inference-providers, ou change le suffixe `:provider` du modèle.', status: 404 };
      }
      if (r.status === 401 || r.status === 403) {
        return { ok: false, error: '[Hugging Face] Token invalide ou sans permission inference. Recrée-le avec le scope « Inference » sur huggingface.co/settings/tokens.', status: r.status };
      }
      // Autre erreur → fallback whoami pour distinguer auth vs autre
    } catch {}
    // 2. Fallback whoami-v2 — au moins on confirme que le token existe
    try {
      const res = await fetch(viaProxy('https://huggingface.co/api/whoami-v2'), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
      });
      if (res.ok) {
        return { ok: false, error: '[Hugging Face] Token valide ✓ mais l\'inférence chat a échoué. Vérifie qu\'un sub-provider est connecté sur huggingface.co/settings/inference-providers.', status: 0 };
      }
      if (res.status === 401) return { ok: false, error: '[Hugging Face] Token invalide ou révoqué.', status: 401 };
      return { ok: false, error: `[Hugging Face] HTTP ${res.status}`, status: res.status };
    } catch {
      return { ok: false, error: 'BROWSER_INCOMPATIBLE:huggingface', status: 0 };
    }
  }
}
