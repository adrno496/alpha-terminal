# Alpha Terminal — Claude Code Context

## Produit
PWA d'analyse financière BYOK (Bring Your Own Key) pour investisseurs particuliers.
60+ modules orchestrant 14 fournisseurs LLM. Positionnée comme alternative à Bloomberg
Terminal pour le retail (9,99€/mois ou 299€ à vie vs 24 000€/an).

## Stack technique
- **Frontend** : Vanilla JS (ES modules natifs), **PAS de framework** (pas de React, pas de Vue, pas de build step)
- **PWA** : `manifest.json`, `service-worker.js` v30 (cache-first assets, network-first HTML, no API caching)
- **Storage local** : IndexedDB (12 stores) + localStorage. Aucune DB serveur pour les analyses.
- **Vault chiffré** : clés API encryptées AES-GCM-256 avec PBKDF2 100k iter sur passphrase utilisateur
- **Mobile** : Capacitor 8 (`webDir: dist-mobile`) pour Android + iOS
- **Hébergement** : Vercel (statique)
- **Analytics** : Plausible (cookieless, IP anonymisée)

## Architecture clé
```
index.html              ← Single-page entry (landing + app shell)
js/app.js               ← Router (hashchange-based)
js/core/api.js          ← APIOrchestrator + SmartRouter (sélection LLM optimal par module)
js/core/i18n.js         ← FR/EN dictionnaire + applyI18nAttributes
js/core/storage.js      ← IndexedDB wrapper
js/core/backup.js       ← Export/import full state (incluant license keys)
js/modules/             ← 60+ modules métier (10-K Decoder, DCF, Buffett, etc.)
js/modules/_shared.js   ← runAnalysis() = point d'entrée unique avec gate paywall
js/ui/                  ← Composants UI (sidebar, modal, market-pulse, install-prompt)
js/license.js           ← Lemonsqueezy License Keys validation/activation
js/paywall.js           ← Gate Pro modules (canAccess + blockUI)
```

## Fournisseurs LLM (BYOK — 14)
Claude (Anthropic), OpenAI, Gemini (Google), Grok (xAI), OpenRouter, Perplexity,
Mistral, Cerebras, GitHub Models, NVIDIA NIM, HuggingFace, Cloudflare Workers AI,
Together, Cohere.

L'utilisateur fournit ses propres clés. Aucune clé Alpha sur les serveurs — les requêtes
LLM partent **directement** depuis le navigateur vers les APIs respectives.

## Fournisseurs de data financière (11)
FMP, Polygon, Finnhub, Tiingo, Twelve Data, FRED, Etherscan, Alpha Vantage,
CoinGecko (gratuit), Yahoo Finance unofficial, Stooq.

## Modèle économique — Lemonsqueezy License Keys
- **Mensuel** : 9,99€/mois (variant `1599882`)
- **À vie** : 299€ paiement unique (URL : `https://alpha-terminal.lemonsqueezy.com/checkout/buy/bc77ee76-8202-4df6-8093-f353576c3f0b`)
- **Garantie** 14 jours satisfait ou remboursé sur tous les CTA payants
- **Validation** : POST `https://api.lemonsqueezy.com/v1/licenses/validate` au boot + revalidation 24h
- **Activation** : POST `/v1/licenses/activate` avec `instance_name` au premier usage
- **Auto-logout** uniquement si Lemonsqueezy retourne explicitement `expired`/`disabled`
- **Pas d'auth Supabase active** (legacy `js/auth.js` + magic link existent mais paywall passe par licenseManager)

## Modules gratuits (FREE_MODULES dans paywall.js)
`quick-analysis`, `wealth`, `watchlist`, `knowledge-base`, `budget`, `csv-import`,
`correlation-matrix`, `watchpoints`, `accounts-view`, `goals`, `dividends-tracker`,
`price-alerts`, `subscriptions-detector`, `capital-gains-tracker`, `multi-currency-pnl`,
`diversification-score`, `fear-greed`, `projection`.

Les ~46 autres modules sont gated derrière la licence Premium.

