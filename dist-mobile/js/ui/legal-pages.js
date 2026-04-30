// Legal pages : Privacy Policy, Terms of Service, Legal Notice, About.
// Required for Google Play Store submission. Content is FR/EN aware.
// Displayed via the existing showGenericModal helper.

import { showGenericModal } from './modal.js';
import { getLocale } from '../core/i18n.js';

const PUBLISHER = {
  name: 'Axel Dreano',
  email: 'savetheworldfr@gmail.com',
  country: 'France',
  appName: 'Alpha',
  version: '2.1.0'
};

const LAST_UPDATED = '2026-04-29';

// ============== ABOUT ==============

const ABOUT_FR = `
<h2>À propos d'Alpha</h2>

<p><strong>Alpha</strong> est un terminal d'analyse financière de niveau institutionnel,
100% client-side, sans abonnement, conçu pour les investisseurs particuliers et professionnels
qui veulent garder le contrôle de leurs données et de leurs coûts.</p>

<h3>📊 26 modules d'analyse</h3>
<ul>
  <li><strong>Décision rapide :</strong> Quick Analysis (verdict 30s), Watchlist + Brief quotidien.</li>
  <li><strong>Analyse fondamentale :</strong> 10-K Decoder, DCF, Investment Memo, Pre-Mortem, Stock Screener, Research Agent, Portfolio Audit (Buffett-style).</li>
  <li><strong>Macro & risques :</strong> Macro Dashboard, Stress Test (6 régimes extrêmes), Battle Mode, Portfolio Rebalancer.</li>
  <li><strong>Crypto :</strong> Crypto Fundamental, Whitepaper Reader (anti-scam scan).</li>
  <li><strong>Sentiment :</strong> Sentiment Tracker (web search contrarian), Earnings Call Forensics, YouTube Transcript + CEO Forensics, Newsletter générée dans ta voix.</li>
  <li><strong>Outils :</strong> Position Sizing (Kelly), Trade Journal, FIRE Calculator.</li>
  <li><strong>Fiscalité :</strong> Tax Optimizer FR + International (USA, UK, BE, CH, ES, DE, IT, PT).</li>
  <li><strong>Mémoire :</strong> Patrimoine (auto-injecté), Knowledge Base RAG (embeddings).</li>
</ul>

<h3>🤖 14 providers LLM</h3>
<p>Anthropic Claude, OpenAI ChatGPT, Google Gemini, xAI Grok, OpenRouter, Perplexity,
Mistral AI, Cerebras, GitHub Models, NVIDIA NIM, Hugging Face, Cloudflare Workers AI,
Together AI, Cohere. Une seule clé suffit pour démarrer ; le smart router sélectionne
le meilleur modèle pour chaque module.</p>

<h3>📡 11 fournisseurs de données</h3>
<p>FMP, Alpha Vantage, Polygon, Finnhub, Tiingo, Twelve Data, FRED (macro), Etherscan,
CoinGecko, DefiLlama, SEC EDGAR, Frankfurter (FX). Optionnels : enrichissent les analyses
sans changer le coût LLM.</p>

<h3>🔒 Privacy by design</h3>
<ul>
  <li>100% client-side. Aucun serveur Alpha.</li>
  <li>Vault chiffré localement (AES-GCM 256 bits + PBKDF2 100K iterations).</li>
  <li>Stockage IndexedDB (analyses, patrimoine, transcripts, KB).</li>
  <li>BYOK (Bring Your Own Key) — tu paies les providers directement.</li>
</ul>

<h3>📱 Multi-plateforme</h3>
<p>Web (PWA), Desktop (Electron .dmg / .exe), Mobile (Capacitor 8 — Android & iOS).</p>

<h3>👤 Auteur</h3>
<p>${PUBLISHER.name} · <a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a> · Made in ${PUBLISHER.country} 🇫🇷</p>

<p style="color:var(--text-muted);font-size:11.5px;margin-top:18px;">Version ${PUBLISHER.version} · Dernière mise à jour : ${LAST_UPDATED}</p>
`;

