// Module recommendations engine : prend un user profile, retourne un score 0-100 par module.
// Tri descendant → top N = recommandations.

const ALL_MODULES = [
  // Always-visible
  { id: 'quick-analysis',      tags: ['decision_fast', 'beginner_ok'] },
  { id: 'wealth',              tags: ['core_setup', 'beginner_ok'] },
  { id: 'watchlist',           tags: ['daily_tracking', 'active_trader'] },
  { id: 'knowledge-base',      tags: ['learning'] },

  // Fundamentals
  { id: 'research-agent',      tags: ['fundamental', 'advanced'] },
  { id: 'decoder-10k',         tags: ['fundamental', 'advanced', 'stocks'] },
  { id: 'dcf',                 tags: ['fundamental', 'advanced', 'stocks'] },
  { id: 'investment-memo',     tags: ['fundamental', 'discipline'] },
  { id: 'pre-mortem',          tags: ['fundamental', 'discipline', 'advanced'] },
  { id: 'stock-screener',      tags: ['fundamental', 'discovery'] },
  { id: 'portfolio-audit',     tags: ['fundamental', 'wealth_review', 'advanced'] },

  // Macro
  { id: 'macro-dashboard',     tags: ['macro', 'context'] },
  { id: 'stress-test',         tags: ['macro', 'risk'] },
  { id: 'portfolio-rebalancer',tags: ['discipline', 'wealth_review'] },
  { id: 'battle-mode',         tags: ['decision_fast', 'comparison'] },

  // Crypto
  { id: 'crypto-fundamental',  tags: ['crypto', 'fundamental'] },
  { id: 'whitepaper-reader',   tags: ['crypto', 'advanced'] },

  // Sentiment
  { id: 'sentiment-tracker',   tags: ['sentiment', 'active_trader'] },
  { id: 'earnings-call',       tags: ['sentiment', 'fundamental'] },
  { id: 'newsletter-investor', tags: ['discipline', 'creation'] },
  { id: 'youtube-transcript',  tags: ['sentiment', 'fundamental'] },

  // Tools
  { id: 'position-sizing',     tags: ['risk', 'active_trader'] },
  { id: 'trade-journal',       tags: ['discipline', 'active_trader'] },
  { id: 'fire-calculator',     tags: ['fire', 'planning'] },

  // Tax
  { id: 'tax-optimizer-fr',    tags: ['tax_fr', 'planning'] },
  { id: 'tax-international',   tags: ['tax_intl', 'planning'] },

  // V7-V9 — Finances perso
  { id: 'budget',                tags: ['budget', 'beginner_ok', 'core_setup'] },
  { id: 'fees-analysis',         tags: ['cost_optim', 'wealth_review'] },
  { id: 'dividends-tracker',     tags: ['passive_income', 'stocks'] },
  { id: 'diversification-score', tags: ['risk', 'wealth_review'] },
  { id: 'wealth-method',         tags: ['planning', 'tax_fr', 'beginner_ok'] },
  { id: 'csv-import',            tags: ['budget', 'data_entry'] },
  { id: 'insights-engine',       tags: ['daily_tracking', 'discipline'] },
  { id: 'price-alerts',          tags: ['active_trader', 'sentiment'] },
  { id: 'ifi-simulator',         tags: ['tax_fr', 'real_estate', 'wealth_review'] },
  { id: 'goals',                 tags: ['planning', 'beginner_ok', 'discipline'] },
  { id: 'live-watcher',          tags: ['active_trader', 'daily_tracking'] },
  { id: 'accounts-view',         tags: ['wealth_review'] },
  { id: 'projection',            tags: ['planning', 'fire'] }
];

