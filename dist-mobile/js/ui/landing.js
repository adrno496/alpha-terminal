// Landing page : rendu, ticker animé, modules grid, FAQ, navigation vers wizard
import { $, $$ } from '../core/utils.js';
import { MODULES } from './sidebar.js';
import { makeThemeToggle } from './theme.js';
import { makeLocaleToggle, t, getLocale } from '../core/i18n.js';

const MODULE_DETAILS = {
  get 'quick-analysis'()      { return { icon: '⚡', flow: 'Ticker → Verdict 30s' }; },
  get 'wealth'()              { return { icon: '💼', flow: 'Holdings → Mémoire' }; },
  get 'research-agent'()      { return { icon: '🚀', flow: 'Ticker → Analyse complète' }; },
  get 'decoder-10k'()         { return { icon: '📊', flow: t('land.flow.10k') }; },
  get 'macro-dashboard'()     { return { icon: '🌍', flow: t('land.flow.macro') }; },
  get 'crypto-fundamental'()  { return { icon: '🪙', flow: t('land.flow.crypto') }; },
  get 'earnings-call'()       { return { icon: '🎙️', flow: t('land.flow.earnings') }; },
  get 'portfolio-rebalancer'(){ return { icon: '💼', flow: t('land.flow.portfolio') }; },
  get 'tax-optimizer-fr'()    { return { icon: '🇫🇷', flow: t('land.flow.tax') }; },
  get 'tax-international'()   { return { icon: '🌍', flow: 'Pays → Optimisation' }; },
  get 'whitepaper-reader'()   { return { icon: '⚠️', flow: t('land.flow.whitepaper') }; },
  get 'sentiment-tracker'()   { return { icon: '📡', flow: t('land.flow.sentiment') }; },
  get 'newsletter-investor'() { return { icon: '✍️', flow: t('land.flow.newsletter') }; },
  get 'position-sizing'()     { return { icon: '🎯', flow: t('land.flow.sizing') }; },
  get 'dcf'()                 { return { icon: '🧮', flow: 'Inputs → Fair value' }; },
  get 'pre-mortem'()          { return { icon: '🔥', flow: 'Thèse → Avocat du diable' }; },
  get 'stock-screener'()      { return { icon: '🔍', flow: 'Critères → Idées' }; },
  get 'trade-journal'()       { return { icon: '📖', flow: 'Trades → Patterns' }; },
  get 'investment-memo'()     { return { icon: '📑', flow: 'Bull/Bear → Memo' }; },
  get 'fire-calculator'()     { return { icon: '🔥', flow: 'Profil → Date FIRE' }; },
  get 'stress-test'()         { return { icon: '💥', flow: 'Portfolio → 6 scénarios' }; },
  get 'battle-mode'()         { return { icon: '⚔️', flow: '2 actifs → 5 rounds' }; },
  get 'watchlist'()           { return { icon: '👁', flow: 'Tickers → Brief 24h' }; },
  get 'knowledge-base'()      { return { icon: '📚', flow: 'Notes/PDFs → RAG' }; },
  get 'portfolio-audit'()     { return { icon: '🔎', flow: 'Holdings → Score 0-100' }; },
  get 'youtube-transcript'()  { return { icon: '🎙', flow: 'Transcript → CEO Forensics' }; },
  // V7 — Finances perso
  get 'budget'()                { return { icon: '💰', flow: 'Revenus / dépenses → Taux d\'épargne' }; },
  get 'fees-analysis'()         { return { icon: '🔥', flow: 'Holdings → Impact frais 30 ans' }; },
  get 'dividends-tracker'()     { return { icon: '💸', flow: 'Holdings → Calendrier annuel' }; },
  get 'diversification-score'() { return { icon: '🎯', flow: 'Holdings → Score 0-100' }; },
  get 'wealth-method'()         { return { icon: '📚', flow: 'Patrimoine → Checklist FR' }; },
  get 'csv-import'()            { return { icon: '📥', flow: 'CSV bancaire → Budget' }; },
  get 'insights-engine'()       { return { icon: '✨', flow: 'Patrimoine → Alertes hebdo' }; },
  get 'price-alerts'()          { return { icon: '🚨', flow: 'YouTube → Niveaux → Voyant rouge' }; }
};