const ABOUT_EN = `
<h2>About Alpha</h2>

<p><strong>Alpha</strong> is an institutional-grade financial analysis terminal,
100% client-side, no subscription, built for retail and pro investors who want to keep
control of their data and costs.</p>

<h3>📊 26 analysis modules</h3>
<ul>
  <li><strong>Fast decision:</strong> Quick Analysis (30s verdict), Watchlist + Daily Brief.</li>
  <li><strong>Fundamental:</strong> 10-K Decoder, DCF, Investment Memo, Pre-Mortem, Stock Screener, Research Agent, Portfolio Audit (Buffett-style).</li>
  <li><strong>Macro & risk:</strong> Macro Dashboard, Stress Test (6 extreme regimes), Battle Mode, Portfolio Rebalancer.</li>
  <li><strong>Crypto:</strong> Crypto Fundamental, Whitepaper Reader (anti-scam scan).</li>
  <li><strong>Sentiment:</strong> Sentiment Tracker (contrarian web search), Earnings Call Forensics, YouTube Transcript + CEO Forensics, Newsletter generated in your voice.</li>
  <li><strong>Tools:</strong> Position Sizing (Kelly), Trade Journal, FIRE Calculator.</li>
  <li><strong>Tax:</strong> Tax Optimizer FR + International (USA, UK, BE, CH, ES, DE, IT, PT).</li>
  <li><strong>Memory:</strong> Wealth (auto-injected), Knowledge Base RAG (embeddings).</li>
</ul>

<h3>🤖 14 LLM providers</h3>
<p>Anthropic Claude, OpenAI ChatGPT, Google Gemini, xAI Grok, OpenRouter, Perplexity,
Mistral AI, Cerebras, GitHub Models, NVIDIA NIM, Hugging Face, Cloudflare Workers AI,
Together AI, Cohere. One key is enough; the smart router picks the best model per module.</p>

<h3>📡 11 data providers</h3>
<p>FMP, Alpha Vantage, Polygon, Finnhub, Tiingo, Twelve Data, FRED, Etherscan, CoinGecko,
DefiLlama, SEC EDGAR, Frankfurter (FX). Optional: enrich analyses without extra LLM cost.</p>

<h3>🔒 Privacy by design</h3>
<ul>
  <li>100% client-side. No Alpha server.</li>
  <li>Locally encrypted vault (AES-GCM 256-bit + PBKDF2 100K iterations).</li>
  <li>IndexedDB storage (analyses, wealth, transcripts, KB).</li>
  <li>BYOK (Bring Your Own Key) — you pay providers directly.</li>
</ul>

<h3>📱 Multi-platform</h3>
<p>Web (PWA), Desktop (Electron .dmg / .exe), Mobile (Capacitor 8 — Android & iOS).</p>

<h3>👤 Author</h3>
<p>${PUBLISHER.name} · <a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a> · Made in ${PUBLISHER.country} 🇫🇷</p>

<p style="color:var(--text-muted);font-size:11.5px;margin-top:18px;">Version ${PUBLISHER.version} · Last updated: ${LAST_UPDATED}</p>
`;

// ============== PRIVACY POLICY ==============

