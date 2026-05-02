// Catalogue de templates d'alertes — l'utilisateur active ce qu'il veut, ajuste les seuils
// avant création, et chaque alerte créée garde un `templateId` pour traçabilité.
// IMPORTANT : ces seuils sont des SUGGESTIONS de zones de marché classiques, pas des
// recommandations financières ni un portefeuille hardcodé. L'utilisateur doit les ajuster.

export const ALERT_TEMPLATES = [
  // === COMMODITIES ===
  {
    id: 'gold_profit_take',
    category: 'commodity',
    label: 'Or — zone de prise de profit',
    description: 'Alerte quand l\'or dépasse un seuil élevé (ex: nouveaux ATH).',
    defaults: { ticker: 'GLD', name: 'SPDR Gold Shares', direction: 'above', targetPrice: 250, currency: 'USD', kind: 'exit' },
    suggestedAction: 'Envisager de réduire l\'exposition or'
  },
  {
    id: 'gold_accumulation',
    category: 'commodity',
    label: 'Or — zone d\'accumulation',
    description: 'Alerte quand l\'or revient sur un support technique.',
    defaults: { ticker: 'GLD', name: 'SPDR Gold Shares', direction: 'below', targetPrice: 175, currency: 'USD', kind: 'entry' },
    suggestedAction: 'Envisager d\'accumuler une position or'
  },
  {
    id: 'silver_breakout',
    category: 'commodity',
    label: 'Argent — breakout',
    description: 'Argent (SLV) franchit une résistance.',
    defaults: { ticker: 'SLV', name: 'iShares Silver Trust', direction: 'above', targetPrice: 30, currency: 'USD', kind: 'entry' },
    suggestedAction: 'Surveiller momentum métaux précieux'
  },
  {
    id: 'oil_supply_shock',
    category: 'commodity',
    label: 'Pétrole — risque supply shock',
    description: 'WTI au-dessus d\'un seuil de tension géopolitique.',
    defaults: { ticker: 'USO', name: 'United States Oil Fund', direction: 'above', targetPrice: 100, currency: 'USD', kind: 'exit' },
    suggestedAction: 'Hedge inflation possible (or, énergie)'
  },

  // === CRYPTO ===
  {
    id: 'btc_profit_take',
    category: 'crypto',
    label: 'Bitcoin — prise de profit',
    description: 'BTC sur niveau psychologique élevé.',
    defaults: { ticker: 'BTC', name: 'Bitcoin', direction: 'above', targetPrice: 130000, currency: 'USD', kind: 'exit' },
    suggestedAction: 'Envisager de prendre 20-30% de profit'
  },
  {
    id: 'btc_accumulation',
    category: 'crypto',
    label: 'Bitcoin — zone d\'accumulation',
    description: 'BTC sur support important.',
    defaults: { ticker: 'BTC', name: 'Bitcoin', direction: 'below', targetPrice: 60000, currency: 'USD', kind: 'entry' },
    suggestedAction: 'Envisager d\'accumuler progressivement (DCA)'
  },
  {
    id: 'eth_accumulation',
    category: 'crypto',
    label: 'Ethereum — zone d\'accumulation',
    description: 'ETH sur support technique.',
    defaults: { ticker: 'ETH', name: 'Ethereum', direction: 'below', targetPrice: 2000, currency: 'USD', kind: 'entry' },
    suggestedAction: 'Envisager d\'accumuler ETH'
  },

  // === INDICES / VOLATILITÉ ===
  {
    id: 'vix_spike',
    category: 'index',
    label: 'VIX (ETF VIXY) — pic de volatilité',
    description: 'VIXY (ETF qui suit le VIX) au-dessus d\'un seuil = stress sur actions. NB : on utilise l\'ETF car le ticker brut "VIX" n\'est pas tradable côté providers retail.',
    defaults: { ticker: 'VIXY', name: 'ProShares VIX Short-Term Futures ETF', direction: 'above', targetPrice: 50, currency: 'USD', kind: 'exit' },
    suggestedAction: 'Réduire risque actions, envisager hedge'
  },
  {
    id: 'vix_calm',
    category: 'index',
    label: 'VIX (ETF VIXY) — calme exceptionnel',
    description: 'VIXY au plancher = complaisance, attention aux retournements.',
    defaults: { ticker: 'VIXY', name: 'ProShares VIX Short-Term Futures ETF', direction: 'below', targetPrice: 25, currency: 'USD', kind: 'entry' },
    suggestedAction: 'Bonne fenêtre pour rebalancer / prendre du risque mesuré'
  },
  {
    id: 'sp500_correction',
    category: 'index',
    label: 'S&P 500 — correction',
    description: 'SPY sur niveau de support après pullback.',
    defaults: { ticker: 'SPY', name: 'SPDR S&P 500', direction: 'below', targetPrice: 500, currency: 'USD', kind: 'entry' },
    suggestedAction: 'Envisager d\'augmenter exposition actions'
  },

  // === MACRO (basé sur séries FRED via le Macro Dashboard) ===
  {
    id: 'us10y_high',
    category: 'macro',
    label: 'US 10Y (TLT inverse) — taux longs',
    description: 'TLT (ETF obligations 20+ ans) chute quand les taux longs montent. Seuil bas = taux longs élevés. Note : pour suivre le rendement 10Y directement, utiliser le Risk Dashboard.',
    defaults: { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', direction: 'below', targetPrice: 80, currency: 'USD', kind: 'exit' },
    suggestedAction: 'Réduire duration / éviter actifs longs'
  }
];

export function getTemplateById(id) {
  return ALERT_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(cat) {
  return ALERT_TEMPLATES.filter(t => t.category === cat);
}

export const TEMPLATE_CATEGORIES = [
  { id: 'commodity', label: '🥇 Matières premières' },
  { id: 'crypto', label: '🪙 Crypto' },
  { id: 'index', label: '📊 Indices / Volatilité' },
  { id: 'macro', label: '🏛️ Macro' }
];