const FAQ_FR = [
  { q: 'Faut-il être développeur pour utiliser l\'app ?', a: 'Non. Tu télécharges, tu colles ta clé API, et tu utilises les 26 modules comme une app classique. Aucune ligne de code n\'est requise.' },
  { q: 'Quels providers d\'IA sont supportés ?', a: '14 providers : <strong>Anthropic Claude, OpenAI, Google Gemini, xAI Grok, OpenRouter, Perplexity, Mistral, Cerebras, GitHub Models, NVIDIA NIM, Hugging Face, Cloudflare Workers AI, Together AI, Cohere</strong>. Une seule clé suffit pour démarrer ; plus tu en mets, plus l\'app sélectionne le meilleur modèle pour chaque tâche.' },
  { q: 'Comment créer une clé API ?', a: 'Liens directs dans le wizard de configuration. Pour démarrer rapidement : <a href="https://console.anthropic.com/settings/keys" target="_blank">Claude</a> · <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI</a> · <a href="https://aistudio.google.com/app/apikey" target="_blank">Gemini</a>. GitHub Models est gratuit (rate-limit) avec un PAT GitHub.' },
  { q: 'Mes données sont-elles vraiment privées ?', a: '<strong>Oui, 100%</strong>. L\'app appelle l\'API du provider directement depuis ton navigateur. <strong>Aucun serveur intermédiaire ALPHA TERMINAL</strong>. Tes clés API sont chiffrées localement (AES-GCM 256 + PBKDF2 100K iterations). Vérifie toi-même : ouvre DevTools → Network, tu verras uniquement des appels vers les APIs des providers. Toutes tes analyses sont stockées dans IndexedDB local.' },
  { q: 'Combien ça coûte par analyse ?', a: 'Variable selon module et provider. Quick Analysis : ~$0.005-0.02. 10-K Decoder : ~$0.05-1.00. Position Sizing : ~$0.01. Sentiment scan : ~$0.05-0.20 (web search facturé en plus). Cerebras et GitHub Models offrent un tier quasi-gratuit. <strong>Tu paies au provider directement</strong>.' },
  { q: 'Comment fonctionne la mémoire patrimoine ?', a: 'Le module "Patrimoine" stocke localement tes holdings (actions, ETF, crypto, immo, cash). Chaque module peut activer "💼 Use my wealth" pour injecter ce contexte dans l\'analyse — l\'IA adapte ses recommandations à TA situation réelle. Auto-refresh des prix via 11 data providers (FMP, Polygon, Finnhub, CoinGecko, etc.).' },
  { q: 'Qu\'est-ce que la Knowledge Base (RAG) ?', a: 'Tu indexes tes notes, theses, PDFs personnels. L\'app utilise les embeddings OpenAI pour recherche sémantique. Active "📚 KB" dans n\'importe quel module → tes documents pertinents sont auto-injectés dans le prompt. Sans clé OpenAI : fallback keyword matching.' },
  { q: 'Que se passe-t-il si je n\'ai qu\'une seule clé API ?', a: 'Tous les 26 modules tournent. Pour les modules PDF, si ton provider ne supporte pas le PDF natif (OpenAI, Grok, Mistral), l\'app extrait le texte côté client. Tout fonctionne.' },
  { q: 'Y a-t-il des mises à jour ?', a: 'Oui. Les noms de modèles évoluent rapidement chez tous les providers — l\'app les laisse éditables dans Settings → Modèles pour que tu puisses suivre les releases sans attendre une mise à jour.' },
  { q: 'Compatible mobile ?', a: 'Oui. Build Android natif via Capacitor 8 (Google Play). Sidebar drawer, formulaires single-column, modales plein écran. iOS également supporté (build Xcode requis).' },
  { q: 'Que se passe-t-il si je perds mon mot de passe ?', a: 'Tes clés API sont chiffrées avec ce mot de passe. <strong>Sans le mot de passe, tu ne peux pas récupérer le vault</strong>. Tu peux le reset (effacer les clés) et recommencer la config — tes analyses passées restent accessibles.' }
];