## Règles de développement
- **Aucun framework** — vanilla JS uniquement. Pas de bundler, pas de TS.
- **ES modules natifs** (`<script type="module">`). Imports relatifs avec `.js` explicite.
- **Aucune clé API hardcodée** — toujours via vault utilisateur ou `getDataKey()`.
- **Aucune donnée d'analyse vers nos serveurs** — vérifiable via DevTools Network sur `privacy-proof.html`.
- **i18n via clés `data-i18n`** ou pattern bilingue `<span class="lang-en">` (caché par défaut, swap si `<html lang="en">`).
- **Garder la cohérence FR/EN** : pages commerciales ont une version `-en.html` dédiée, pages légales utilisent `?lang=en` template swap.
- **Toujours bumper la version du Service Worker** (`alpha-terminal-vXX`) après modif HTML/JS pour invalider le cache.
- **paywall gate** dans `runAnalysis()` au début → tout module Pro s'arrête si `!canAccess(moduleId)`.

## SEO + Marketing
- 49 URLs dans `sitemap.xml`, hreflang FR/EN/x-default complet
- JSON-LD : SoftwareApplication, Product, FAQPage, HowTo, Article, Blog, BreadcrumbList,
  Organization, Event, WebSite — couverture quasi-complète
- Blog section : `blog.html` + `blog-en.html` avec 12 articles SEO
- Newsletter : Formsubmit (`savetheworldfr@gmail.com`) avec téléchargement immédiat du
  lead magnet (`lead-magnet-10-ratios.html`)
- Plausible event tracking sur tous CTA principaux (`Subscribe+Click`, `Lifetime+Click`,
  `Demo+Click`, `Newsletter+Signup`, `DCF+Calculate`, `BYOK+Upsell`, etc.)
- Pages dédiées trust : `privacy-proof.html` (DevTools tutorial) + `pour-qui.html` (3 personas)

## Outils interactifs publics
- `dcf-calculator.html` (+ EN) : calculateur DCF gratuit avec upsell
- `byok-cost-calculator.html` (+ EN) : simulateur de coût BYOK total

## Pages comparatives
`bloomberg-alternative.html`, `alpha-vs-koyfin.html`, `alpha-vs-chatgpt.html`,
`alpha-vs-bloomberg-detailed.html` (toutes en FR + EN).

## Anti-patterns à éviter
- ❌ Ajouter React/Vue/Svelte/etc. — la stack est volontairement vanilla
- ❌ Ajouter un build step (Vite/Webpack/Rollup) — `<script type="module">` direct
- ❌ Stocker quoi que ce soit côté serveur sur les analyses (briserait la promesse "100% privé")
- ❌ Backend pour les calls LLM (briserait BYOK + privacy)
- ❌ Auth Supabase obligatoire avant utilisation (le mode démo et le wizard "accès sans clé" doivent rester)
- ❌ Hardcoder une URL d'environnement spécifique — toutes les URLs Lemonsqueezy/Plausible/etc. doivent passer par `window.ALPHA_CONFIG` quand applicable

## Conventions de code
- Indentation : 2 espaces
- Strings : guillemets simples `'...'`
- Pas de point-virgule strict (mais cohérent par fichier)
- IIFE `(function(){ 'use strict'; ... })()` pour les scripts inline non-modules
- ES module avec `export function` pour les fichiers `js/`
- Commentaires en français OK (le projet est FR-first), mais EN si le contexte est universel

## Commandes utiles
```bash
# Dev local (n'importe quel serveur statique)
npx serve /Users/dreano/Downloads/alphaterminalpwa
# ou
python3 -m http.server 8080

# Build mobile (Capacitor)
npx cap sync                # copie web → dist-mobile → projets natifs
npx cap open android        # ouvre Android Studio
npx cap open ios            # ouvre Xcode

# Validation
node --check js/<fichier>.js                    # syntax check JS
xmllint --noout sitemap.xml                     # validation XML

# Service Worker version bump (après modif)
sed -i '' 's|alpha-terminal-vXX|alpha-terminal-vXY|g' service-worker.js
```

## Contacts / Liens
- Domaine : `https://alpha-terminal.app`
- Email contact : `savetheworldfr@gmail.com`
- Lemonsqueezy variant mensuel : `1599882`
- Lemonsqueezy permalink lifetime : `bc77ee76-8202-4df6-8093-f353576c3f0b`
- Plausible domain : `alpha-terminal.app`

## CORS Proxy (Vercel Edge Function)

Pour débloquer les 4 providers LLM CORS-incompatibles (GitHub Models, NVIDIA NIM, HuggingFace, Cloudflare), une edge function `api/llm-proxy.js` agit comme proxy CORS.
- Whitelist stricte des hosts autorisés
- Aucune clé API stockée serveur (pass-through Authorization header)
- Coût : 0 (Vercel free tier 100k invocations/mois)
- Override : `window.ALPHA_CONFIG.LLM_PROXY_URL` (par défaut `/api/llm-proxy`)
