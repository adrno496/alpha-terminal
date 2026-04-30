// Smart Router : sélectionne le meilleur provider pour chaque module
// Convention :
//   - perplexity = optimal sur modules web search (sonar a web search natif intégré)
//   - openrouter = fallback universel (accès à tous les modèles via 1 clé)

export const MODULE_ROUTING = {
  'wealth': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini', 'grok', 'openrouter', 'perplexity'],
    fallbackProviders: [],
    recommendedTier: 'fast',
    reason: 'Local CRUD, pas d\'analyse LLM directe'
  },
  'knowledge-base': {
    needsCapabilities: [],
    optimalProviders: ['openai', 'claude', 'gemini'],
    fallbackProviders: ['grok', 'openrouter'],
    recommendedTier: 'fast',
    reason: 'RAG local — embeddings OpenAI préférés, LLM léger pour synthèse'
  },
  'quick-analysis': {
    needsCapabilities: ['supportsWebSearch'],
    optimalProviders: ['claude', 'gemini', 'grok', 'perplexity'],
    fallbackProviders: ['openai', 'openrouter'],
    recommendedTier: 'balanced',
    reason: 'Quick decision + web search for fresh data'
  },
  'decoder-10k': {
    needsCapabilities: ['supportsPDFNative'],
    optimalProviders: ['claude', 'gemini'],
    fallbackProviders: ['openai', 'grok', 'openrouter', 'perplexity'],
    recommendedTier: 'flagship',
    reason: 'PDF natif + raisonnement financier nuancé'
  },
  'macro-dashboard': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini', 'grok', 'perplexity'],
    fallbackProviders: ['openrouter'],
    recommendedTier: 'flagship'
  },
  'crypto-fundamental': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter', 'perplexity'],
    recommendedTier: 'balanced'
  },
  'earnings-call': {
    needsCapabilities: ['supportsLongContext'],
    optimalProviders: ['claude', 'gemini'],
    fallbackProviders: ['openai', 'grok', 'openrouter'],
    recommendedTier: 'flagship'
  },
  'portfolio-rebalancer': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter', 'perplexity'],
    recommendedTier: 'balanced'
  },
  'tax-optimizer-fr': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini'],
    fallbackProviders: ['grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Nuance fiscale française'
  },
  'tax-international': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini'],
    fallbackProviders: ['grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Multi-country tax law nuance'
  },
  'whitepaper-reader': {
    needsCapabilities: ['supportsPDFNative'],
    optimalProviders: ['claude', 'gemini'],
    fallbackProviders: ['openai', 'grok', 'openrouter', 'perplexity'],
    recommendedTier: 'balanced'
  },
  'sentiment-tracker': {
    needsCapabilities: ['supportsWebSearch'],
    optimalProviders: ['grok', 'perplexity', 'gemini', 'claude'],
    fallbackProviders: ['openai', 'openrouter'],
    recommendedTier: 'balanced',
    reason: 'Données X temps réel (Grok) ou web search natif (Perplexity)'
  },
  'newsletter-investor': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Style cloning'
  },
  'position-sizing': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini', 'grok', 'openrouter'],
    fallbackProviders: ['perplexity'],
    recommendedTier: 'fast',
    reason: 'Calcul Kelly simple — modèle low-cost suffit'
  },
  'research-agent': {
    needsCapabilities: ['supportsWebSearch'],
    optimalProviders: ['claude', 'gemini', 'grok', 'perplexity'],
    fallbackProviders: ['openai', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Multi-step orchestration + web search'
  },
  'dcf': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'balanced'
  },
  'pre-mortem': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Raisonnement nuancé / contradictoire'
  },
  'stock-screener': {
    needsCapabilities: ['supportsWebSearch'],
    optimalProviders: ['gemini', 'perplexity', 'claude', 'grok'],
    fallbackProviders: ['openai', 'openrouter'],
    recommendedTier: 'balanced'
  },
  'trade-journal': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'balanced'
  },
  'investment-memo': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'flagship'
  },
  'fire-calculator': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini'],
    fallbackProviders: ['grok', 'openrouter'],
    recommendedTier: 'balanced',
    reason: 'Calcul + nuance fiscale FR'
  },
  'stress-test': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'flagship'
  },
  'battle-mode': {
    needsCapabilities: ['supportsWebSearch'],
    optimalProviders: ['claude', 'gemini', 'grok', 'perplexity'],
    fallbackProviders: ['openai', 'openrouter'],
    recommendedTier: 'balanced'
  },
  'watchlist': {
    needsCapabilities: ['supportsWebSearch'],
    optimalProviders: ['perplexity', 'grok', 'gemini', 'claude'],
    fallbackProviders: ['openai', 'openrouter'],
    recommendedTier: 'balanced',
    reason: 'Web search live pour news matinales (Perplexity excellent)'
  },
  'portfolio-audit': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter', 'perplexity'],
    recommendedTier: 'flagship',
    reason: 'Audit profond Buffett-style — raisonnement nuancé + critique fondamentale'
  },
  'youtube-transcript': {
    needsCapabilities: ['supportsLongContext'],
    optimalProviders: ['claude', 'gemini'],
    fallbackProviders: ['openai', 'grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Transcript long + CEO Forensics — context long requis'
  },
  // V7 — Finances perso (LLM-augmented seulement)
  'fees-analysis': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Calcul fiscal nuancé + reco patrimoniale personnalisée'
  },
  'wealth-method': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai'],
    fallbackProviders: ['gemini', 'grok', 'openrouter'],
    recommendedTier: 'flagship',
    reason: 'Méthode patrimoniale FR — nuance fiscale + plan personnalisé'
  },
  'insights-engine': {
    needsCapabilities: [],
    optimalProviders: ['claude', 'openai', 'gemini'],
    fallbackProviders: ['grok', 'openrouter'],
    recommendedTier: 'fast',
    reason: 'Synthèse courte d\'insights — modèle léger suffit'
  }
  // budget, dividends-tracker, diversification-score, csv-import : pure local, pas de routing LLM
};