const FAQ_EN = [
  { q: 'Do I need to be a developer to use the app?', a: 'No. Download, paste your API key, use the 26 modules like any app. No code required.' },
  { q: 'Which AI providers are supported?', a: '14 providers: <strong>Anthropic Claude, OpenAI, Google Gemini, xAI Grok, OpenRouter, Perplexity, Mistral, Cerebras, GitHub Models, NVIDIA NIM, Hugging Face, Cloudflare Workers AI, Together AI, Cohere</strong>. One key is enough to start; the more you add, the smarter the per-task routing.' },
  { q: 'How do I create an API key?', a: 'Direct links in the setup wizard. To start quickly: <a href="https://console.anthropic.com/settings/keys" target="_blank">Claude</a> · <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI</a> · <a href="https://aistudio.google.com/app/apikey" target="_blank">Gemini</a>. GitHub Models is free (rate-limited) with a GitHub PAT.' },
  { q: 'Is my data really private?', a: '<strong>Yes, 100%</strong>. The app calls the provider API directly from your browser. <strong>No ALPHA TERMINAL intermediary server</strong>. Your API keys are encrypted locally (AES-GCM 256 + PBKDF2 100K iterations). Verify it yourself: open DevTools → Network — you\'ll only see calls to provider APIs. All your analyses are stored in local IndexedDB.' },
  { q: 'How much does each analysis cost?', a: 'Varies by module and provider. Quick Analysis: ~$0.005-0.02. 10-K Decoder: ~$0.05-1.00. Position Sizing: ~$0.01. Sentiment scan: ~$0.05-0.20 (web search billed extra). Cerebras and GitHub Models offer near-free tiers. <strong>You pay the provider directly</strong>.' },
  { q: 'How does the wealth memory work?', a: 'The "Wealth" module stores your holdings locally (stocks, ETFs, crypto, real estate, cash). Any module can enable "💼 Use my wealth" to inject this context into the analysis — the AI tailors recommendations to YOUR real situation. Auto-refresh prices via 11 data providers.' },
  { q: 'What is the Knowledge Base (RAG)?', a: 'Index your personal notes, theses, PDFs. The app uses OpenAI embeddings for semantic search. Toggle "📚 KB" in any module → your relevant docs are auto-injected. Without an OpenAI key: keyword matching fallback.' },
  { q: 'What if I only have one API key?', a: 'All 26 modules work. For PDF modules, if your provider doesn\'t support native PDF (OpenAI, Grok, Mistral), the app extracts text client-side. Everything works.' },
  { q: 'Are there updates?', a: 'Yes. Model names evolve quickly across all providers — the app lets you edit them in Settings → Models so you can follow releases without waiting for an app update.' },
  { q: 'Mobile compatible?', a: 'Yes. Native Android build via Capacitor 8 (Google Play). Sidebar drawer, single-column forms, full-screen modals. iOS also supported (Xcode build required).' },
  { q: 'What if I lose my password?', a: 'Your API keys are encrypted with it. <strong>Without the password, you cannot recover the vault</strong>. You can reset (wipe the keys) and reconfigure — past analyses remain accessible.' }
];