const PRIVACY_FR = `
<h2>Politique de confidentialité</h2>
<p style="color:var(--text-muted);font-size:12px;">Dernière mise à jour : ${LAST_UPDATED}</p>

<h3>1. Principe fondamental</h3>
<p><strong>${PUBLISHER.appName} est une application 100% client-side.</strong> Aucune donnée
n'est envoyée vers un serveur contrôlé par l'éditeur. L'application fonctionne entièrement
dans votre navigateur (web), votre application Electron (desktop) ou votre application
Capacitor (mobile).</p>

<h3>2. Données traitées</h3>
<h4>2.1 Données stockées localement</h4>
<ul>
  <li><strong>Clés API</strong> que vous fournissez (Claude, OpenAI, Gemini, etc.) :
  chiffrées localement avec AES-GCM 256 bits, dérivation PBKDF2 100 000 itérations à
  partir de votre mot de passe local. <strong>Le mot de passe n'est jamais transmis.</strong></li>
  <li><strong>Vos analyses</strong> (résultats des modules) : stockées dans IndexedDB
  (base de données locale du navigateur).</li>
  <li><strong>Patrimoine</strong> : holdings, snapshots historiques, prix.</li>
  <li><strong>Knowledge Base</strong> : notes/PDFs que vous avez vous-même indexés.</li>
  <li><strong>Transcripts</strong> : transcripts d'earnings calls ou vidéos que vous avez analysés.</li>
  <li><strong>Préférences</strong> : langue, thème, modules favoris (localStorage).</li>
</ul>

<h4>2.2 Données envoyées aux fournisseurs tiers (avec votre consentement)</h4>
<p>Quand vous utilisez un module, votre prompt et vos documents sont envoyés
<strong>directement</strong> de votre appareil vers le fournisseur LLM dont vous avez fourni
la clé (Anthropic, OpenAI, Google, xAI, etc.). Ces flux ne transitent jamais par un
serveur Alpha.</p>

<p>De même, si vous avez fourni des clés pour les fournisseurs de données (FMP, Polygon, etc.),
des requêtes leur sont envoyées directement pour récupérer prix, fondamentaux, news.</p>

<p>Chaque fournisseur tiers a sa propre politique de confidentialité. Nous vous invitons
à les consulter :</p>
<ul style="font-size:12px;">
  <li><a href="https://www.anthropic.com/privacy" target="_blank">Anthropic</a></li>
  <li><a href="https://openai.com/policies/privacy-policy" target="_blank">OpenAI</a></li>
  <li><a href="https://policies.google.com/privacy" target="_blank">Google</a></li>
  <li><a href="https://x.ai/legal/privacy-policy" target="_blank">xAI</a></li>
  <li><a href="https://openrouter.ai/privacy" target="_blank">OpenRouter</a></li>
  <li><a href="https://www.perplexity.ai/hub/legal/privacy-policy" target="_blank">Perplexity</a></li>
  <li><a href="https://mistral.ai/terms" target="_blank">Mistral AI</a></li>
  <li><a href="https://www.cerebras.ai/privacy-policy/" target="_blank">Cerebras</a></li>
  <li><a href="https://huggingface.co/privacy" target="_blank">Hugging Face</a></li>
  <li><a href="https://www.cloudflare.com/privacypolicy/" target="_blank">Cloudflare</a></li>
  <li><a href="https://www.together.ai/privacy" target="_blank">Together AI</a></li>
  <li><a href="https://cohere.com/privacy" target="_blank">Cohere</a></li>
  <li><a href="https://docs.github.com/en/site-policy/privacy-policies" target="_blank">GitHub</a></li>
</ul>

<h3>3. Aucune collecte par l'éditeur</h3>
<p>L'éditeur de ${PUBLISHER.appName} :</p>
<ul>
  <li><strong>Ne collecte aucune donnée personnelle.</strong></li>
  <li><strong>Ne dispose d'aucun serveur</strong> recevant vos données ou vos analyses.</li>
  <li><strong>N'a pas accès à vos clés API ni à vos analyses.</strong></li>
  <li><strong>N'utilise aucun outil d'analytics</strong> (Google Analytics, Mixpanel, etc.).</li>
  <li><strong>N'utilise aucun cookie de tracking.</strong></li>
</ul>

<h3>4. Cookies et stockage local</h3>
<p>L'application utilise uniquement les mécanismes de stockage local de votre navigateur
(localStorage et IndexedDB). Aucun cookie tiers, aucun cookie de tracking. Vous pouvez
effacer ces données à tout moment via les paramètres de votre navigateur.</p>

<h3>5. Vos droits (RGPD)</h3>
<p>Étant donné qu'aucune donnée n'est collectée par l'éditeur, les droits d'accès, de
rectification, d'effacement, de portabilité s'exercent directement sur votre appareil :</p>
<ul>
  <li><strong>Accès :</strong> tous vos données sont visibles dans l'app (Historique, Patrimoine, KB).</li>
  <li><strong>Effacement :</strong> Settings → Avancé → "Effacer l'historique" / "Reset vault".</li>
  <li><strong>Portabilité :</strong> chaque analyse est exportable en .md / PDF.</li>
</ul>
<p>Pour les données envoyées aux fournisseurs LLM, exercez vos droits directement auprès
d'eux selon leurs politiques respectives.</p>

<h3>6. Sécurité</h3>
<p>Chiffrement AES-GCM 256 bits avec dérivation PBKDF2 100 000 itérations pour les clés API.
Les analyses ne sont pas chiffrées au repos (IndexedDB) — si votre appareil est compromis,
elles peuvent être lues. Si vous traitez des données sensibles, utilisez le chiffrement
disque de votre OS (FileVault, BitLocker) en complément.</p>

<h3>7. Mineurs</h3>
<p>L'application n'est pas destinée aux mineurs de moins de 16 ans. Si vous êtes
mineur, demandez l'autorisation d'un parent / tuteur avant de saisir vos clés API.</p>

<h3>8. Modifications</h3>
<p>Cette politique peut évoluer. Toute modification sera publiée dans cette page avec
une nouvelle date de mise à jour.</p>

<h3>9. Contact</h3>
<p>Pour toute question : <a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a></p>
`;

