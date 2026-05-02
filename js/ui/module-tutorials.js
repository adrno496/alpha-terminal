// Tutoriels par module — affichés en tooltip flottant à la PREMIÈRE ouverture
// d'un module. Stockés en localStorage pour ne pas re-spam le user.
// Appelle showTutorialIfFirstOpen(moduleId) au début de chaque module.render().

import { getLocale } from '../core/i18n.js';

const SEEN_KEY = 'alpha-terminal:tutorials-seen';

// Dictionnaire des tutoriels par module. Clé = moduleId, valeur = { fr, en }.
// Format compact : { title, body, tips? (array of strings) }
const TUTORIALS = {
  'quick-analysis': {
    fr: {
      title: '⚡ Analyse rapide — comment ça marche',
      body: 'Tape un ticker (AAPL, BTC, MC.PA, etc.) ou un nom d\'entreprise. Alpha te sort un verdict <strong>ACHETER / VENDRE / ATTENDRE</strong> + un score 0-100 en 30 secondes.',
      tips: [
        'Pour les actions US : ticker simple (AAPL, NVDA, TSLA)',
        'Pour les actions Euronext : ajoute .PA (LVMH → MC.PA, TotalEnergies → TTE.PA)',
        'Pour la crypto : symbole standard (BTC, ETH, SOL)'
      ]
    },
    en: {
      title: '⚡ Quick Analysis — how it works',
      body: 'Type a ticker (AAPL, BTC, MC.PA, etc.) or company name. Alpha gives you a <strong>BUY / SELL / WAIT</strong> verdict + 0-100 score in 30 seconds.',
      tips: [
        'For US stocks: simple ticker (AAPL, NVDA, TSLA)',
        'For Euronext: add .PA (LVMH → MC.PA)',
        'For crypto: standard symbol (BTC, ETH, SOL)'
      ]
    }
  },
  'decoder-10k': {
    fr: {
      title: '📑 10-K Decoder — décortique un rapport annuel',
      body: 'Colle l\'URL d\'un 10-K SEC ou drop le PDF. L\'IA extrait les <strong>5 sections clés</strong> (MD&A, risques, financials, compensation, notes) en 30 secondes au lieu de 3 heures.',
      tips: [
        'Trouve les 10-K sur sec.gov/cgi-bin/browse-edgar',
        'Maximum 300 pages traitées par défaut',
        'Coût LLM : ~$0,30 pour un 10-K complet'
      ]
    },
    en: {
      title: '📑 10-K Decoder — dissect an annual report',
      body: 'Paste a SEC 10-K URL or drop the PDF. AI extracts the <strong>5 key sections</strong> (MD&A, risks, financials, compensation, notes) in 30 seconds instead of 3 hours.',
      tips: [
        'Find 10-Ks on sec.gov/cgi-bin/browse-edgar',
        'Max 300 pages processed by default',
        'LLM cost: ~$0.30 for a full 10-K'
      ]
    }
  },
  'dcf': {
    fr: {
      title: '🧮 DCF — valorisation par flux actualisés',
      body: 'Saisis FCF, croissance, WACC → Alpha calcule la <strong>valeur intrinsèque</strong> par action et te dit si l\'action est sous/sur-valorisée vs le cours actuel.',
      tips: [
        'WACC typique : 8-12% pour large caps US, 10-15% pour small caps',
        'Croissance terminale : ne dépasse jamais 3-4% (croissance long terme du PIB)',
        'Toujours faire 3 scénarios (pessimiste/central/optimiste)'
      ]
    },
    en: {
      title: '🧮 DCF — discounted cash flow valuation',
      body: 'Enter FCF, growth, WACC → Alpha computes <strong>intrinsic value</strong> per share and tells you if the stock is under/overvalued.',
      tips: [
        'Typical WACC: 8-12% large caps US, 10-15% small caps',
        'Terminal growth: never exceed 3-4% (long-term GDP growth)',
        'Always run 3 scenarios (bear/base/bull)'
      ]
    }
  },
  'wealth': {
    fr: {
      title: '💼 Patrimoine — saisie & suivi',
      body: 'Ajoute tes positions (actions, ETF, crypto, immobilier, livrets). Alpha rafraîchit les prix automatiquement et calcule ta <strong>perf, allocation, et exposition risque</strong>.',
      tips: [
        'Bouton "🔄 Refresh prices" pour mettre à jour tous les cours',
        'Crée des comptes (PEA, CTO, AV) pour grouper tes positions',
        'Snapshot hebdo automatique pour suivre l\'évolution dans le temps'
      ]
    },
    en: {
      title: '💼 Wealth — entry & tracking',
      body: 'Add your positions (stocks, ETFs, crypto, real estate, savings). Alpha auto-refreshes prices and computes <strong>performance, allocation, and risk exposure</strong>.',
      tips: [
        '"🔄 Refresh prices" button updates all quotes',
        'Group positions by account (taxable, retirement, etc.)',
        'Weekly auto-snapshot tracks evolution over time'
      ]
    }
  },
  'knowledge-base': {
    fr: {
      title: '📚 Knowledge Base — RAG sur tes documents',
      body: 'Dépose tes <strong>PDFs, docs, notes, transcripts</strong> (jusqu\'à 10 Mo chacun). Alpha les indexe localement (IndexedDB) et tu peux poser des questions dessus avec n\'importe quel module.',
      tips: [
        'Tout reste en local — aucun document ne quitte ton appareil',
        'Marche avec : 10-K Decoder, Quick Analysis, Earnings Call, etc.',
        'Tu peux activer/désactiver le RAG par module'
      ]
    },
    en: {
      title: '📚 Knowledge Base — RAG on your docs',
      body: 'Drop your <strong>PDFs, docs, notes, transcripts</strong> (up to 10 MB each). Alpha indexes them locally (IndexedDB) and you can query them from any module.',
      tips: [
        'Everything stays local — no document leaves your device',
        'Works with: 10-K Decoder, Quick Analysis, Earnings Call…',
        'Toggle RAG per module'
      ]
    }
  },
  'tax-international': {
    fr: {
      title: '🌍 Tax Optimizer International — 8 pays',
      body: 'Choisis ton pays de résidence fiscale (FR, BE, CH, LU, US, UK, IT, ES). Alpha te dit la fiscalité applicable sur tes plus-values, dividendes, et propose les <strong>optimisations possibles</strong>.',
      tips: [
        'Précis pour fiscalité 2025-2026, conventions fiscales incluses',
        'Pas un avis juridique — toujours valider avec ton fiscaliste',
        'Pour la France : module IFI dédié + Capital Gains FIFO/CMP'
      ]
    },
    en: {
      title: '🌍 Tax Optimizer International — 8 countries',
      body: 'Pick your tax residency (FR, BE, CH, LU, US, UK, IT, ES). Alpha tells you applicable taxation on capital gains, dividends, and proposes <strong>optimizations</strong>.',
      tips: [
        'Accurate for 2025-2026 taxation, treaties included',
        'Not legal advice — always validate with your tax advisor',
        'For France: dedicated IFI + Capital Gains FIFO modules'
      ]
    }
  },
  'audit-buffett': {
    fr: {
      title: '🎯 Audit Buffett — 7 critères du Maître',
      body: 'Alpha note l\'action sur les <strong>7 critères clés de Warren Buffett</strong> : moat durable, ROIC > 15%, marges stables, dette maîtrisée, management qualité, croissance organique, prix raisonnable.',
      tips: [
        'Score 0-100 chiffré pour chaque critère',
        'Red flags affichés en rouge avec explication',
        'Idéal pour filtrer une longue liste d\'actions candidates'
      ]
    },
    en: {
      title: '🎯 Buffett Audit — 7 criteria of the Oracle',
      body: 'Alpha scores the stock on Warren Buffett\'s <strong>7 key criteria</strong>: durable moat, ROIC > 15%, stable margins, controlled debt, quality management, organic growth, reasonable price.',
      tips: [
        '0-100 score per criterion',
        'Red flags shown in red with explanation',
        'Ideal to filter a long list of stock candidates'
      ]
    }
  },
  'ceo-forensics': {
    fr: {
      title: '🔬 CEO Forensics — décode les earnings calls',
      body: 'Colle l\'URL d\'un earnings call (YouTube/transcript) → Alpha détecte les <strong>signaux faibles</strong> : déflexions, formulations vagues, changements de ton, et ce que le CEO ne dit pas.',
      tips: [
        'Marche aussi sur les keynotes (Apple, NVIDIA, Tesla)',
        '12 patterns linguistiques de "CEO qui cache quelque chose"',
        'Cite les minutes exactes pour vérifier toi-même'
      ]
    },
    en: {
      title: '🔬 CEO Forensics — decode earnings calls',
      body: 'Paste an earnings call URL (YouTube/transcript) → Alpha detects <strong>weak signals</strong>: deflections, vague phrasing, tone changes, what the CEO doesn\'t say.',
      tips: [
        'Also works on keynotes (Apple, NVIDIA, Tesla)',
        '12 linguistic patterns of "CEO hiding something"',
        'Cites exact timestamps so you can verify'
      ]
    }
  }
};

function getSeenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
  catch { return new Set(); }
}
function markSeen(moduleId) {
  const set = getSeenSet();
  set.add(moduleId);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set))); } catch {}
}

// Pour debug / settings : reset tous les tutos
export function resetTutorials() {
  try { localStorage.removeItem(SEEN_KEY); } catch {}
}

function injectStyles() {
  if (document.getElementById('module-tutorial-styles')) return;
  const css = `
    .mt-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9998; backdrop-filter:blur(2px); }
    .mt-card {
      position:fixed; left:50%; top:50%; transform:translate(-50%,-50%);
      max-width:520px; width:calc(100% - 28px);
      background:linear-gradient(135deg,#0f1f15,#0a0a0a);
      border:1px solid #00ff88; border-radius:12px;
      padding:24px 26px; z-index:9999;
      box-shadow:0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,136,0.18);
      color:#fff; font-family:'Inter',sans-serif;
      animation: mt-pop 0.25s ease-out;
    }
    @keyframes mt-pop { from { opacity:0; transform:translate(-50%,-45%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
    .mt-card h3 { margin:0 0 10px; font-size:18px; color:#00ff88; }
    .mt-card p { margin:0 0 14px; font-size:14px; line-height:1.6; color:#ddd; }
    .mt-card ul { margin:0 0 16px; padding-left:18px; font-size:13px; color:#bbb; line-height:1.7; }
    .mt-card ul li { margin-bottom:4px; }
    .mt-card .mt-tips-label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; font-weight:600; }
    .mt-card .mt-actions { display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:10px; }
    .mt-card .mt-dismiss { background:#00ff88; color:#000; padding:9px 18px; border-radius:6px; font-weight:700; border:0; cursor:pointer; font-size:13px; }
    .mt-card .mt-dismiss:hover { opacity:0.9; }
    .mt-card .mt-skip { background:transparent; border:0; color:#888; cursor:pointer; font-size:12px; padding:4px 8px; }
    .mt-card .mt-skip:hover { color:#fff; }
  `;
  const s = document.createElement('style');
  s.id = 'module-tutorial-styles';
  s.textContent = css;
  document.head.appendChild(s);
}