export function renderLanding({ onCtaClick }) {
  // Ticker — données réelles via CoinGecko (crypto, sans clé) + Frankfurter (FX, sans clé)
  const ticker = $('#ticker-track');
  if (ticker && !ticker.dataset.ready) {
    ticker.dataset.ready = '1';
    renderTicker(ticker).catch(() => renderTickerFallback(ticker));
    // Refresh toutes les 90s pour rester à jour sans hammer les APIs
    setInterval(() => renderTicker(ticker).catch(() => {}), 90_000);
  }

  // Modules grid
  const grid = $('#modules-grid');
  if (grid) {
    grid.innerHTML = MODULES.map(m => {
      const d = MODULE_DETAILS[m.id] || { icon: '·', flow: '' };
      return `
        <div class="module-card" data-mod="${m.id}">
          <div class="module-card-icon">${d.icon}</div>
          <div class="module-card-num">${m.num}</div>
          <h4>${m.label}</h4>
          <p>${m.desc}</p>
          <div class="module-card-flow">${d.flow}</div>
        </div>
      `;
    }).join('');
  }

  // FAQ
  const faqEl = $('#faq-list');
  if (faqEl) {
    const FAQ = getLocale() === 'en' ? FAQ_EN : FAQ_FR;
    faqEl.innerHTML = FAQ.map((f, i) => `
      <details class="faq-item" ${i===0?'open':''}>
        <summary>${f.q}</summary>
        <div class="faq-answer">${f.a}</div>
      </details>
    `).join('');
  }

  // Legal links in footer (one-shot binding)
  $$('.landing-footer [data-legal]').forEach(a => {
    if (a.dataset.bound === '1') return;
    a.dataset.bound = '1';
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const which = a.getAttribute('data-legal');
      const { showLegalPage } = await import('./legal-pages.js');
      showLegalPage(which);
    });
  });

  // Theme toggle + Locale toggle dans la nav landing (avant le CTA top)
  const navLinks = $('.landing-nav-links');
  if (navLinks && !navLinks.querySelector('.theme-toggle')) {
    navLinks.insertBefore(makeThemeToggle(), navLinks.querySelector('#cta-top'));
  }
  if (navLinks) {
    // Toujours re-créer le bouton lang pour refléter la locale courante (FR ↔ EN)
    navLinks.querySelectorAll('.lang-toggle').forEach(el => el.remove());
    navLinks.insertBefore(makeLocaleToggle(), navLinks.querySelector('#cta-top'));
  }
  // Update CTA labels selon locale
  const ctaTop = $('#cta-top'); if (ctaTop) ctaTop.textContent = t('land.cta.start');
  const ctaHero = $('#cta-hero'); if (ctaHero) ctaHero.textContent = t('land.cta.start');
  const ctaFinal = $('#cta-final'); if (ctaFinal) ctaFinal.textContent = t('land.cta.final.btn');
  const demo = document.querySelector('[data-demo-trigger]'); if (demo) demo.textContent = t('land.cta.demo');
  // Update visible texts
  const isEN = getLocale() === 'en';
  if (isEN) {
    const subEl = document.querySelector('.hero-sub'); if (subEl) subEl.innerHTML = t('land.hero.sub');
    const pitchEl = document.querySelector('.hero-pitch'); if (pitchEl) pitchEl.innerHTML = t('land.hero.pitch');
    const pillsEl = document.querySelector('.hero-pills'); if (pillsEl) pillsEl.textContent = t('land.hero.pills').replace(/●/g, '·').replace(/^·\s*/, '● ');
  }

  // CTAs (one-shot binding)
  ['cta-top', 'cta-hero', 'cta-final'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('click', () => onCtaClick && onCtaClick());
  });
  const howLink = $('#how-link-keys');
  if (howLink && howLink.dataset.bound !== '1') {
    howLink.dataset.bound = '1';
    howLink.addEventListener('click', (e) => {
      e.preventDefault();
      alert(
        'Crée ta clé API sur :\n\n' +
        '• Claude → console.anthropic.com\n' +
        '• OpenAI → platform.openai.com\n' +
        '• Gemini → aistudio.google.com\n' +
        '• Grok → console.x.ai\n\n' +
        'Une seule suffit pour démarrer.'
      );
    });
  }

  // Smooth scroll links (one-shot binding)
  $$('.landing-nav-links a, .hero-cta a').forEach(a => {
    if (a.dataset.scrollBound === '1') return;
    a.dataset.scrollBound = '1';
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        e.preventDefault();
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Reveal on scroll
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add('in-view');
      }
    }, { threshold: 0.12 });
    $$('.reveal').forEach(el => obs.observe(el));
  }
}

export function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

export function hideLanding() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

// =================================================================
// TICKER avec vraies données — CoinGecko (crypto, no-key) + Frankfurter (FX, no-key)
// =================================================================

const TICKER_COINS = [
  { id: 'bitcoin',       sym: 'BTC',  prefix: '$' },
  { id: 'ethereum',      sym: 'ETH',  prefix: '$' },
  { id: 'solana',        sym: 'SOL',  prefix: '$' },
  { id: 'binancecoin',   sym: 'BNB',  prefix: '$' },
  { id: 'ripple',        sym: 'XRP',  prefix: '$' },
  { id: 'cardano',       sym: 'ADA',  prefix: '$' },
  { id: 'dogecoin',      sym: 'DOGE', prefix: '$' },
  { id: 'avalanche-2',   sym: 'AVAX', prefix: '$' },
  { id: 'chainlink',     sym: 'LINK', prefix: '$' },
  { id: 'polkadot',      sym: 'DOT',  prefix: '$' },
  { id: 'pax-gold',      sym: 'GOLD', prefix: '$' },  // PAXG — gold-pegged
];

