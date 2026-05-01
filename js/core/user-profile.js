// User profile : stocke les réponses au questionnaire d'onboarding pour personnaliser
// les recommandations de modules. Stocké en localStorage.

const KEY = 'alpha-terminal:user-profile';
const COMPLETED_KEY = 'alpha-terminal:onboarding-completed';

// Schéma du profil :
// {
//   age: number,
//   country: 'fr'|'us'|'uk'|'de'|'other',
//   familyStatus: 'single'|'couple'|'family_kids'|'other',
//   // Situation financière précise (€) — utilisée par tous les modules pour
//   // contextualiser les analyses fiscales / budget / cashflow / FIRE.
//   salaryNet: number,            // salaire mensuel net
//   otherMonthlyIncome: number,   // autres revenus mensuels récurrents (loyers, dividendes…)
//   monthlyCharges: number,       // charges fixes mensuelles totales (loyer/prêt, énergie, assurances, abonnements)
//   variableSpending: number,     // dépenses variables estimées (courses, loisirs, transport)
//   totalWealth: number,          // patrimoine total estimé (laissé vide → calculé via Patrimoine)
//   tmiPct: 0|11|30|41|45,        // tranche marginale d'imposition FR
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

// Helper : injecte le contexte financier dans les prompts LLM. Appelé par les
// modules qui veulent personnaliser l'analyse (tax, fire, budget, audit, etc.).
export function buildFinanceContext() {
  const p = getUserProfile();
  if (!p) return '';
  const lines = [];
  if (p.salaryNet)            lines.push(`- Salaire net mensuel : ${p.salaryNet} €`);
  if (p.otherMonthlyIncome)   lines.push(`- Autres revenus mensuels : ${p.otherMonthlyIncome} €`);
  if (p.monthlyCharges)       lines.push(`- Charges fixes mensuelles : ${p.monthlyCharges} €`);
  if (p.variableSpending)     lines.push(`- Dépenses variables mensuelles : ${p.variableSpending} €`);
  if (p.totalWealth)          lines.push(`- Patrimoine total estimé : ${p.totalWealth} €`);
  if (p.tmiPct != null)       lines.push(`- TMI (tranche marginale FR) : ${p.tmiPct}%`);
  if (p.familyStatus)         lines.push(`- Situation familiale : ${p.familyStatus}`);
  if (p.country)              lines.push(`- Pays : ${p.country}`);
  if (p.age)                  lines.push(`- Âge : ${p.age} ans`);
  if (p.riskProfile)          lines.push(`- Profil de risque : ${p.riskProfile}`);
  if (p.horizon)              lines.push(`- Horizon d'investissement : ${p.horizon}`);
  if (Array.isArray(p.goals) && p.goals.length) lines.push(`- Objectifs : ${p.goals.join(', ')}`);
  if (!lines.length) return '';
  // Cashflow dérivé
  const inc = (Number(p.salaryNet) || 0) + (Number(p.otherMonthlyIncome) || 0);
  const out = (Number(p.monthlyCharges) || 0) + (Number(p.variableSpending) || 0);
  if (inc || out) {
    const cf = inc - out;
    const rate = inc > 0 ? Math.round((cf / inc) * 100) : 0;
    lines.push(`- Cashflow mensuel estimé : ${cf >= 0 ? '+' : ''}${cf} € · taux d'épargne : ${rate}%`);
  }
  return `[CONTEXTE UTILISATEUR — situation financière personnelle, à utiliser pour personnaliser l'analyse]\n${lines.join('\n')}\n\n`;
}

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
