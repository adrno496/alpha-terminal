// 💎 Value Tracker — chiffre la valeur consommée par l'utilisateur ce mois.
// Justifie l'abonnement : "Ce mois, 12 analyses LLM = 240€ d'équivalent Bloomberg".
// Affiché dans Settings + un widget en sidebar pour rappel régulier.

const KEY = 'alpha-terminal:value-tracker';

// Estimation prudente du "prix de marché" pour chaque type d'action.
// Bloomberg Terminal coûte ~2000€/mois pour des analyses similaires.
// Sources : tarifs analystes freelance, Koyfin Pro, Stock Analysis Premium.
const VALUE_PER_ACTION_EUR = {
  'analysis': 20,           // Une analyse LLM equivalente analyste = 20€
  '10k-decoder': 50,        // Décodage 10-K complet par analyste : 50-100€
  'dcf': 30,                // Modélisation DCF sur mesure
  'investment-memo': 40,    // Note d'investissement
  'portfolio-audit': 60,    // Audit portefeuille
  'tax-optimization': 80,   // Conseil fiscal
  'briefing': 5,            // Briefing matinal
  'screening': 15,          // Stock screening custom
  'pdf-export': 3           // Export pro
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { actions: [] };
  } catch { return { actions: [] }; }
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

// Mappe un moduleId vers une catégorie value
function categorize(moduleId) {
  if (!moduleId) return 'analysis';
  if (moduleId === 'decoder-10k') return '10k-decoder';
  if (moduleId === 'dcf') return 'dcf';
  if (moduleId === 'investment-memo') return 'investment-memo';
  if (moduleId === 'portfolio-audit') return 'portfolio-audit';
  if (moduleId.startsWith('tax-') || moduleId === 'envelope-optimizer' || moduleId === 'ifi-simulator') return 'tax-optimization';
  if (moduleId === 'daily-briefing' || moduleId === 'market-pulse') return 'briefing';
  if (moduleId === 'stock-screener') return 'screening';
  return 'analysis';
}

// Appelé après une analyse réussie (depuis runAnalysis dans _shared.js)
export function trackValueAction(moduleId, type = null) {
  try {
    const s = read();
    s.actions.push({
      moduleId,
      type: type || categorize(moduleId),
      at: Date.now()
    });
    // Cap à 1000 entrées pour éviter d'exploser le localStorage
    if (s.actions.length > 1000) s.actions = s.actions.slice(-1000);
    write(s);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alpha:value-tracker-changed'));
    }
  } catch {}
}

// Calcule la valeur totale (€) sur les N derniers jours
export function getValueOverDays(days = 30) {
  const s = read();
  const cutoff = Date.now() - days * 86400000;
  const recent = s.actions.filter(a => (a.at || 0) >= cutoff);
  let totalEur = 0;
  const byCategory = {};
  recent.forEach(a => {
    const v = VALUE_PER_ACTION_EUR[a.type] || VALUE_PER_ACTION_EUR.analysis;
    totalEur += v;
    byCategory[a.type] = (byCategory[a.type] || 0) + 1;
  });
  return {
    totalEur: Math.round(totalEur),
    actionCount: recent.length,
    byCategory,
    days
  };
}

// Format compact pour la sidebar : "💎 240€ ce mois"
export function formatValueBadge() {
  const { totalEur, actionCount } = getValueOverDays(30);
  if (actionCount < 1) return '';
  return `💎 ${totalEur}€`;
}
