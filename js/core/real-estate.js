// Calculs immobiliers — multi-prêts par bien + types de prêts FR/EU/US/UK
// Utilisé par le module Patrimoine (wealth.js) quand category === 'real_estate'.

// Catalog des types de prêts supportés.
// Chaque type pointe vers une stratégie de calcul (cf. computeLoanMetrics ci-dessous).
export const LOAN_TYPES = {
  // ====== AMORTIZATION CLASSIQUE ======
  amortizing_fixed: {
    label_fr: 'Amortissable taux fixe',
    label_en: 'Fixed-rate amortizing',
    region: 'global',
    description_fr: 'Prêt classique : mensualité constante, capital et intérêts. Standard FR/EU/US 30y/15y fixed, UK repayment.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  amortizing_variable: {
    label_fr: 'Amortissable taux variable',
    label_en: 'Variable-rate amortizing',
    region: 'global',
    description_fr: 'Taux révisable périodiquement. On affiche au taux courant.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate', 'rateCap']
  },
  arm: {
    label_fr: 'ARM (US adjustable rate)',
    label_en: 'ARM (Adjustable Rate Mortgage)',
    region: 'us',
    description_fr: 'US 5/1, 7/1, 10/1 ARM : taux fixe initial puis variable.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate', 'fixedPeriodMonths']
  },
  // ====== INTEREST-ONLY / IN FINE ======
  interest_only: {
    label_fr: 'In fine / Interest-only',
    label_en: 'Interest-only / Bullet',
    region: 'global',
    description_fr: 'On paie seulement les intérêts pendant la durée. Le capital est dû à l\'échéance. Typique pour locatif, investisseurs.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  balloon: {
    label_fr: 'Balloon (paiement final)',
    label_en: 'Balloon mortgage',
    region: 'us',
    description_fr: 'Mensualités calculées sur 30 ans, mais capital restant dû en lump sum à l\'échéance (5-7 ans).',
    fields: ['amount', 'rate', 'amortizationMonths', 'durationMonths', 'startDate']
  },
  // ====== TAUX ZÉRO / SUBVENTIONNÉ ======
  ptz_fr: {
    label_fr: 'PTZ (Prêt à Taux Zéro)',
    label_en: 'Zero-interest loan (FR)',
    region: 'fr',
    description_fr: 'Prêt aidé FR à 0% pour première acquisition. Souvent avec différé.',
    fields: ['amount', 'durationMonths', 'startDate', 'deferralMonths']
  },
  pas_fr: {
    label_fr: 'PAS (Prêt Accession Sociale)',
    label_en: 'Social access loan (FR)',
    region: 'fr',
    description_fr: 'Prêt à taux plafonné pour ménages modestes FR.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  pel_fr: {
    label_fr: 'PEL (Plan Épargne Logement)',
    label_en: 'Home savings plan (FR)',
    region: 'fr',
    description_fr: 'Prêt PEL adossé à l\'épargne, taux contractuel garanti.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  action_logement_fr: {
    label_fr: 'Prêt Action Logement (1%)',
    label_en: 'Employer housing loan (FR)',
    region: 'fr',
    description_fr: 'Prêt employeur à taux préférentiel (~1%).',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  // ====== UK SPECIFIC ======
  uk_tracker: {
    label_fr: 'UK Tracker (BoE + spread)',
    label_en: 'UK Tracker mortgage',
    region: 'uk',
    description_fr: 'Tracker variable indexé sur Bank of England base rate + spread.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  uk_offset: {
    label_fr: 'UK Offset',
    label_en: 'UK Offset mortgage',
    region: 'uk',
    description_fr: 'Mortgage avec compte épargne lié réduisant les intérêts. Saisi comme amortissable simplifié.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate', 'offsetSavings']
  },
  // ====== PRÊT MIXTE / RELAIS ======
  mixed_step: {
    label_fr: 'Prêt à paliers',
    label_en: 'Step-rate loan',
    region: 'global',
    description_fr: 'Plusieurs périodes de taux différents. Saisis le taux moyen pour une approximation.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  bridge: {
    label_fr: 'Prêt relais',
    label_en: 'Bridge loan',
    region: 'global',
    description_fr: 'Prêt court terme (12-24 mois) pour acheter avant de vendre. Souvent in fine.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  },
  // ====== AUTRE ======
  other: {
    label_fr: 'Autre',
    label_en: 'Other',
    region: 'global',
    description_fr: 'Type non listé. Calcul amortissable par défaut.',
    fields: ['amount', 'rate', 'durationMonths', 'startDate']
  }
};

// Liste UI groupée par région pour le <select>
export function loanTypesGrouped() {
  const groups = { global: [], fr: [], eu: [], us: [], uk: [] };
  for (const [id, def] of Object.entries(LOAN_TYPES)) {
    (groups[def.region] || groups.global).push({ id, ...def });
  }
  return groups;
}