const PRIVACY_EN = `
<h2>Privacy Policy</h2>
<p style="color:var(--text-muted);font-size:12px;">Last updated: ${LAST_UPDATED}</p>

<h3>1. Core principle</h3>
<p><strong>${PUBLISHER.appName} is a 100% client-side application.</strong> No data is sent
to a server controlled by the publisher. The app runs entirely in your browser (web),
Electron app (desktop), or Capacitor app (mobile).</p>

<h3>2. Data processed</h3>
<h4>2.1 Locally stored data</h4>
<ul>
  <li><strong>API keys</strong> you provide: encrypted locally with AES-GCM 256-bit,
  PBKDF2 derivation (100,000 iterations) from your local password. <strong>The password
  is never transmitted.</strong></li>
  <li><strong>Your analyses</strong> (module results): stored in IndexedDB (browser local DB).</li>
  <li><strong>Wealth</strong>: holdings, historical snapshots, prices.</li>
  <li><strong>Knowledge Base</strong>: notes/PDFs you indexed yourself.</li>
  <li><strong>Transcripts</strong>: earnings call / video transcripts you analyzed.</li>
  <li><strong>Preferences</strong>: language, theme, favorite modules (localStorage).</li>
</ul>

<h4>2.2 Data sent to third parties (with your consent)</h4>
<p>When you use a module, your prompt and documents are sent <strong>directly</strong>
from your device to the LLM provider whose key you provided (Anthropic, OpenAI, Google, etc.).
These flows never go through any Alpha server.</p>

<p>Likewise, if you provided keys for data providers (FMP, Polygon, etc.), requests are
sent directly to them for prices, fundamentals, news.</p>

<p>Each third-party has its own privacy policy. Please consult them.</p>

<h3>3. No collection by publisher</h3>
<p>The ${PUBLISHER.appName} publisher:</p>
<ul>
  <li><strong>Collects no personal data.</strong></li>
  <li><strong>Operates no server</strong> receiving your data or analyses.</li>
  <li><strong>Has no access to your API keys or analyses.</strong></li>
  <li><strong>Uses no analytics tool</strong> (Google Analytics, Mixpanel, etc.).</li>
  <li><strong>Uses no tracking cookie.</strong></li>
</ul>

<h3>4. Cookies and local storage</h3>
<p>The app uses only your browser's local storage mechanisms (localStorage, IndexedDB).
No third-party cookie, no tracking cookie. You can clear these at any time via your
browser settings.</p>

<h3>5. Your rights (GDPR)</h3>
<p>Since no data is collected by the publisher, access, rectification, erasure and
portability rights are exercised directly on your device:</p>
<ul>
  <li><strong>Access:</strong> all your data is visible in the app (History, Wealth, KB).</li>
  <li><strong>Erasure:</strong> Settings → Advanced → "Clear history" / "Reset vault".</li>
  <li><strong>Portability:</strong> each analysis exports as .md / PDF.</li>
</ul>
<p>For data sent to LLM providers, exercise your rights directly with them per their policies.</p>

<h3>6. Security</h3>
<p>AES-GCM 256-bit encryption with PBKDF2 100K iterations for API keys. Analyses are
not encrypted at rest (IndexedDB) — if your device is compromised, they can be read.
Use full-disk encryption (FileVault, BitLocker) if you handle sensitive data.</p>

<h3>7. Minors</h3>
<p>The app is not intended for users under 16. If you are a minor, ask a parent/guardian
before entering your API keys.</p>

<h3>8. Changes</h3>
<p>This policy may evolve. Any change will be published on this page with a new updated date.</p>

<h3>9. Contact</h3>
<p>For any question: <a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a></p>
`;

