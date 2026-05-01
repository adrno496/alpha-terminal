// Chatbot widget : bouton flottant + panel chat persistant cross-page.
// Provider/model picker pour choisir l'IA. Streaming via orchestrator existant.
// Historique stocké en localStorage (cap 50 messages).

import { uuid } from '../core/utils.js';
import { isConnected, getOrchestrator, KNOWN_PROVIDERS, analyzeStream } from '../core/api.js';
import { getLocale } from '../core/i18n.js';
import { safeRender } from '../core/safe-render.js';

const HISTORY_KEY = 'alpha-terminal:chatbot:history';
const PROVIDER_KEY = 'alpha-terminal:chatbot:provider';
const TIER_KEY = 'alpha-terminal:chatbot:tier';
const OPEN_KEY = 'alpha-terminal:chatbot:open';
const HISTORY_CAP = 50;

const PROVIDER_META = Object.fromEntries(KNOWN_PROVIDERS.map(p => [p.name, p]));

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}
function setHistory(arr) {
  const trimmed = arr.slice(-HISTORY_CAP);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function isOpen() { return localStorage.getItem(OPEN_KEY) === '1'; }
function setOpen(v) { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); }

function getSelectedProvider() {
  return localStorage.getItem(PROVIDER_KEY) || 'auto';
}
function setSelectedProvider(p) {
  localStorage.setItem(PROVIDER_KEY, p);
}
function getSelectedTier() {
  return localStorage.getItem(TIER_KEY) || 'balanced';
}
function setSelectedTier(t) {
  localStorage.setItem(TIER_KEY, t);
}

let mounted = false;
let panelEl = null;
let bubbleEl = null;
let isStreaming = false;
let abortController = null;

