// Prompts fiscalité par pays — chaque country a ses propres enveloppes/règles
// Construit dynamiquement selon le code pays choisi.

const COUNTRY_BLOCKS = {
  US: {
    label: 'United States',
    expert: 'CPA / EA tax advisor specialized in personal finance',
    envelopes: '401(k) Traditional & Roth, Traditional IRA, Roth IRA, SEP-IRA, HSA, FSA, 529 Plan, Brokerage account, Treasury Direct',
    rules: `
- Federal brackets 2026: 10/12/22/24/32/35/37%
- Long-term capital gains: 0% / 15% / 20% (selon income)
- Short-term gains: ordinary income tax
- Wash sale rule (30 days)
- Tax-loss harvesting
- Backdoor Roth (income limits)
- Mega backdoor Roth via 401(k) after-tax
- HSA triple tax advantage
- State tax (varies — CA / NY / TX / FL etc.)
- AMT considerations for high earners
- Net Investment Income Tax (3.8% above thresholds)
- QSBS exemption (Section 1202)
`,
    output_lang: 'English'
  },
  UK: {
    label: 'United Kingdom',
    expert: 'UK chartered tax advisor (CIOT)',
    envelopes: 'ISA (Stocks & Shares, Cash, LISA, JISA), SIPP, Workplace pension, Premium Bonds, GIA, EIS/SEIS/VCT',
    rules: `
- Income tax: 20% / 40% / 45% (above £125k)
- CGT: 10% / 20% (real estate 18% / 28%)
- ISA annual allowance £20k (totally tax-free)
- LISA £4k/an + 25% gov bonus, retirement / first home
- SIPP: tax relief at marginal rate, £60k annual allowance
- Personal Savings Allowance (£1k basic / £500 higher)
- Dividend allowance £500
- CGT annual exemption £3k
- EIS 30% income tax relief, CGT exempt after 3 years
- Inheritance tax 40% above £325k
- Non-dom regime (in transition)
- Scottish income tax (different bands)
`,
    output_lang: 'English'
  },
  BE: {
    label: 'Belgique',
    expert: 'fiscaliste belge spécialisé en gestion de patrimoine',
    envelopes: 'Épargne-pension (3ème pilier), Assurance-vie branche 21/23, Compte-titres taxe (TCT), Dépôt bancaire (précompte mobilier 30%), Branche 26',
    rules: `
- IPP brackets 2026 : 25% / 40% / 45% / 50% (au-dessus ~46k€)
- Précompte mobilier 30% sur dividendes/intérêts (sauf exemptions)
- Exemption intérêts livret (~1020€/personne/an)
- Plus-values mobilières : 0% si gestion normale (sauf taxe boursière 0.12-1.32%)
- Taxe sur Comptes-Titres (TCT) 0.15% au-dessus 1M€
- Épargne-pension : réduction 25% ou 30% jusqu'à ~1020€/an
- Branche 21 : intérêts garantis, fiscalité après 8 ans
- Branche 23 : fonds, taxe 30% à la sortie sur intérêts (pas plus-values)
- Pension complémentaire 2ème pilier
- Donation mobilière 3% (région) ou directe en ligne 3-7%
- Région : Wallonie / Bruxelles / Flandre (différences sur immo)
`,
    output_lang: 'français'
  },
  CH: {
    label: 'Suisse',
    expert: 'fiscaliste suisse spécialisé en patrimoine et planification retraite',
    envelopes: '3ème pilier A (lié), 3ème pilier B (libre), 2ème pilier (LPP), Dépôt titres, Compte épargne, Immobilier',
    rules: `
- Impôt cantonal + communal + fédéral (différences MASSIVES par canton: ZG / ZH / GE / VD / VS...)
- Taux marginal effectif typiquement 20-40% selon canton et revenu
- Pilier 3a 2026 : ~7056 CHF/an (salarié) ou 20% revenu (indépendant max ~35280 CHF)
- Plus-values mobilières privées : EXONÉRÉES (si gestion non commerciale)
- Dividendes : taxés au revenu ordinaire (mais retenue 35% remboursable)
- Impôt sur la fortune (cantonal, ~0.1-1%)
- Rachats LPP déductibles intégralement
- Imposition à la source pour expats sans permis C
- Frontaliers : convention double imposition
- Anticipation pension : retrait pour résidence principale ou indépendance
- Donation/succession : taux MAJEURS varient par canton (0% ZG enfants vs 50% NE)
`,
    output_lang: 'français'
  },
  ES: {
    label: 'España',
    expert: 'asesor fiscal español especializado en patrimonio',
    envelopes: 'Plan de Pensiones, PIAS, IIC (fondos de inversión), ETFs no UCITS, Cuenta valores, Inmobiliario, Cuenta corriente',
    rules: `
- IRPF 2026: 19% / 24% / 30% / 37% / 45% / 47% (rendimientos del trabajo)
- Rendimientos del ahorro (PV mobiliarias): 19% / 21% / 23% / 27% / 28% (escalas)
- Plan de Pensiones aportación máxima 1500€/año (deducción IRPF marginal)
- PIAS: 5 años, exención si se convierte en renta vitalicia
- Compensación PV/MV: 25% per cross-class limit
- ETFs : régimen como acciones (vs fondos: traspaso sin tributar)
- Pareja de hecho / matrimonio: declaración conjunta o separada
- Comunidad autónoma: deducciones específicas (Madrid, Cataluña, etc.)
- Plusvalía municipal en venta de inmueble (IIVTNU)
- Patrimonio: impuesto autonómico sobre patrimonio neto > 700k€ (varia)
- ITP / AJD en transmisiones inmobiliarias
- Régimen Beckham para impatriados
`,
    output_lang: 'español'
  },
  DE: {
    label: 'Deutschland',
    expert: 'deutscher Steuerberater spezialisiert auf Vermögen und Vorsorge',
    envelopes: 'Riester-Rente, Rürup-Rente, betriebliche Altersversorgung (bAV), Depot, Sparerpauschbetrag, Bausparvertrag, Lebensversicherung',
    rules: `
- Einkommensteuer 2026: progressive Sätze 0-45% + Solidaritätszuschlag 5.5% (oberhalb)
- Kirchensteuer 8-9% (selon Bundesland)
- Abgeltungsteuer 25% + Soli + Kirchensteuer auf Kapitalerträge
- Sparerpauschbetrag 1000€ (Single) / 2000€ (Ehe) — exemption automatique
- Riester: bis 2100€ Sonderausgabenabzug + Zulagen
- Rürup (Basisrente): bis ~26.500€/an déductible (2026)
- bAV (betriebliche Altersversorgung): Entgeltumwandlung jusqu'à 8% BBG
- Spekulationssteuer immobilier : 10 ans de détention exonéré
- Verlustverrechnung : actions vs autres revenus séparé
- Teilfreistellung : ETFs Aktien 30% des PV exonérés
- Vorabpauschale annuelle sur fonds étrangers
- Solidaritätszuschlag 2026 (revenus élevés uniquement)
- Erbschaftsteuer 7-50% (avec abattements importants enfants)
`,
    output_lang: 'Deutsch (oder English si l\'utilisateur préfère)'
  },
  IT: {
    label: 'Italia',
    expert: 'commercialista italiano specializzato in pianificazione patrimoniale',
    envelopes: 'PIR (Piano Individuale Risparmio), Fondi Pensione (1°-2°-3° pilastro), TFR, Conto deposito, Dossier titoli, ETF, BTP',
    rules: `
- IRPEF 2026 : 23% / 35% / 43% (3 tranches)
- Capital gains : 26% (12.5% sui titoli di Stato BTP)
- PIR : esenzione totale dopo 5 anni (limite 30k€/anno e 150k€ totale)
- Fondi pensione : deduzione fino 5164.57€/anno
- TFR : tassazione separata media 23-43%
- Imposta di bollo dossier titoli : 0.20%/anno
- Imposta sostitutiva su conti deposito 26%
- IVAFE : 0.20% conti detenuti all'estero
- IVIE : 0.76% immobili all'estero
- Regime forfettario per autonomi (15% / 5% startup)
- Cedolare secca affitti 21% / 10%
- Donation/succession con franchigia familiari
- Bonus Casa / Superbonus (en transition)
`,
    output_lang: 'italiano'
  },
  PT: {
    label: 'Portugal',
    expert: 'fiscalista português especializado em planeamento patrimonial e regime NHR',
    envelopes: 'PPR (Plano Poupança Reforma), Conta-poupança, Carteira títulos, OICVM (UCITS), ETFs, Imobiliário, NHR (Non-Habitual Resident)',
    rules: `
- IRS 2026 : escalões 13.25% até 48% (acima de 81k€)
- Tributação autónoma mais-valias mobiliárias: 28% (opcional englobamento)
- PPR : dedução até 400€/600€/300€ segundo idade, isenção parcial mais-valias
- Regime NHR (10 anos) : tributação reduzida 20% rendimentos categoria A/B qualificados, isenção rendimentos estrangeiros (en transition vers NHR 2.0)
- Mais-valias imobiliárias : 50% inclusão no IRS (residência principal: reinvestimento)
- IMI / IMT immobilier
- AIMI imposto adicional patrimoniais > 600k€
- Cripto : 28% se < 1 ano detenção, isento se > 1 ano (CFC + Bitcoin)
- Empresarial: simplificado vs contabilidade organizada
- Crowdfunding & startups : benefícios SIFIDE
- Donations/successões : Imposto do Selo 10% (não cônjuge / descendentes)
`,
    output_lang: 'português'
  },
  FR: {
    label: 'France',
    expert: 'fiscaliste patrimonial français',
    envelopes: 'PEA, CTO, PER, AV, Crypto, LMNP, Holding patrimoniale',
    rules: 'Voir module Tax FR dédié pour la version complète.',
    output_lang: 'français'
  }
};