// ============== TERMS OF SERVICE ==============

const TERMS_FR = `
<h2>Conditions Générales d'Utilisation</h2>
<p style="color:var(--text-muted);font-size:12px;">Dernière mise à jour : ${LAST_UPDATED}</p>

<h3>1. Objet</h3>
<p>Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de
${PUBLISHER.appName} (ci-après "l'Application"), édité par ${PUBLISHER.name}.</p>

<h3>2. Acceptation</h3>
<p>L'utilisation de l'Application implique l'acceptation pleine et entière des présentes
CGU. Si vous n'acceptez pas, n'utilisez pas l'Application.</p>

<h3>3. Description du service</h3>
<p>L'Application est un terminal d'analyse financière qui agrège plusieurs API tierces
(LLM et données financières) pour produire des analyses, valorisations, audits et
résumés sur les marchés financiers, sur la base des inputs fournis par l'utilisateur
et de sa propre clé API ("BYOK").</p>

<h3>4. Avertissement — PAS DE CONSEIL EN INVESTISSEMENT</h3>
<p style="background:var(--bg-tertiary);padding:12px;border-radius:4px;border-left:3px solid var(--accent-amber);">
<strong>⚠️ L'Application est un OUTIL ÉDUCATIF et d'AIDE À L'ANALYSE.</strong> Elle ne fournit
<strong>en aucun cas</strong> :
</p>
<ul>
  <li>Un conseil en investissement au sens de la directive MiF II / règlement européen.</li>
  <li>Une recommandation personnalisée d'achat ou de vente de valeurs mobilières.</li>
  <li>Un conseil fiscal, juridique ou comptable.</li>
  <li>Une garantie sur la performance future d'un actif financier.</li>
</ul>
<p>Les analyses générées par l'IA peuvent contenir des erreurs, des biais, des hallucinations
ou des informations obsolètes. <strong>Toute décision d'investissement reste sous votre
seule responsabilité.</strong> Vous êtes encouragé à consulter un conseiller en investissement
financier (CIF) agréé AMF ou équivalent dans votre juridiction.</p>

<h3>5. BYOK et coûts</h3>
<p>L'Application fonctionne uniquement avec vos propres clés API auprès des fournisseurs
tiers. Les frais facturés par ces fournisseurs (Anthropic, OpenAI, etc.) vous sont
directement imputés et ne sont pas perçus par l'éditeur. Vous êtes responsable du suivi
de votre consommation.</p>

<h3>6. Risque financier</h3>
<p>Investir comporte des risques. Vous pouvez perdre tout ou partie du capital investi.
Les performances passées ne préjugent pas des performances futures. Les calculs DCF,
audit, stress-test produits par l'Application sont des estimations basées sur des
hypothèses fournies par vous et ne constituent pas une garantie.</p>

<h3>7. Propriété intellectuelle</h3>
<p>Le code source, les prompts système, les designs sont la propriété de ${PUBLISHER.name}.
Une licence d'utilisation personnelle vous est accordée. Toute redistribution, revente,
ingénierie inverse ou usage commercial sans autorisation écrite est interdit.</p>

<h3>8. Données utilisateur</h3>
<p>Vos données restent sur votre appareil. Voir la <strong>Politique de confidentialité</strong>
pour le détail.</p>

<h3>9. Limitation de responsabilité</h3>
<p>Dans la limite autorisée par la loi, l'éditeur ne peut être tenu responsable :</p>
<ul>
  <li>De pertes financières liées à l'utilisation des analyses produites.</li>
  <li>D'erreurs d'analyse, hallucinations LLM, ou informations inexactes.</li>
  <li>De l'indisponibilité ou des changements de prix des fournisseurs tiers.</li>
  <li>De la perte de données locales (sauvegardez régulièrement).</li>
  <li>De l'utilisation frauduleuse de vos clés API par un tiers ayant accès à votre appareil.</li>
</ul>

<h3>10. Disponibilité</h3>
<p>L'Application est fournie "telle quelle". L'éditeur ne garantit pas l'absence de bugs,
la disponibilité continue, ni la compatibilité future avec les évolutions des API tierces.</p>

<h3>11. Modifications</h3>
<p>Les CGU peuvent évoluer. La version en vigueur est celle publiée dans l'Application.</p>

<h3>12. Droit applicable</h3>
<p>Les présentes CGU sont soumises au droit français. Tout litige relèvera de la
compétence des tribunaux français, sous réserve de dispositions impératives du droit
de la consommation applicable au consommateur.</p>

<h3>13. Contact</h3>
<p><a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a></p>
`;