// Mensualité d'un prêt amortissable classique
export function monthlyPayment(principal, annualRate, months) {
  if (!principal || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return principal * r / (1 - Math.pow(1 + r, -months));
}

// Capital restant dû après N mois (amortissable)
export function remainingPrincipal(principal, annualRate, months, monthsElapsed) {
  if (!principal || months <= 0) return 0;
  if (monthsElapsed >= months) return 0;
  if (monthsElapsed <= 0) return principal;
  if (annualRate === 0) return principal * (1 - monthsElapsed / months);
  const r = annualRate / 12;
  const M = monthlyPayment(principal, annualRate, months);
  const factor = Math.pow(1 + r, monthsElapsed);
  return principal * factor - M * (factor - 1) / r;
}

export function interestPaidToDate(principal, annualRate, months, monthsElapsed) {
  const M = monthlyPayment(principal, annualRate, months);
  const totalPaid = M * Math.min(monthsElapsed, months);
  const principalRepaid = principal - remainingPrincipal(principal, annualRate, months, monthsElapsed);
  return totalPaid - principalRepaid;
}

export function totalInterest(principal, annualRate, months) {
  const M = monthlyPayment(principal, annualRate, months);
  return M * months - principal;
}

export function monthsElapsedSince(startDateIso, refDate = new Date()) {
  if (!startDateIso) return 0;
  const start = new Date(startDateIso);
  if (isNaN(start.getTime())) return 0;
  const ref = refDate instanceof Date ? refDate : new Date(refDate);
  const yearDiff = ref.getFullYear() - start.getFullYear();
  const monthDiff = ref.getMonth() - start.getMonth();
  const dayAdj = ref.getDate() >= start.getDate() ? 0 : -1;
  return Math.max(0, yearDiff * 12 + monthDiff + dayAdj);
}

// Calcul pour UN prêt selon son type. Retourne mensualité courante, capital restant, intérêts payés.
export function computeLoanMetrics(loan) {
  const principal = Number(loan.amount) || 0;
  const annualRate = Number(loan.rate) || 0;
  const totalMonths = Number(loan.durationMonths) || 0;
  const elapsed = monthsElapsedSince(loan.startDate);
  const type = loan.type || 'amortizing_fixed';

  let monthly = 0, remaining = 0, interestPaid = 0, totalInt = 0, principalRepaid = 0;

  switch (type) {
    case 'interest_only':
    case 'bridge':
      // On paie seulement les intérêts. Capital dû en totalité à l'échéance.
      monthly = principal * annualRate / 12;
      remaining = elapsed >= totalMonths ? 0 : principal;
      interestPaid = monthly * Math.min(elapsed, totalMonths);
      totalInt = monthly * totalMonths;
      principalRepaid = principal - remaining;
      break;

    case 'ptz_fr': {
      // 0% intérêt + différé optionnel. Mensualité = principal / (months actifs).
      const deferral = Number(loan.deferralMonths) || 0;
      const activeMonths = Math.max(1, totalMonths - deferral);
      monthly = elapsed < deferral ? 0 : principal / activeMonths;
      const monthsActif = Math.max(0, elapsed - deferral);
      remaining = elapsed >= totalMonths ? 0 : Math.max(0, principal - (principal / activeMonths) * monthsActif);
      interestPaid = 0;
      totalInt = 0;
      principalRepaid = principal - remaining;
      break;
    }

    case 'balloon': {
      // Mensualités calculées sur amortizationMonths (souvent 360), capital restant dû à durationMonths.
      const amortMonths = Number(loan.amortizationMonths) || 360;
      monthly = monthlyPayment(principal, annualRate, amortMonths);
      remaining = elapsed >= totalMonths
        ? 0
        : remainingPrincipal(principal, annualRate, amortMonths, elapsed);
      interestPaid = interestPaidToDate(principal, annualRate, amortMonths, Math.min(elapsed, totalMonths));
      // Total intérêts = somme intérêts pendant durationMonths + ballons restant
      totalInt = monthly * totalMonths - (principal - remainingPrincipal(principal, annualRate, amortMonths, totalMonths));
      principalRepaid = principal - remaining;
      break;
    }

    case 'arm': {
      // Pendant fixedPeriodMonths : taux fixe initial. Au-delà : taux variable (on suppose taux courant).
      // Pour le calcul, on traite comme amortissable au taux courant — approximation acceptable.
      monthly = monthlyPayment(principal, annualRate, totalMonths);
      remaining = remainingPrincipal(principal, annualRate, totalMonths, elapsed);
      interestPaid = interestPaidToDate(principal, annualRate, totalMonths, elapsed);
      totalInt = totalInterest(principal, annualRate, totalMonths);
      principalRepaid = principal - remaining;
      break;
    }

    case 'amortizing_fixed':
    case 'amortizing_variable':
    case 'pas_fr':
    case 'pel_fr':
    case 'action_logement_fr':
    case 'uk_tracker':
    case 'mixed_step':
    case 'other':
    default:
      monthly = monthlyPayment(principal, annualRate, totalMonths);
      remaining = remainingPrincipal(principal, annualRate, totalMonths, elapsed);
      interestPaid = interestPaidToDate(principal, annualRate, totalMonths, elapsed);
      totalInt = totalInterest(principal, annualRate, totalMonths);
      principalRepaid = principal - remaining;
      break;

    case 'uk_offset': {
      // UK offset : intérêts calculés sur (principal - offsetSavings). Approximation simple.
      const offset = Number(loan.offsetSavings) || 0;
      const effectivePrincipal = Math.max(0, principal - offset);
      monthly = monthlyPayment(effectivePrincipal, annualRate, totalMonths);
      remaining = remainingPrincipal(effectivePrincipal, annualRate, totalMonths, elapsed);
      interestPaid = interestPaidToDate(effectivePrincipal, annualRate, totalMonths, elapsed);
      totalInt = totalInterest(effectivePrincipal, annualRate, totalMonths);
      principalRepaid = effectivePrincipal - remaining;
      break;
    }
  }

  return {
    type,
    monthly: Math.max(0, monthly),
    monthsElapsed: elapsed,
    monthsRemaining: Math.max(0, totalMonths - elapsed),
    remaining: Math.max(0, remaining),
    principalRepaid: Math.max(0, principalRepaid),
    interestPaid: Math.max(0, interestPaid),
    totalInterest: Math.max(0, totalInt),
    progressPct: totalMonths > 0 ? (Math.min(elapsed, totalMonths) / totalMonths) * 100 : 0
  };
}

// Migration : si holding a les anciens champs flat (loanAmount, loanRate, etc.) mais pas de loans[],
// on construit un array loans[] équivalent. Idempotent.
export function normalizeLoans(holding) {
  if (Array.isArray(holding.loans) && holding.loans.length > 0) {
    return holding.loans.map(l => ({ ...l, type: l.type || 'amortizing_fixed' }));
  }
  if (holding.loanAmount > 0) {
    return [{
      id: 'legacy-' + (holding.id || ''),
      type: 'amortizing_fixed',
      label: 'Prêt principal',
      amount: holding.loanAmount,
      rate: holding.loanRate,
      durationMonths: holding.loanDuration,
      startDate: holding.loanStartDate
    }];
  }
  return [];
}

// Calcul global pour un holding immobilier (multi-prêts agrégés)
export function computeRealEstateMetrics(holding) {
  const loans = normalizeLoans(holding);
  const loanMetrics = loans.map(l => ({ loan: l, metrics: computeLoanMetrics(l) }));

  let totalMonthly = 0, totalRemaining = 0, totalInterestPaid = 0, totalInterestCost = 0, totalPrincipalRepaid = 0;
  for (const { metrics } of loanMetrics) {
    totalMonthly += metrics.monthly;
    totalRemaining += metrics.remaining;
    totalInterestPaid += metrics.interestPaid;
    totalInterestCost += metrics.totalInterest;
    totalPrincipalRepaid += metrics.principalRepaid;
  }

  const currentValue = Number(holding.value) || Number(holding.purchasePrice) || 0;
  const purchasePrice = Number(holding.purchasePrice) || 0;
  const equity = currentValue - totalRemaining;
  const ltv = currentValue > 0 ? (totalRemaining / currentValue) * 100 : 0;
  const capitalGain = currentValue - purchasePrice;
  const capitalGainPct = purchasePrice > 0 ? (capitalGain / purchasePrice) * 100 : 0;

  // Locatif
  const monthlyRent = Number(holding.monthlyRent) || 0;
  const monthlyCharges = Number(holding.monthlyCharges) || 0;
  const propertyTaxYear = Number(holding.propertyTax) || 0;
  const monthlyOutflow = totalMonthly + monthlyCharges + propertyTaxYear / 12;
  const monthlyCashflow = monthlyRent - monthlyOutflow;
  const annualCashflow = monthlyCashflow * 12;
  const annualRentGross = monthlyRent * 12;
  const grossYield = purchasePrice > 0 ? (annualRentGross / purchasePrice) * 100 : 0;
  const netRevenue = annualRentGross - monthlyCharges * 12 - propertyTaxYear;
  const netYield = purchasePrice > 0 ? (netRevenue / purchasePrice) * 100 : 0;

  // Highest progressPct across loans (pour info "le plus avancé")
  const maxProgress = Math.max(0, ...loanMetrics.map(lm => lm.metrics.progressPct));

  return {
    loans: loanMetrics, // [{ loan, metrics }, ...]
    monthlyPayment: totalMonthly,
    monthsElapsed: loanMetrics[0]?.metrics.monthsElapsed || 0,
    remaining: totalRemaining,
    principalRepaid: totalPrincipalRepaid,
    interestPaid: totalInterestPaid,
    totalInterest: totalInterestCost,
    progressPct: maxProgress,
    currentValue,
    equity,
    ltv,
    capitalGain,
    capitalGainPct,
    monthlyRent,
    monthlyCharges,
    propertyTaxYear,
    monthlyOutflow,
    monthlyCashflow,
    annualCashflow,
    grossYield,
    netYield,
    isRental: (holding.propertyType === 'locatif')
  };
}

export function fmtMonths(months) {
  const m = Math.round(months);
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return `${r}m`;
  if (r === 0) return `${y}a`;
  return `${y}a ${r}m`;
}