export class SmartRouter {
  constructor(providers) { this.providers = providers; }

  selectProvider(moduleId, context = {}) {
    const config = MODULE_ROUTING[moduleId];
    if (!config) throw new Error(`Module ${moduleId} non configuré dans le router`);

    // 1. Override manuel — provider + (optionally) modèle exact
    if (context.forceProvider && this.providers[context.forceProvider]) {
      const provider = this.providers[context.forceProvider];
      const tier = context.forceTier || config.recommendedTier;
      const model = context.forceModel || provider.getCapabilities().models[tier];
      return {
        provider, model, tier,
        isOptimal: config.optimalProviders.includes(context.forceProvider),
        reason: context.forceModel ? 'Modèle forcé manuellement' : 'Provider forcé manuellement'
      };
    }

    // 2. Optimal disponible
    for (const name of config.optimalProviders) {
      if (this.providers[name]) {
        const provider = this.providers[name];
        const tier = context.forceTier || config.recommendedTier;
        return {
          provider, model: provider.getCapabilities().models[tier], tier,
          isOptimal: true,
          reason: config.reason || `${provider.displayName} — recommandé`
        };
      }
    }
    // 3. Fallback configuré
    for (const name of config.fallbackProviders) {
      if (this.providers[name]) {
        const provider = this.providers[name];
        const tier = context.forceTier || config.recommendedTier;
        return {
          provider, model: provider.getCapabilities().models[tier], tier,
          isOptimal: false,
          reason: `Fallback (${provider.displayName})`
        };
      }
    }
    // 4. Last-resort fallback : n'importe quel provider configuré non-déjà-listé.
    // Permet aux nouveaux providers (Mistral, Cerebras, etc.) de servir n'importe
    // quel module sans devoir éditer chaque entrée du routing matrix.
    const considered = new Set([...config.optimalProviders, ...config.fallbackProviders]);
    for (const name of Object.keys(this.providers)) {
      if (considered.has(name)) continue;
      const provider = this.providers[name];
      const tier = context.forceTier || config.recommendedTier;
      return {
        provider, model: provider.getCapabilities().models[tier], tier,
        isOptimal: false,
        reason: `Fallback générique (${provider.displayName})`
      };
    }
    throw new Error(`Aucune clé API configurée pour ${moduleId}.`);
  }

  getAvailableProviderNames() { return Object.keys(this.providers); }

  getRoutingPreview() {
    const preview = {};
    for (const id of Object.keys(MODULE_ROUTING)) {
      try {
        const sel = this.selectProvider(id);
        preview[id] = {
          provider: sel.provider.name,
          providerDisplay: sel.provider.displayName,
          icon: sel.provider.icon,
          model: sel.model,
          tier: sel.tier,
          isOptimal: sel.isOptimal,
          reason: sel.reason
        };
      } catch (e) {
        preview[id] = { error: e.message };
      }
    }
    return preview;
  }
}