const TERMS_EN = `
<h2>Terms of Service</h2>
<p style="color:var(--text-muted);font-size:12px;">Last updated: ${LAST_UPDATED}</p>

<h3>1. Purpose</h3>
<p>These Terms of Service govern your use of ${PUBLISHER.appName} (the "App"), published
by ${PUBLISHER.name}.</p>

<h3>2. Acceptance</h3>
<p>Using the App means you fully accept these Terms. If you don't accept, don't use the App.</p>

<h3>3. Service description</h3>
<p>The App is a financial analysis terminal that aggregates multiple third-party APIs
(LLM and financial data) to produce analyses, valuations, audits, and summaries on
financial markets, based on inputs you provide and your own API key ("BYOK").</p>

<h3>4. Disclaimer — NOT INVESTMENT ADVICE</h3>
<p style="background:var(--bg-tertiary);padding:12px;border-radius:4px;border-left:3px solid var(--accent-amber);">
<strong>⚠️ The App is an EDUCATIONAL and ANALYSIS-ASSIST tool.</strong> It does
<strong>NOT</strong> provide:
</p>
<ul>
  <li>Investment advice within the meaning of MiFID II / EU regulation or any equivalent.</li>
  <li>Personalized buy/sell recommendations on securities.</li>
  <li>Tax, legal, or accounting advice.</li>
  <li>Any guarantee on the future performance of any financial asset.</li>
</ul>
<p>AI-generated analyses may contain errors, biases, hallucinations, or outdated information.
<strong>All investment decisions are your sole responsibility.</strong> You are encouraged
to consult a licensed investment advisor in your jurisdiction.</p>

<h3>5. BYOK and costs</h3>
<p>The App works only with your own API keys at third-party providers. Fees charged by
those providers are billed directly to you and not collected by the publisher.</p>

<h3>6. Financial risk</h3>
<p>Investing involves risk. You may lose all or part of the capital invested. Past
performance does not guarantee future results. DCF, audit, stress-test computations
produced by the App are estimates based on assumptions you provide and constitute no
guarantee.</p>

<h3>7. Intellectual property</h3>
<p>Source code, system prompts, designs are the property of ${PUBLISHER.name}. A personal
use license is granted to you. Redistribution, resale, reverse engineering, or commercial
use without written authorization is prohibited.</p>

<h3>8. User data</h3>
<p>Your data stays on your device. See the <strong>Privacy Policy</strong> for details.</p>

<h3>9. Limitation of liability</h3>
<p>To the extent allowed by law, the publisher is not liable for:</p>
<ul>
  <li>Financial losses tied to using the analyses produced.</li>
  <li>Analysis errors, LLM hallucinations, or inaccurate information.</li>
  <li>Third-party provider unavailability or pricing changes.</li>
  <li>Local data loss (back up regularly).</li>
  <li>Fraudulent use of your API keys by a third party with device access.</li>
</ul>

<h3>10. Availability</h3>
<p>The App is provided "as is". The publisher does not guarantee bug-free operation,
continuous availability, or future compatibility with third-party API changes.</p>

<h3>11. Changes</h3>
<p>Terms may evolve. The version in force is the one published in the App.</p>

<h3>12. Governing law</h3>
<p>These Terms are governed by French law. Any dispute falls under French courts,
subject to mandatory consumer protection law in your jurisdiction.</p>

<h3>13. Contact</h3>
<p><a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a></p>
`;