const SYSTEM_PROMPT_FR = `Tu es l'assistant Alpha — copilote intégré à une app d'analyse financière BYOK pour particuliers.

# QU'EST-CE QU'Alpha ?
Une app d'analyse financière 100% client-side (rien ne quitte l'appareil de l'utilisateur), positionnée comme alternative grand public à Bloomberg Terminal. Modèle BYOK (Bring Your Own Key) : l'utilisateur configure ses propres clés API IA (Claude, OpenAI, Gemini, Grok, Mistral, Cerebras, etc.) et paie son provider directement au prix coûtant. L'app est proposée en abonnement mensuel à 9,99€/mois (annulable à tout moment) ou en accès à vie à 299€ (paiement unique, toutes mises à jour incluses).

# LES 40+ MODULES DISPONIBLES

**Toujours visible (essentiels) :**
- ⚡ Quick Analysis : verdict 30s sur un actif (BUY/HOLD/SELL + score + raisons)
- 💼 Patrimoine (Wealth) : tracker holdings multi-classes (actions, ETF, crypto, immo, AV, cash, bonds, or). Auto-refresh prix, snapshots, multi-prêts immo (16 types FR/EU/US/UK), export PDF, export JSON.
- 👁 Watchlist : brief 24h sur tickers suivis avec web search
- 📚 Knowledge Base (RAG) : indexer notes/PDFs persos, recherche sémantique

**Analyse fondamentale :**
- 🚀 Research Agent · 📑 10-K Decoder · 🧮 DCF/Fair Value · 📑 Investment Memo · 🔥 Pre-Mortem · 🔍 Stock Screener · 🔎 Portfolio Audit (Buffett-style)

**Macro & risques :**
- 🌍 Macro Dashboard · 💥 Stress Test (6 scénarios) · 💼 Portfolio Rebalancer · ⚔️ Battle Mode (2 actifs en 5 rounds)

**Crypto :**
- 🪙 Crypto Fundamental · ⚠️ Whitepaper Reader

**Sentiment & news :**
- 📡 Sentiment Tracker (Grok/Perplexity) · 🎙 Earnings Call · ✍️ Newsletter Investor (voice clone) · 🎙 YouTube + CEO Forensics

**Outils trader :**
- 🎯 Position Sizing (Kelly) · 📖 Trade Journal · 🔥 FIRE Calculator

**Fiscalité FR/Intl :**
- 🇫🇷 Tax Optimizer FR · 🌍 Tax International (8 pays)

**Finances perso (V7-V9) :**
- 💰 Budget mensuel (CRUD + projection 30 ans)
- 🔥 Frais cachés (impact TER/AV/courtage 30 ans + alternatives)
- 💸 Dividendes (calendrier annuel + yield on cost + couverture vie passive)
- 🎯 Score Diversification (HHI + secteurs + géo + classes)
- 📚 Méthode patrimoniale FR (24 règles + deep-dive IA)
- 📥 Import CSV bancaire (12 banques FR pré-configurées)
- ✨ Insights auto (alertes hebdo : milestones, concentration, fenêtres fiscales)
- 🚨 Alertes prix (extraites des transcripts YouTube ou manuelles, voyant rouge global)
- 🇫🇷 Simulateur IFI (barème 2024)
- 🎯 Objectifs financiers (FIRE, retraite, achat — progression vs patrimoine)
- 📈 Live Watcher (polling 30s + chart live)
- 🏦 Vue par compte bancaire
- 📊 Projection patrimoine (5/10/20/30 ans × 3 scénarios + inflation)

# FONCTIONNALITÉS CLÉS
- **BYOK multi-LLM** : 14 providers (Claude, OpenAI, Gemini, Grok, OpenRouter, Perplexity, Mistral, Cerebras, GitHub Models, NVIDIA, HuggingFace, Cloudflare, Together, Cohere) — smart router auto-sélectionne le meilleur par module
- **100% privé** : vault chiffré localStorage (AES-GCM 256 + PBKDF2 100k), aucun serveur Alpha
- **Backup .atb** : export/import complet du state local entre devices
- **Onboarding personnalisé** : questionnaire 5 étapes → modules recommandés ⭐
- **Mode Browse** : explorer l'app sans configurer de clé
- **Notifications natives** (Web + Capacitor Android)
- **Bilingue** FR + EN
- **Mobile** : Android natif via Capacitor

# COÛTS ESTIMÉS (BYOK, prix coûtant)
- Analyses légères (Quick Analysis, Position Sizing, Chatbot) : $0,001-$0,01
- Analyses moyennes (DCF, Macro, Crypto fond.) : $0,02-$0,10
- Analyses lourdes (10-K, Earnings, YouTube) : $0,10-$0,50
- Budget mensuel : $2-$8 (occasionnel) · $15-$40 (actif) · $50-$150 (power user)
- vs Bloomberg Terminal $24 000/an

# RÔLE DE L'ASSISTANT
1. Réponds aux questions sur le **fonctionnement de l'app** (où trouver tel module, comment configurer une clé, comment lire un résultat, quel module utiliser pour tel besoin).
2. Si la question demande une analyse spécifique (ex "analyse Apple"), **suggère le module pertinent** plutôt que de répondre directement (Quick Analysis, Research Agent, DCF, etc.).
3. Réponds aux questions générales finance/fiscalité FR (PEA, AV, PER, IFI, donations, etc.) si simple. Pour les cas complexes, recommande **Méthode patrimoniale** ou **Tax Optimizer FR** + un CGP.
4. **Ne jamais conseiller d'acheter/vendre un actif spécifique** sans warning sur les risques et la fiscalité.
5. Réponds en **français**, style direct, concret, professionnel. Format markdown court (pas de blabla).`;