async function fetchCoinGeckoSimple(ids) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('CoinGecko HTTP ' + res.status);
  return res.json();
}

async function fetchCoinGeckoGlobal() {
  const res = await fetch('https://api.coingecko.com/api/v3/global');
  if (!res.ok) throw new Error('CoinGecko global HTTP ' + res.status);
  return res.json();
}

async function fetchFrankfurter(base, symbols) {
  const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols.join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Frankfurter HTTP ' + res.status);
  return res.json();
}

function fmtPrice(n, prefix = '$') {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 10)   return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1)    return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 5 });
}

function fmtChange(pct) {
  if (pct == null || isNaN(pct)) return { text: '—', cls: '' };
  const sign = pct >= 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(2)}%`,
    cls: pct >= 0 ? 'green' : 'red'
  };
}

async function renderTicker(ticker) {
  const items = [];

  // 1. Crypto + GOLD (PAXG) via CoinGecko
  try {
    const ids = TICKER_COINS.map(c => c.id);
    const data = await fetchCoinGeckoSimple(ids);
    for (const c of TICKER_COINS) {
      const d = data[c.id];
      if (!d) continue;
      const price = d.usd;
      const chg = d.usd_24h_change;
      items.push({ sym: c.sym, value: fmtPrice(price, c.prefix), change: fmtChange(chg) });
    }
  } catch {}

  // 2. BTC dominance + Total crypto market cap via CoinGecko global
  try {
    const g = await fetchCoinGeckoGlobal();
    const dom = g?.data?.market_cap_percentage?.btc;
    if (typeof dom === 'number') {
      items.push({ sym: 'BTC.D', value: dom.toFixed(1) + '%', change: { text: '', cls: '' } });
    }
    const totalMcap = g?.data?.total_market_cap?.usd;
    const totalChg = g?.data?.market_cap_change_percentage_24h_usd;
    if (totalMcap) {
      items.push({
        sym: 'TOTAL',
        value: '$' + (totalMcap / 1e12).toFixed(2) + 'T',
        change: fmtChange(totalChg)
      });
    }
  } catch {}

  // 3. FX via Frankfurter (banque centrale européenne) : EUR/USD, GBP/USD, USD/JPY, USD/CHF
  try {
    const fx = await fetchFrankfurter('USD', ['EUR', 'GBP', 'JPY', 'CHF']);
    if (fx?.rates) {
      // EUR/USD = 1 / (USD→EUR)
      if (fx.rates.EUR) items.push({ sym: 'EUR/USD', value: (1 / fx.rates.EUR).toFixed(4), change: { text: '', cls: '' } });
      if (fx.rates.GBP) items.push({ sym: 'GBP/USD', value: (1 / fx.rates.GBP).toFixed(4), change: { text: '', cls: '' } });
      if (fx.rates.JPY) items.push({ sym: 'USD/JPY', value: fx.rates.JPY.toFixed(2),       change: { text: '', cls: '' } });
      if (fx.rates.CHF) items.push({ sym: 'USD/CHF', value: fx.rates.CHF.toFixed(4),       change: { text: '', cls: '' } });
    }
  } catch {}

  if (!items.length) {
    renderTickerFallback(ticker);
    return;
  }

  // Doublé pour assurer une boucle fluide CSS
  const html = items.concat(items).map(it => {
    const chg = it.change?.text
      ? ` <span class="ticker-pct ${it.change.cls}">${it.change.text}</span>`
      : '';
    return `<span class="ticker-item"><span class="ticker-tk">${it.sym}</span> ${it.value}${chg}</span>`;
  }).join('');
  ticker.innerHTML = html;
}

function renderTickerFallback(ticker) {
  // Si toutes les API échouent (offline, rate-limit), on affiche un message neutre
  // plutôt que des chiffres faux. La page reste fonctionnelle.
  ticker.innerHTML = `
    <span class="ticker-item" style="color:var(--text-muted);">📡 Données marché temporairement indisponibles · réessai dans 90s</span>
  `;
}