// ============== LEGAL NOTICE (Mentions Légales) ==============

const LEGAL_FR = `
<h2>Mentions Légales</h2>
<p style="color:var(--text-muted);font-size:12px;">Dernière mise à jour : ${LAST_UPDATED}</p>

<h3>Éditeur de l'application</h3>
<p>
<strong>${PUBLISHER.name}</strong><br>
Particulier — Auto-publication<br>
Pays : ${PUBLISHER.country}<br>
Email : <a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a>
</p>

<h3>Directeur de la publication</h3>
<p>${PUBLISHER.name}</p>

<h3>Application</h3>
<ul>
  <li><strong>Nom :</strong> ${PUBLISHER.appName}</li>
  <li><strong>Version :</strong> ${PUBLISHER.version}</li>
  <li><strong>Description :</strong> Terminal d'analyse financière 100% client-side, BYOK.</li>
  <li><strong>Distribution :</strong> Web (PWA), Desktop (.dmg / .exe), Mobile (Google Play / App Store).</li>
</ul>

<h3>Hébergement</h3>
<p>L'application est une application client-side. Le code statique (HTML / CSS / JS) est
hébergé sur la plateforme de distribution choisie par l'utilisateur (téléchargement
direct, GitHub Pages, ou store mobile). Aucun serveur backend n'est opéré par l'éditeur.</p>

<h3>Propriété intellectuelle</h3>
<p>L'ensemble des éléments accessibles dans l'Application (code, design, prompts système,
textes, marque "Alpha") sont protégés par le droit d'auteur français et les
conventions internationales. Toute reproduction, représentation, modification, exploitation
non autorisée est interdite et constitue une contrefaçon sanctionnée par les articles
L335-2 et suivants du Code de la propriété intellectuelle.</p>

<h3>Marques tierces</h3>
<p>Les noms et logos d'Anthropic, OpenAI, Google, xAI, Mistral, Cerebras, NVIDIA,
Hugging Face, Cloudflare, Bloomberg, Koyfin, etc. sont la propriété de leurs détenteurs
respectifs. Leur mention dans l'Application est faite à titre informatif (interopérabilité,
comparaison) et ne constitue pas un partenariat ou une affiliation.</p>

<h3>Liens externes</h3>
<p>L'Application peut contenir des liens vers des sites tiers (consoles API, documentation
des fournisseurs). L'éditeur n'a aucun contrôle sur le contenu de ces sites et décline
toute responsabilité quant à leur contenu, fonctionnement et politique de confidentialité.</p>

<h3>Conformité RGPD</h3>
<p>Voir la <strong>Politique de confidentialité</strong>. L'Application n'effectue aucune
collecte de données personnelles côté éditeur. Le traitement de vos données s'opère
exclusivement sur votre appareil.</p>

<h3>Médiation à la consommation</h3>
<p>Conformément à l'article L612-1 du Code de la consommation, en cas de litige non
résolu à l'amiable, le consommateur peut recourir gratuitement à un médiateur de la
consommation. Contact préalable obligatoire :
<a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a>.</p>

<h3>Plateforme européenne de règlement en ligne</h3>
<p>La Commission européenne met à disposition une plateforme de règlement en ligne :
<a href="https://ec.europa.eu/consumers/odr" target="_blank">https://ec.europa.eu/consumers/odr</a></p>

<h3>Crédits</h3>
<p>Bibliothèques tierces utilisées (CDN) : Marked.js (markdown), PDF.js (parsing PDF),
Chart.js (graphiques). Toutes ces bibliothèques sont sous licences open-source compatibles
(MIT / Apache 2.0).</p>

<h3>Contact</h3>
<p><a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a></p>
`;