const SYSTEM_PROMPT_EN = `You are the Alpha assistant — a copilot built into a BYOK financial analysis app for retail investors.

# WHAT IS Alpha?
A 100% client-side financial analysis app (nothing leaves the user's device), positioned as a retail-grade alternative to Bloomberg Terminal. BYOK model (Bring Your Own Key): the user configures their own AI keys (Claude, OpenAI, Gemini, Grok, Mistral, Cerebras, etc.) and pays their provider directly at cost. Pricing: monthly €9.99 (cancel anytime) or one-time €299 for lifetime access (all future updates included).

# THE 40+ MODULES

**Always visible (core):**
- ⚡ Quick Analysis: 30s verdict on an asset (BUY/HOLD/SELL + score + reasons)
- 💼 Wealth: holdings tracker across asset classes (stocks, ETFs, crypto, real estate, life-insurance, cash, bonds, gold). Live price refresh, snapshots, multi-loan real estate (16 FR/EU/US/UK loan types), PDF export, JSON export.
- 👁 Watchlist: 24h brief on tracked tickers with web search
- 📚 Knowledge Base (RAG): index personal notes/PDFs, semantic search

**Fundamental analysis:**
- 🚀 Research Agent · 📑 10-K Decoder · 🧮 DCF/Fair Value · 📑 Investment Memo · 🔥 Pre-Mortem · 🔍 Stock Screener · 🔎 Portfolio Audit (Buffett-style)

**Macro & risk:**
- 🌍 Macro Dashboard · 💥 Stress Test (6 scenarios) · 💼 Portfolio Rebalancer · ⚔️ Battle Mode (2 assets, 5 rounds)

**Crypto:**
- 🪙 Crypto Fundamental · ⚠️ Whitepaper Reader

**Sentiment & news:**
- 📡 Sentiment Tracker (Grok/Perplexity) · 🎙 Earnings Call · ✍️ Newsletter Investor (voice clone) · 🎙 YouTube + CEO Forensics

**Trader tools:**
- 🎯 Position Sizing (Kelly) · 📖 Trade Journal · 🔥 FIRE Calculator

**Tax FR/Intl:**
- 🇫🇷 Tax Optimizer FR · 🌍 Tax International (8 countries)

**Personal finance (V7-V9):**
- 💰 Monthly Budget · 🔥 Hidden Fees (TER/insurance/brokerage 30y impact) · 💸 Dividends (calendar + YoC + passive-life coverage) · 🎯 Diversification Score (HHI + sectors + geo + classes) · 📚 FR Wealth Method (24 rules + AI deep-dive) · 📥 Bank CSV Import · ✨ Auto Insights · 🚨 Price Alerts · 🇫🇷 IFI Simulator · 🎯 Financial Goals · 📈 Live Watcher (30s polling) · 🏦 Accounts View · 📊 Wealth Projection (5/10/20/30 years × 3 scenarios + inflation)

# KEY FEATURES
- **BYOK multi-LLM**: 14 providers, smart router auto-picks best per module
- **100% private**: encrypted vault (AES-GCM 256 + PBKDF2 100k), no Alpha server
- **Backup .atb**: full state export/import between devices
- **Personalized onboarding**: 5-step questionnaire → recommended modules ⭐
- **Browse mode**: explore the app without configuring keys
- **Native notifications** (Web + Capacitor Android)
- **Bilingual** FR + EN

# ESTIMATED COSTS (BYOK, at cost)
- Light analyses: $0.001-$0.01 · Mid: $0.02-$0.10 · Heavy: $0.10-$0.50
- Monthly budget: $2-$8 (casual) · $15-$40 (active) · $50-$150 (power user)
- vs Bloomberg Terminal $24,000/year

# ASSISTANT ROLE
1. Answer questions about **how the app works** (where to find a module, how to configure a key, how to read a result, which module to use for what need).
2. If the question asks for a specific analysis ("analyze Apple"), **suggest the relevant module** rather than answering directly.
3. Answer general FR-tax questions (PEA, life-insurance, PER, IFI, donations, etc.) if simple. For complex cases, recommend **Wealth Method** or **Tax Optimizer FR** + a CGP.
4. **Never recommend buying/selling** a specific asset without risk + tax warnings.
5. Reply in **English**, direct, concrete, professional tone. Short markdown.`;

