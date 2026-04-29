// Demo analyses pré-générées — format Quick Analysis (verdict + score)

export const DEMO_QUICK = [
  {
    asset_name: 'Tesla (TSLA)',
    verdict: 'SELL',
    conviction: 7,
    global_score: 32,
    breakdown: { valuation: 22, growth: 65, risk: 25, sentiment: 35 },
    why: [
      'P/E forward `~92x` — extrême même pour une boîte de croissance, marges auto en compression',
      'Volume Model 3/Y stagnant en EU et Chine, pression BYD + Toyota EV',
      'CEO distrait (X, xAI, politique) → exécution opérationnelle dégradée'
    ],
    risks_for_short: [
      'Gamma squeeze possible sur catalyseur Robotaxi / FSD',
      'Sentiment retail toujours fanatique, hard to short'
    ],
    next_trigger: 'Si Q3 deliveries < 420k → confirmation thèse. Si > 460k → invalidation.'
  },
  {
    asset_name: 'Bitcoin (BTC)',
    verdict: 'HOLD',
    conviction: 5,
    global_score: 58,
    breakdown: { valuation: 50, growth: 70, risk: 45, sentiment: 65 },
    why: [
      'ETF inflows positifs cumulés `+$15B` YTD mais ralentissement récent',
      'Halving cycle pricing in — historiquement 12-18 mois après le halving = top',
      'Macro neutre : taux réels US `+1.5%`, pas de tailwind massif'
    ],
    risks: [
      'Cycle macro late : si récession 2026, BTC retrace -40% comme historiquement',
      'Concentration : 5 wallets = 18% supply — risque dump'
    ],
    next_trigger: 'Cassure $80k = sell signal. Cassure $130k = re-rate à BUY.'
  },
  {
    asset_name: 'Apple (AAPL)',
    verdict: 'BUY',
    conviction: 8,
    global_score: 78,
    breakdown: { valuation: 60, growth: 75, risk: 88, sentiment: 90 },
    why: [
      'Services = 24% revenus, marge brute `74%` → expansion structurelle',
      'Buybacks `$110B/an` à valo raisonnable (P/E forward `28x` vs hist 5y `26x`)',
      'iPhone cycle AI features 2026 = vrai catalyseur de remplacement',
      'Cash net `$60B` → optionnalité M&A / dividendes'
    ],
    risks: [
      'Concentration Chine 17% revenus, risque géopolitique persistant',
      'Régulation App Store EU/US (DMA), impact services à terme'
    ],
    next_trigger: 'Surprise négative iPhone unit sales Q1 2026 = downgrade. Adoption Vision Pro 2 = upgrade conviction.'
  }
];

// Format wrapper compatible avec l'ancien format pour rétrocompat
export function listDemoAnalyses() {
  return DEMO_QUICK.map((d, i) => ({
    id: 'quick-' + i,
    title: 'Quick · ' + d.asset_name,
    output: formatDemoAsMarkdown(d)
  }));
}

export function formatDemoAsMarkdown(d) {
  const emoji = d.verdict === 'BUY' ? '🟢' : d.verdict === 'SELL' ? '🔴' : '🟡';
  const verdictLabel = d.verdict === 'BUY' ? 'ACHETER' : d.verdict === 'SELL' ? 'VENDRE' : 'ATTENDRE';
  return `\`\`\`json
${JSON.stringify({
    verdict: d.verdict,
    conviction: d.conviction,
    global_score: d.global_score,
    score_breakdown: d.breakdown,
    asset_type: d.asset_name.toLowerCase().includes('btc') || d.asset_name.toLowerCase().includes('eth') ? 'crypto' : 'stock',
    asset_name: d.asset_name
  }, null, 2)}
\`\`\`

## ${emoji} ${verdictLabel}

**Pourquoi** :
${d.why.map(w => '- ' + w).join('\n')}

**Risques** :
${(d.risks || d.risks_for_short || []).map(r => '- ' + r).join('\n')}

**Prochain trigger** : ${d.next_trigger}`;
}
