// User profile : stocke les réponses au questionnaire d'onboarding pour personnaliser
// les recommandations de modules. Stocké en localStorage.

const KEY = 'alpha-terminal:user-profile';
const COMPLETED_KEY = 'alpha-terminal:onboarding-completed';

// Schéma du profil :
// {
//   age: number,
//   country: 'fr'|'us'|'uk'|'de'|'other',
//   familyStatus: 'single'|'couple'|'family_kids'|'other',
//   monthlyIncome: 'low'|'medium'|'high'|'very_high',  // <2k / 2-5k / 5-10k / >10k
//   wealthLevel: 'starting'|'building'|'established'|'high_net_worth',  // <50k / 50-200k / 200-500k / 500k+
//   tmiPct: 0|11|30|41|45,  // tranche marginale d'imposition FR
//   experience: 'beginner'|'intermediate'|'advanced',
//   riskProfile: 'conservative'|'balanced'|'dynamic'|'aggressive',
//   horizon: 'short'|'medium'|'long',  // <3y / 3-10y / >10y
//   goals: ['fire','retirement','house','education','travel','wealth_growth','passive_income','tax_optim'],
//   assetTypes: ['stocks','etf','crypto','real_estate','bonds','commodities','life_insurance','pea','per'],
//   analysisFocus: ['fundamental','technical','macro','tax','sentiment','quick_decisions'],
//   usageFrequency: 'occasional'|'weekly'|'daily',
//   needs: ['budget_tracking','tax_savings','diversification','passive_income','retirement_planning','wealth_growth','first_purchase'],
//   updatedAt: ISO
// }

export function getUserProfile() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}

export function saveUserProfile(profile) {
  const merged = { ...(getUserProfile() || {}), ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(merged));
  localStorage.setItem(COMPLETED_KEY, '1');
  window.dispatchEvent(new CustomEvent('app:user-profile-updated'));
  return merged;
}

export function clearUserProfile() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(COMPLETED_KEY);
  window.dispatchEvent(new CustomEvent('app:user-profile-updated'));
}

export function isOnboardingCompleted() {
  return localStorage.getItem(COMPLETED_KEY) === '1';
}

export function markOnboardingSkipped() {
  // L'utilisateur a passé le questionnaire (pas une vraie complétion)
  localStorage.setItem(COMPLETED_KEY, 'skipped');
}