export function mountChatbotWidget() {
  if (mounted) return;
  mounted = true;
  injectStyles();
  buildBubble();
  buildPanel();
  injectTopbarButton();
  if (isOpen()) togglePanel(true);
}

// Injecte un bouton 💬 dans la topbar (à gauche du status API).
// Permet d'ouvrir le chat directement depuis le header de chaque module.
export function injectTopbarButton() {
  const right = document.querySelector('.topbar-right');
  if (!right) return;
  if (right.querySelector('#cbw-topbar-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'cbw-topbar-btn';
  btn.className = 'cbw-topbar-btn';
  btn.title = getLocale() === 'en' ? 'Open assistant chat' : 'Ouvrir le chat assistant';
  btn.innerHTML = '💬 <span class="cbw-topbar-label">' + (getLocale() === 'en' ? 'Ask AI' : 'Demander') + '</span>';
  btn.addEventListener('click', () => togglePanel());
  right.insertBefore(btn, right.firstChild);
}

function injectStyles() {
  if (document.getElementById('chatbot-widget-styles')) return;
  const s = document.createElement('style');
  s.id = 'chatbot-widget-styles';
  s.textContent = `
    .cbw-bubble { position:fixed; bottom:18px; right:18px; z-index:9998; width:54px; height:54px; border-radius:50%; background:linear-gradient(135deg, #00ff88, #00cc6a); color:#000; border:0; cursor:pointer; box-shadow:0 4px 16px rgba(0,255,136,0.3); display:flex; align-items:center; justify-content:center; font-size:24px; transition:transform .15s; }
    .cbw-bubble:hover { transform:scale(1.08); }
    .cbw-bubble.has-unread::after { content:''; position:absolute; top:6px; right:6px; width:10px; height:10px; background:var(--accent-red); border-radius:50%; border:2px solid var(--bg-primary); }
    .cbw-panel { position:fixed; bottom:84px; right:18px; z-index:9998; width:380px; max-width:calc(100vw - 28px); height:540px; max-height:calc(100vh - 110px); background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; box-shadow:0 6px 22px rgba(0,0,0,0.4); display:flex; flex-direction:column; overflow:hidden; transform:translateY(20px); opacity:0; pointer-events:none; transition:transform .2s, opacity .2s; }
    .cbw-panel.open { transform:translateY(0); opacity:1; pointer-events:auto; }
    .cbw-header { padding:10px 12px; border-bottom:1px solid var(--border); background:var(--bg-tertiary); display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .cbw-header strong { font-size:13px; }
    .cbw-controls { display:flex; gap:4px; align-items:center; }
    .cbw-controls select { font-size:11px; padding:3px 6px; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border); border-radius:3px; }
    .cbw-controls button { background:transparent; border:0; color:var(--text-muted); cursor:pointer; padding:3px 6px; font-size:14px; }
    .cbw-controls button:hover { color:var(--text-primary); }
    .cbw-body { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px; font-size:12.5px; line-height:1.5; }
    .cbw-msg { padding:8px 10px; border-radius:8px; max-width:85%; word-break:break-word; }
    .cbw-msg.user { align-self:flex-end; background:#00ff88; color:#000; }
    .cbw-msg.assistant { align-self:flex-start; background:var(--bg-tertiary); color:var(--text-primary); }
    .cbw-msg .msg-meta { font-size:9.5px; color:var(--text-muted); margin-top:3px; }
    .cbw-msg.user .msg-meta { color:rgba(0,0,0,0.55); }
    .cbw-msg pre, .cbw-msg code { font-size:11px; }
    .cbw-msg p { margin:0 0 6px; }
    .cbw-empty { text-align:center; color:var(--text-muted); padding:24px 12px; font-size:12px; }
    .cbw-input-row { padding:8px; border-top:1px solid var(--border); display:flex; gap:6px; align-items:flex-end; }
    .cbw-input-row textarea { flex:1; resize:none; min-height:36px; max-height:120px; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border); border-radius:6px; padding:8px; font-size:12.5px; font-family:inherit; }
    .cbw-input-row button { padding:8px 12px; border:0; border-radius:6px; cursor:pointer; font-size:12.5px; font-weight:600; background:#00ff88; color:#000; }
    .cbw-input-row button:disabled { opacity:0.5; cursor:not-allowed; }
    .cbw-typing { font-size:11px; color:var(--text-muted); padding:0 10px 4px; font-style:italic; }
    .cbw-topbar-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:linear-gradient(135deg, #00ff88, #00cc6a); color:#000; border:0; border-radius:14px; font-size:12px; font-weight:600; cursor:pointer; margin-right:8px; box-shadow:0 1px 4px rgba(0,255,136,0.25); transition:transform .15s; }
    .cbw-topbar-btn:hover { transform:translateY(-1px); }
    .cbw-topbar-btn .cbw-topbar-label { font-family:var(--font-sans, inherit); }
    @media (max-width:768px) {
      .cbw-topbar-btn .cbw-topbar-label { display:none; }
      .cbw-topbar-btn { padding:6px 9px; }
    }
    @media (max-width:520px) {
      .cbw-panel { right:8px; left:8px; width:auto; height:75vh; bottom:80px; }
      .cbw-bubble { bottom:14px; right:14px; }
    }
  `;
  document.head.appendChild(s);
}

function buildBubble() {
  bubbleEl = document.createElement('button');
  bubbleEl.className = 'cbw-bubble';
  bubbleEl.title = getLocale() === 'en' ? 'Open assistant chat' : 'Ouvrir le chat assistant';
  bubbleEl.innerHTML = '💬';
  bubbleEl.addEventListener('click', () => togglePanel());
  document.body.appendChild(bubbleEl);
}

function buildPanel() {
  panelEl = document.createElement('div');
  panelEl.className = 'cbw-panel';
  panelEl.innerHTML = `
    <div class="cbw-header">
      <strong>💬 <span data-cbw-title></span></strong>
      <div class="cbw-controls">
        <select data-cbw-provider title="Provider"></select>
        <select data-cbw-tier title="Model tier">
          <option value="fast">⚡ fast</option>
          <option value="balanced" selected>⚖️ balanced</option>
          <option value="flagship">🏆 flagship</option>
        </select>
        <button data-cbw-clear title="${getLocale() === 'en' ? 'Clear' : 'Effacer'}">🗑</button>
        <button data-cbw-close title="${getLocale() === 'en' ? 'Close' : 'Fermer'}">×</button>
      </div>
    </div>
    <div class="cbw-body" data-cbw-body></div>
    <div class="cbw-typing" data-cbw-typing style="display:none;"></div>
    <div class="cbw-input-row">
      <textarea data-cbw-input rows="1" placeholder="${getLocale() === 'en' ? 'Ask me anything…' : 'Pose-moi une question…'}"></textarea>
      <button data-cbw-send>${getLocale() === 'en' ? 'Send' : 'Envoyer'}</button>
    </div>
  `;
  document.body.appendChild(panelEl);

  // Title
  panelEl.querySelector('[data-cbw-title]').textContent = getLocale() === 'en' ? 'ALPHA Assistant' : 'Assistant ALPHA';

  // Provider picker
  refreshProviderPicker();

  // Tier picker
  panelEl.querySelector('[data-cbw-tier]').value = getSelectedTier();
  panelEl.querySelector('[data-cbw-tier]').addEventListener('change', e => setSelectedTier(e.target.value));

  // Listeners
  panelEl.querySelector('[data-cbw-close]').addEventListener('click', () => togglePanel(false));
  panelEl.querySelector('[data-cbw-clear]').addEventListener('click', () => {
    if (!confirm(getLocale() === 'en' ? 'Clear chat history?' : 'Effacer l\'historique ?')) return;
    clearHistory();
    refreshMessages();
  });

  const input = panelEl.querySelector('[data-cbw-input]');
  const sendBtn = panelEl.querySelector('[data-cbw-send]');
  const onSend = () => {
    if (isStreaming) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    autoResize(input);
    sendMessage(text);
  };
  sendBtn.addEventListener('click', onSend);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });
  input.addEventListener('input', () => autoResize(input));

  // Re-render provider picker quand les clés changent
  window.addEventListener('app:locale-changed', () => {
    panelEl.querySelector('[data-cbw-title]').textContent = getLocale() === 'en' ? 'ALPHA Assistant' : 'Assistant ALPHA';
    panelEl.querySelector('[data-cbw-input]').placeholder = getLocale() === 'en' ? 'Ask me anything…' : 'Pose-moi une question…';
    panelEl.querySelector('[data-cbw-send]').textContent = getLocale() === 'en' ? 'Send' : 'Envoyer';
    refreshProviderPicker();
    refreshMessages();
    // Re-injecter le bouton topbar (le re-render de la topbar a pu le supprimer)
    setTimeout(() => injectTopbarButton(), 50);
  });

  refreshMessages();
}