export function buildTaxPrompt(countryCode = 'US') {
  const c = COUNTRY_BLOCKS[countryCode] || COUNTRY_BLOCKS.US;
  return `You are a ${c.expert}. You produce optimization strategies tailored to ${c.label} tax law (2026).

⚠️ DISCLAIMER REQUIRED: this analysis is educational only. Any operation > 10k€ / $10k must be validated by a licensed tax advisor.

For the situation provided, generate the analysis in the following structure:

## 1. TAX SNAPSHOT
- Estimated marginal tax rate (income + capital gains + social charges)
- Current envelope breakdown
- Realized vs latent gains
- Annual savings capacity

## 2. AVAILABLE ENVELOPES & OPTIMIZATIONS
Country-specific envelopes for ${c.label}:
${c.envelopes}

For each relevant envelope:
- Current usage / remaining cap
- Specific recommendation
- Estimated tax savings (€ / $ / £)

## 3. ${c.label.toUpperCase()} — KEY TAX RULES TO LEVERAGE
${c.rules}

## 4. CAPITAL GAINS / LOSSES STRATEGY
- Tax-loss harvesting opportunities (with country-specific rules: wash sale US, abus de droit FR, etc.)
- Compensation of gains/losses
- Timing of realizations (year-end optimization)
- Long-term vs short-term holdings

## 5. RETIREMENT PLANNING (LOCAL SPECIFICS)
Country-specific retirement vehicles + tax advantages.
Annual contribution suggestions to maximize deductions.

## 6. ADVANCED STRATEGIES (IF APPLICABLE)
Country-specific advanced techniques (e.g. backdoor Roth US, Beckham law ES, NHR PT, holding patrimoniale FR/BE, Pilar 3a CH, family limited partnership, real estate consideration, etc.).

## 7. ACTION CHECKLIST BEFORE YEAR-END
Ordered list by tax impact (€ / $ / £):
1. ...
2. ...
3. ...

## 8. CROSS-BORDER CONSIDERATIONS (IF APPLICABLE)
If user mentions multi-country exposure, residency change, expatriation: address tax treaties, exit tax, double taxation.

## 9. LEGAL REMINDERS
- Educational analysis based on inputs provided
- Validate any > 10k operation with licensed tax advisor
- Tax law evolves yearly — verify current year regulations

Format: markdown strict, amounts with proper currency symbol (${c.label === 'United States' ? '$' : c.label === 'United Kingdom' ? '£' : '€'}), figures in monospace.

Reply in ${c.output_lang}.`;
}

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_BLOCKS).map(code => ({
  code,
  label: COUNTRY_BLOCKS[code].label,
  envelopes: COUNTRY_BLOCKS[code].envelopes
}));

export function getCountryEnvelopes(code) {
  return COUNTRY_BLOCKS[code]?.envelopes || '';
}