const LEGAL_EN = `
<h2>Legal Notice</h2>
<p style="color:var(--text-muted);font-size:12px;">Last updated: ${LAST_UPDATED}</p>

<h3>Publisher</h3>
<p>
<strong>${PUBLISHER.name}</strong><br>
Individual — Self-publishing<br>
Country: ${PUBLISHER.country}<br>
Email: <a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a>
</p>

<h3>Publication director</h3>
<p>${PUBLISHER.name}</p>

<h3>Application</h3>
<ul>
  <li><strong>Name:</strong> ${PUBLISHER.appName}</li>
  <li><strong>Version:</strong> ${PUBLISHER.version}</li>
  <li><strong>Description:</strong> 100% client-side financial analysis terminal, BYOK.</li>
  <li><strong>Distribution:</strong> Web (PWA), Desktop (.dmg / .exe), Mobile (Google Play / App Store).</li>
</ul>

<h3>Hosting</h3>
<p>The app is client-side. Static code (HTML/CSS/JS) is hosted by the distribution
platform of the user's choice (direct download, GitHub Pages, or mobile store).
No backend server is operated by the publisher.</p>

<h3>Intellectual property</h3>
<p>All elements in the app (code, design, system prompts, texts, "Alpha" brand)
are protected by French copyright law and international conventions. Any unauthorized
reproduction, representation, modification, or exploitation is prohibited.</p>

<h3>Third-party trademarks</h3>
<p>Names and logos of Anthropic, OpenAI, Google, xAI, Mistral, Cerebras, NVIDIA,
Hugging Face, Cloudflare, Bloomberg, Koyfin, etc. are the property of their respective
owners. Their mention in the app is informational (interoperability, comparison) and
does not constitute partnership or affiliation.</p>

<h3>External links</h3>
<p>The App may contain links to third-party sites (provider API consoles, docs).
The publisher has no control over those sites and declines any responsibility for
their content, operation, and privacy policies.</p>

<h3>GDPR compliance</h3>
<p>See the <strong>Privacy Policy</strong>. The App performs no personal data collection
on the publisher side. Your data processing happens exclusively on your device.</p>

<h3>Consumer dispute resolution</h3>
<p>In case of unresolved dispute, you may use the EU online dispute resolution platform:
<a href="https://ec.europa.eu/consumers/odr" target="_blank">https://ec.europa.eu/consumers/odr</a></p>

<h3>Credits</h3>
<p>Third-party libraries (CDN): Marked.js (markdown), PDF.js (PDF parsing), Chart.js
(charts). All under compatible open-source licenses (MIT / Apache 2.0).</p>

<h3>Contact</h3>
<p><a href="mailto:${PUBLISHER.email}">${PUBLISHER.email}</a></p>
`;

// ============== Renderer ==============

const TITLES = {
  fr: { about: 'À propos', privacy: 'Politique de confidentialité', terms: 'Conditions d\'utilisation', legal: 'Mentions légales' },
  en: { about: 'About', privacy: 'Privacy Policy', terms: 'Terms of Service', legal: 'Legal Notice' }
};

const PAGES = {
  fr: { about: ABOUT_FR, privacy: PRIVACY_FR, terms: TERMS_FR, legal: LEGAL_FR },
  en: { about: ABOUT_EN, privacy: PRIVACY_EN, terms: TERMS_EN, legal: LEGAL_EN }
};

export function showLegalPage(which) {
  const loc = getLocale() === 'en' ? 'en' : 'fr';
  const title = TITLES[loc][which] || which;
  const body = PAGES[loc][which] || '';
  const html = `<div class="legal-page">${body}</div>`;
  showGenericModal(title, html, { wide: true });
}

export const LEGAL_PAGE_IDS = ['about', 'privacy', 'terms', 'legal'];