function refreshProviderPicker() {
  const sel = panelEl.querySelector('[data-cbw-provider]');
  if (!sel) return;
  const isEN = getLocale() === 'en';
  let configured = [];
  if (isConnected()) {
    try { configured = getOrchestrator().getProviderNames(); } catch {}
  }
  const opts = [`<option value="auto" ${getSelectedProvider() === 'auto' ? 'selected' : ''}>${isEN ? 'Auto (smart)' : 'Auto (smart)'}</option>`];
  for (const name of configured) {
    const meta = PROVIDER_META[name];
    if (!meta) continue;
    opts.push(`<option value="${name}" ${getSelectedProvider() === name ? 'selected' : ''}>${meta.icon} ${meta.displayName}</option>`);
  }
  if (configured.length === 0) {
    opts.push(`<option disabled>${isEN ? '(no key configured)' : '(aucune clé configurée)'}</option>`);
  }
  sel.innerHTML = opts.join('');
  sel.value = getSelectedProvider();
  sel.onchange = (e) => setSelectedProvider(e.target.value);
}

function togglePanel(force) {
  const open = force === undefined ? !panelEl.classList.contains('open') : force;
  panelEl.classList.toggle('open', open);
  setOpen(open);
  if (open) {
    bubbleEl.classList.remove('has-unread');
    refreshProviderPicker();
    setTimeout(() => panelEl.querySelector('[data-cbw-input]')?.focus(), 100);
  }
}