// Calcule un score 0-100 pour chaque module selon le profil user.
// Le score est dérivé de la somme des bonus liés aux tags + adaptations selon expérience.
export function computeRecommendations(profile) {
  if (!profile) return [];

  const scores = {};
  for (const mod of ALL_MODULES) {
    scores[mod.id] = 0;
  }

  const goals = profile.goals || [];
  const assets = profile.assetTypes || [];
  const focus = profile.analysisFocus || [];
  const needs = profile.needs || [];
  const exp = profile.experience || 'intermediate';
  const country = profile.country || 'fr';
  const tmiPct = Number(profile.tmiPct) || 0;
  const wealth = profile.wealthLevel || 'building';
  const horizon = profile.horizon || 'medium';
  const usage = profile.usageFrequency || 'weekly';
  const risk = profile.riskProfile || 'balanced';
  const age = Number(profile.age) || 35;

  // ===== Bonus par tag selon les choix utilisateur =====

  const addPoints = (tagToBonus) => {
    for (const mod of ALL_MODULES) {
      for (const tag of (mod.tags || [])) {
        if (tagToBonus[tag]) scores[mod.id] += tagToBonus[tag];
      }
    }
  };

  // Goals → tags
  if (goals.includes('fire'))             addPoints({ fire: 30, planning: 20, passive_income: 15, wealth_review: 10 });
  if (goals.includes('retirement'))       addPoints({ planning: 25, fire: 15, passive_income: 10, tax_fr: 10 });
  if (goals.includes('house'))            addPoints({ real_estate: 25, planning: 15, budget: 15 });
  if (goals.includes('education'))        addPoints({ planning: 20, budget: 15 });
  if (goals.includes('travel'))           addPoints({ budget: 15, planning: 10 });
  if (goals.includes('wealth_growth'))    addPoints({ fundamental: 20, advanced: 10, wealth_review: 15, discovery: 15 });
  if (goals.includes('passive_income'))   addPoints({ passive_income: 30, stocks: 15, real_estate: 10 });
  if (goals.includes('tax_optim'))        addPoints({ tax_fr: 25, tax_intl: 20, cost_optim: 15, planning: 10 });

  // Asset types → tags
  if (assets.includes('stocks'))         addPoints({ stocks: 20, fundamental: 10 });
  if (assets.includes('etf'))            addPoints({ stocks: 15, cost_optim: 10 });
  if (assets.includes('crypto'))         addPoints({ crypto: 30, advanced: 5 });
  if (assets.includes('real_estate'))    addPoints({ real_estate: 30, tax_fr: 15 });
  if (assets.includes('bonds'))          addPoints({ macro: 10, risk: 10 });
  if (assets.includes('commodities'))    addPoints({ macro: 10 });
  if (assets.includes('life_insurance')) addPoints({ tax_fr: 15, cost_optim: 10, planning: 10 });
  if (assets.includes('pea'))            addPoints({ tax_fr: 15, stocks: 10 });
  if (assets.includes('per'))            addPoints({ tax_fr: 15, planning: 10, fire: 5 });

  // Analysis focus → tags
  if (focus.includes('fundamental'))      addPoints({ fundamental: 25, advanced: 5 });
  if (focus.includes('technical'))        addPoints({ active_trader: 20, daily_tracking: 15 });
  if (focus.includes('macro'))            addPoints({ macro: 25, context: 10 });
  if (focus.includes('tax'))              addPoints({ tax_fr: 25, tax_intl: 15, cost_optim: 10 });
  if (focus.includes('sentiment'))        addPoints({ sentiment: 25 });
  if (focus.includes('quick_decisions'))  addPoints({ decision_fast: 25, daily_tracking: 10 });

  // Needs → tags
  if (needs.includes('budget_tracking'))     addPoints({ budget: 30, data_entry: 15, discipline: 10 });
  if (needs.includes('tax_savings'))         addPoints({ tax_fr: 25, tax_intl: 20, cost_optim: 20, planning: 10 });
  if (needs.includes('diversification'))     addPoints({ wealth_review: 25, risk: 20, discovery: 10 });
  if (needs.includes('passive_income'))      addPoints({ passive_income: 30, stocks: 15 });
  if (needs.includes('retirement_planning')) addPoints({ planning: 25, fire: 15, tax_fr: 10 });
  if (needs.includes('wealth_growth'))       addPoints({ fundamental: 20, advanced: 10, discovery: 15 });
  if (needs.includes('first_purchase'))      addPoints({ real_estate: 25, planning: 15, budget: 15 });

  // Experience adjustments
  if (exp === 'beginner') {
    addPoints({ beginner_ok: 30, learning: 25, advanced: -25, decision_fast: 15 });
  } else if (exp === 'intermediate') {
    addPoints({ fundamental: 10, beginner_ok: 5 });
  } else if (exp === 'advanced') {
    addPoints({ advanced: 25, fundamental: 15, discovery: 10, decision_fast: -5 });
  }

  // Usage frequency
  if (usage === 'daily')      addPoints({ active_trader: 25, daily_tracking: 25, sentiment: 10 });
  if (usage === 'weekly')     addPoints({ wealth_review: 15, discipline: 10 });
  if (usage === 'occasional') addPoints({ planning: 15, decision_fast: 10, learning: 10 });

  // Country (for tax-specific)
  if (country !== 'fr') {
    for (const mod of ALL_MODULES) {
      if ((mod.tags || []).includes('tax_fr')) scores[mod.id] -= 30;
    }
  }
  if (country === 'fr' && tmiPct >= 30) {
    addPoints({ tax_fr: 15, cost_optim: 10 });
  }

  // Wealth level
  if (wealth === 'starting')          addPoints({ beginner_ok: 15, planning: 10, budget: 15 });
  if (wealth === 'building')          addPoints({ wealth_review: 15, planning: 10 });
  if (wealth === 'established')       addPoints({ wealth_review: 20, cost_optim: 15, advanced: 10 });
  if (wealth === 'high_net_worth')    addPoints({ tax_fr: 20, tax_intl: 15, advanced: 15, real_estate: 10, wealth_review: 20 });

  // Horizon
  if (horizon === 'short')   addPoints({ active_trader: 15, decision_fast: 15, sentiment: 10 });
  if (horizon === 'long')    addPoints({ fire: 20, planning: 20, passive_income: 10 });

  // Risk profile
  if (risk === 'conservative') addPoints({ risk: 20, planning: 10, advanced: -10 });
  if (risk === 'aggressive')   addPoints({ active_trader: 15, advanced: 10, sentiment: 10 });

  // Age adjustments
  if (age >= 50) addPoints({ planning: 15, fire: 10 });
  if (age < 30)  addPoints({ learning: 15, beginner_ok: 10 });

  // Toujours présent : core_setup à très haute pertinence
  for (const mod of ALL_MODULES) {
    if ((mod.tags || []).includes('core_setup')) scores[mod.id] += 40;
  }

  // Normalisation : on clamp [0, 100]
  const maxScore = Math.max(...Object.values(scores), 1);
  const normalized = {};
  for (const id of Object.keys(scores)) {
    normalized[id] = Math.max(0, Math.min(100, Math.round((scores[id] / maxScore) * 100)));
  }

  // Tri descendant
  const sorted = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
  return sorted.map(([id, score]) => ({ id, score }));
}

// Top N modules recommandés (id only) — typiquement 6 pour la home
export function topRecommendedIds(profile, n = 6) {
  const ranked = computeRecommendations(profile);
  return ranked.slice(0, n).map(r => r.id);
}

// Set des modules recommandés (pour badge sidebar) — top N basé sur score > seuil
export function recommendedSet(profile, n = 8, threshold = 50) {
  if (!profile) return new Set();
  const ranked = computeRecommendations(profile).filter(r => r.score >= threshold).slice(0, n);
  return new Set(ranked.map(r => r.id));
}