/**
 * Affiche un tutoriel pour le moduleId si c'est sa première ouverture.
 * À appeler au début du render() de chaque module qui a un tuto défini.
 *
 * @param {string} moduleId
 * @returns {boolean} true si le tuto a été affiché
 */
export function showTutorialIfFirstOpen(moduleId) {
  const tut = TUTORIALS[moduleId];
  if (!tut) return false;
  const seen = getSeenSet();
  if (seen.has(moduleId)) return false;

  const isEN = getLocale() === 'en';
  const t = (isEN && tut.en) ? tut.en : tut.fr;
  if (!t) return false;

  injectStyles();

  // Marque AVANT d'afficher (évite re-trigger si user ferme par accident)
  markSeen(moduleId);

  const overlay = document.createElement('div');
  overlay.className = 'mt-overlay';
  const card = document.createElement('div');
  card.className = 'mt-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const tipsHtml = t.tips && t.tips.length
    ? `<div class="mt-tips-label">${isEN ? '💡 Pro tips' : '💡 Astuces'}</div>
       <ul>${t.tips.map(tip => `<li>${tip}</li>`).join('')}</ul>`
    : '';

  card.innerHTML = `
    <h3>${t.title}</h3>
    <p>${t.body}</p>
    ${tipsHtml}
    <div class="mt-actions">
      <button class="mt-skip" type="button">${isEN ? 'Skip all tutorials' : 'Désactiver tous les tutos'}</button>
      <button class="mt-dismiss" type="button">${isEN ? "Got it · let's go" : 'Compris · go !'}</button>
    </div>
  `;

  function close() {
    try {
      card.remove();
      overlay.remove();
    } catch {}
  }
  function skipAll() {
    // Marque tous les modules comme vus
    const all = Object.keys(TUTORIALS);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(all)); } catch {}
    close();
  }

  overlay.addEventListener('click', close);
  card.querySelector('.mt-dismiss').addEventListener('click', close);
  card.querySelector('.mt-skip').addEventListener('click', skipAll);
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  document.body.appendChild(overlay);
  document.body.appendChild(card);
  return true;
}

// Expose en global pour debug rapide
if (typeof window !== 'undefined') {
  window.AlphaTutorials = { show: showTutorialIfFirstOpen, reset: resetTutorials };
}