function refreshMessages() {
  const body = panelEl.querySelector('[data-cbw-body]');
  if (!body) return;
  const history = getHistory();
  const isEN = getLocale() === 'en';
  if (history.length === 0) {
    body.innerHTML = `<div class="cbw-empty">${isEN ? '👋 Ask me about your wealth, fees, taxes, or any module of the app.' : '👋 Pose-moi une question sur ton patrimoine, tes frais, fiscalité, ou n\'importe quel module de l\'app.'}</div>`;
    return;
  }
  body.innerHTML = history.map(m => {
    const meta = m.role === 'assistant' && m.provider
      ? `<div class="msg-meta">${(PROVIDER_META[m.provider]?.icon || '·')} ${PROVIDER_META[m.provider]?.displayName || m.provider}${m.tier ? ' · ' + m.tier : ''}${m.cost ? ` · $${m.cost.toFixed(4)}` : ''}</div>`
      : '';
    const html = m.role === 'assistant' ? safeRender(m.content || '') : escape(m.content || '').replace(/\n/g, '<br>');
    return `<div class="cbw-msg ${m.role}">${html}${meta}</div>`;
  }).join('');
  body.scrollTop = body.scrollHeight;
}

async function sendMessage(text) {
  if (!isConnected()) {
    const isEN = getLocale() === 'en';
    const history = getHistory();
    history.push({ role: 'user', content: text, ts: Date.now() });
    history.push({
      role: 'assistant',
      content: isEN
        ? '🔑 No API key configured. Click the lock icon in the topbar or go to Settings to add one (Claude, OpenAI, Gemini, etc.).'
        : '🔑 Aucune clé API configurée. Clique sur l\'icône cadenas dans la topbar ou va dans Settings pour ajouter une clé (Claude, OpenAI, Gemini, etc.).',
      ts: Date.now()
    });
    setHistory(history);
    refreshMessages();
    return;
  }

  const history = getHistory();
  history.push({ role: 'user', content: text, ts: Date.now() });
  setHistory(history);
  refreshMessages();

  isStreaming = true;
  const sendBtn = panelEl.querySelector('[data-cbw-send]');
  const typingEl = panelEl.querySelector('[data-cbw-typing]');
  if (sendBtn) sendBtn.disabled = true;
  if (typingEl) { typingEl.style.display = ''; typingEl.textContent = getLocale() === 'en' ? '✦ Thinking…' : '✦ Réflexion…'; }

  // Construit le contexte messages : on garde les 10 derniers pour limiter les tokens
  const recentHistory = history.slice(-11, -1).map(m => ({ role: m.role, content: m.content }));
  const messages = [...recentHistory, { role: 'user', content: text }];

  // Override provider/model selon le picker
  const providerSel = getSelectedProvider();
  const tier = getSelectedTier();
  const override = {
    tier,
    ...(providerSel !== 'auto' ? { provider: providerSel } : {})
  };

  // Placeholder message assistant en cours de stream
  const assistantMsg = { role: 'assistant', content: '', ts: Date.now(), provider: null, tier, cost: 0 };
  history.push(assistantMsg);

  try {
    const isEN = getLocale() === 'en';
    let chosenProvider = null;
    let chosenModel = null;
    const result = await analyzeStream('chatbot', {
      system: isEN ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_FR,
      messages,
      override,
      maxTokens: 1500
    }, {
      onSelected: (sel) => {
        chosenProvider = sel.provider.name;
        chosenModel = sel.model;
        assistantMsg.provider = chosenProvider;
        if (typingEl) typingEl.textContent = `✦ ${PROVIDER_META[chosenProvider]?.displayName || chosenProvider} · ${sel.tier}`;
      },
      onDelta: (delta) => {
        assistantMsg.content += delta;
        // Re-render seulement le dernier message pour perf
        const body = panelEl.querySelector('[data-cbw-body]');
        if (body) {
          // Naive re-render
          refreshMessages();
        }
      }
    });
    // Stocke le coût si dispo (result.costUSD ou result.usage?.costUSD selon provider)
    const cost = result?.costUSD || result?.usage?.costUSD || 0;
    if (cost) assistantMsg.cost = cost;
    // Si onDelta n'a rien streamé (rare), récupère depuis result.text
    if (!assistantMsg.content && result?.text) assistantMsg.content = result.text;
    setHistory(history);
    refreshMessages();
    if (!isOpen()) bubbleEl.classList.add('has-unread');
  } catch (e) {
    console.error('[chatbot]', e);
    assistantMsg.content = (getLocale() === 'en' ? '❌ Error: ' : '❌ Erreur : ') + (e?.message || 'unknown');
    setHistory(history);
    refreshMessages();
  } finally {
    isStreaming = false;
    if (sendBtn) sendBtn.disabled = false;
    if (typingEl) typingEl.style.display = 'none';
  }
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(120, textarea.scrollHeight) + 'px';
}

function escape(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}
