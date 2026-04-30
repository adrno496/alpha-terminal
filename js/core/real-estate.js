// Calculs immobiliers : amortissement, capital restant dû, cash-flow, rentabilité.
// Utilisé par le module Patrimoine (wealth.js) quand category === 'real_estate'.

// Mensualité d'un prêt amortissable classique (formule mathématique standard FR)
//   principal € — montant emprunté
//   annualRate % — taux annuel (ex 0.025 pour 2.5%)
//   months — durée totale en mois
export function monthlyPayment(principal, annualRate, months) {
  if (!principal || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return principal * r / (1 - Math.pow(1 + r, -months));
}

// Capital restant dû après N mois écoulés
export function remainingPrincipal(principal, annualRate, months, monthsElapsed) {
  if (!principal || months <= 0) return 0;
  if (monthsElapsed >= months) return 0;
  if (monthsElapsed <= 0) return principal;
  if (annualRate === 0) return principal * (1 - monthsElapsed / months);
  const r = annualRate / 12;
  // Formule : K_n = K0 × (1+r)^n - M × ((1+r)^n - 1)/r
  const M = monthlyPayment(principal, annualRate, months);
  const factor = Math.pow(1 + r, monthsElapsed);
  return principal * factor - M * (factor - 1) / r;
}

// Total des intérêts payés sur les premiers monthsElapsed mois
export function interestPaidToDate(principal, annualRate, months, monthsElapsed) {
  const M = monthlyPayment(principal, annualRate, months);
  const totalPaid = M * Math.min(monthsElapsed, months);
  const principalRepaid = principal - remainingPrincipal(principal, annualRate, months, monthsElapsed);
  return totalPaid - principalRepaid;
}

// Total des intérêts payés sur la durée totale du prêt
export function totalInterest(principal, annualRate, months) {
  const M = monthlyPayment(principal, annualRate, months);
  return M * months - principal;
}

// Calcul des mois écoulés depuis loanStartDate (ISO yyyy-mm-dd)
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

// Calcul global pour un holding immobilier
//   holding doit contenir : value (valeur actuelle), purchasePrice, loanAmount, loanRate, loanDuration (mois),
//                            loanStartDate, monthlyRent, monthlyCharges, propertyTax (annuel), propertyType
export function computeRealEstateMetrics(holding) {
  const principal = Number(holding.loanAmount) || 0;
  const annualRate = Number(holding.loanRate) || 0;
  const totalMonths = Number(holding.loanDuration) || 0;
  const elapsed = monthsElapsedSince(holding.loanStartDate);

  const M = monthlyPayment(principal, annualRate, totalMonths);
  const remaining = remainingPrincipal(principal, annualRate, totalMonths, elapsed);
  const interestPaid = interestPaidToDate(principal, annualRate, totalMonths, elapsed);
  const totalInt = totalInterest(principal, annualRate, totalMonths);
  const monthsRemaining = Math.max(0, totalMonths - elapsed);
  const principalRepaid = principal - remaining;

  const currentValue = Number(holding.value) || Number(holding.purchasePrice) || 0;
  const purchasePrice = Number(holding.purchasePrice) || 0;
  const equity = currentValue - remaining; // valeur nette (équité)
  const ltv = currentValue > 0 ? (remaining / currentValue) * 100 : 0;
  const capitalGain = currentValue - purchasePrice;
  const capitalGainPct = purchasePrice > 0 ? (capitalGain / purchasePrice) * 100 : 0;

  // Locatif : cash-flow mensuel
  const monthlyRent = Number(holding.monthlyRent) || 0;
  const monthlyCharges = Number(holding.monthlyCharges) || 0;
  const propertyTaxYear = Number(holding.propertyTax) || 0;
  const monthlyOutflow = M + monthlyCharges + propertyTaxYear / 12;
  const monthlyCashflow = monthlyRent - monthlyOutflow;
  const annualCashflow = monthlyCashflow * 12;

  // Rentabilité (calculée si locatif et purchasePrice connu)
  const annualRentGross = monthlyRent * 12;
  const grossYield = purchasePrice > 0 ? (annualRentGross / purchasePrice) * 100 : 0;
  const netRevenue = annualRentGross - monthlyCharges * 12 - propertyTaxYear;
  const netYield = purchasePrice > 0 ? (netRevenue / purchasePrice) * 100 : 0;

  return {
    monthlyPayment: M,
    monthsElapsed: elapsed,
    monthsRemaining,
    remaining,
    principalRepaid,
    interestPaid,
    totalInterest: totalInt,
    progressPct: totalMonths > 0 ? (elapsed / totalMonths) * 100 : 0,
    currentValue,
    equity,
    ltv,
    capitalGain,
    capitalGainPct,
    // Locatif uniquement (0 sinon)
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

// Format mois → "Xa Ym"
export function fmtMonths(months) {
  const m = Math.round(months);
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return `${r}m`;
  if (r === 0) return `${y}a`;
  return `${y}a ${r}m`;
}
