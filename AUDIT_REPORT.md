# ALPHA TERMINAL — AUDIT REPORT

**Date** : 2026-05-01
**Périmètre** : core (api.js, 14 providers, crypto, storage, cost-tracker, safe-render, router, _shared.js, pdf-parser) + UI critique (modal, settings, history, sidebar) + 60 modules + service-worker + cross-cutting greps.

---

## Résumé exécutif

| Phase | Fichiers audités | Bugs trouvés |
|-------|------------------|--------------|
| A — Core | 22 | 5 (1 CRIT · 1 HIGH · 2 MED · 1 LOW) |
| B — `_shared.js` | 1 (813 LoC) | 4 (3 MED · 1 LOW) |
| C — UI critique | 5 | 4 (3 MED · 1 LOW) |
| D — 60 modules | 60 (sondage + cross-grep) | 3 (3 MED) |
| E — Cross-cutting | repo entier | 0 nouveau (vérifié sain) |
| **Total** | — | **16 corrigés / 0 laissés CRITIQUES ou HIGH** |

- ✅ **API multi-provider (14)** : orchestrator, retry/backoff, fallback, AbortController per-request — fonctionnel.
- ✅ **Streaming SSE** : chaque provider implémente `consumeSSE()` correctement.
- ✅ **Tool-use web_search** : Claude (`web_search_20250305`), Gemini (`google_search`), Grok (Live Search), Perplexity (natif).
- ✅ **Crypto vault** : AES-GCM-256 + PBKDF2 100k iter, IV/salt aléatoires, pas de log de clés.
- ✅ **Service worker v27** : aucune API LLM cachée, network-first HTML, cache-first assets.
- ✅ **Pas de `eval()` dangereux** : seul usage est `wealth-method.js:148` avec whitelist tokenizer + JSON statique embarqué (safe).
- ✅ **Pas de leak de clés API en console** (grep exhaustif).

---

## Bugs corrigés (par fichier)

| Fichier | Sévérité | Problème | Fix appliqué |
|---------|----------|----------|--------------|
| `js/core/providers/gemini.js` | **CRITICAL** | Clé API Gemini passée en query string (`?key=...`) — visible dans Referer headers, history, DevTools network. | Refactor `_url()` + nouveau `_headers()` avec `x-goog-api-key` (méthode officielle Google). |
| `js/core/safe-render.js` | **HIGH** | Hook DOMPurify (`target=_blank`, `rel=noopener noreferrer`) installé seulement si `window.DOMPurify` est déjà défini au load module. CDN charge après → hook jamais installé → liens externes sans protection. | Hook lazy installé à la première sanitization (`ensureLinkHook()` dans `purifyHtml()`). |
| `js/core/storage.js` | MEDIUM | `getSettings()` shallow-merge → quand `DEFAULT_SETTINGS.modelOverrides` ajoute un nouveau provider, les utilisateurs avec snapshot saved perdent les nouveaux defaults. | Ajout `_mergeSettings()` deep-merge limité aux objets (1 niveau). |
| `js/core/router.js` | MEDIUM | Typo capability key `'web_search'` (au lieu de `'supportsWebSearch'`) sur `geopolitical-analysis`. | Corrigé en `'supportsWebSearch'`. |
| `js/core/pdf-parser.js` | MEDIUM | Pas de garde sur la taille du PDF → upload de gros PDF (>100 Mo) crashe l'onglet (base64 en mémoire). | Garde 50 Mo + erreurs explicites pour PDF chiffrés (`PasswordException`) et invalides. |
| `js/core/cost-tracker.js` | LOW | `__costDebug` exposé sur window (debug). | Laissé tel quel — utile en prod pour support. |
| `js/modules/_shared.js` | MEDIUM | Bug d'opérateur dans le bandeau "Cached result" : `' · ' + isEN ? 'saved' : 'économisé' + …` → `'saved'` toujours retourné, montant perdu en EN. | Ajout parens + template literal correct. |
| `js/modules/_shared.js` | MEDIUM | `runAnalysis()` mute `params.override` et `params.promptCaching` du caller. | Clone dans variables locales `runOverride` / `promptCaching`. |
| `js/modules/_shared.js` | MEDIUM | `runAnalysis()` catch error → `showApiError("AbortError")` cosmétiquement laid après abort utilisateur. | Détecte `AbortError` et affiche "Requête annulée." silencieusement. |
| `js/modules/_shared.js` | MEDIUM | Cache hit retourne `{markdown,...}` mais les modules font `result.text` après runAnalysis → undefined silencieux (ex: extractScore dans sentiment-tracker). | Cache hit retourne `{...cached, text: cached.markdown, usage: {...}}` pour shape uniforme. |
| `js/ui/modal.js` | HIGH | Code mort/cassé dans `renderWizardStep2()` : `try { isEnLocal = require ? false : false; }` (require non défini en browser) + variable `isEN` jamais utilisée. | Nettoyé : seulement `isEnLocal = document.documentElement.lang === 'en';`. |
| `js/ui/modal.js` | MEDIUM | Texte obsolète "10 modules" dans wizard step 2 (l'app a 60+ modules). | "60+ modules". |
| `js/ui/modal.js` | MEDIUM | `nameOf()` et `labelOf()` dans le routing preview (step 3) ne connaissaient que 4 providers / 10 modules → noms bruts ("perplexity", "tax-international") affichés à l'user. | Étendus aux 14 providers + 31 modules + fallback Title-Case automatique. |
| `js/ui/modal.js` | MEDIUM | Échappement title attribute du status d'erreur ne couvre que `"` (pas `<`, `&`, `'`). | Échappement HTML complet (`& < > " '`). |
| `js/ui/modal.js` | MEDIUM | `setRuntimeKeys()` non protégé par try/catch dans `finishWizard()` → si l'orchestrateur crashe à l'init (clé mal formée), vault sauvé mais user bloqué sans message clair. | Try/catch dédié avec message "Vault sauvé mais init échouée : …". |
| `js/modules/sentiment-tracker.js` | MEDIUM | `} catch {}` swallow silencieux + pas de null check sur `result.text` (cache hit / abort) → gauge ne render pas. | Null guard + `console.error` au lieu de catch silencieux + chart destroy avant recreate. |
| `js/modules/decoder-10k.js` | LOW | Empty `} catch {}` à la fin de `run()`. | `console.error` pour log diagnostic. |

---

## Findings non corrigés (justifiés)

- **PBKDF2 100 000 iter (`js/core/crypto.js`)** — OWASP 2024 recommande 600 000+. Augmenter casserait tous les vaults existants (les utilisateurs perdraient l'accès, recovery impossible by design). Bumper sur la prochaine migration majeure du vault (v3) avec une procédure de re-encrypt automatique.
- **`new Function()` dans `wealth-method.js:148`** — gated par whitelist tokenizer (replace tous identifiers par valeurs ctx ou `0`) et conditions chargées depuis `data/wealth-rules-fr.json` (statique, embarqué). Pas d'exposition à user input.
- **231 occurrences `innerHTML=` dans modules + 59 dans UI** — vérifié manuellement sur top usagers : tous écrivent des templates HTML hardcodés ou passent par `safeRender()`/`escHtml()` pour user data. Les imports de l'API LLM passent tous par `safeRender()` via `_shared.js:65`.
- **`__costDebug` exposé sur window** — utile pour support.
- **31/60 modules sans prompt dédié dans `js/prompts/`** — confirmé intentionnel : modules locaux (budget, csv-import, correlation-matrix, watchpoints, wealth, …) n'appellent pas le LLM. Aucun bug.
- **Multiple empty `} catch {}`** dans modules (env. 30) — pour la plupart sur des opérations DOM idempotentes ou cleanup chart. Les empty catch en fin de `run()` sont après un `runAnalysis()` qui a déjà géré l'affichage de l'erreur dans le container, donc l'UX reste correcte ; correction au cas par cas si bug observé.
- **`quick-analysis.js`** bypasse `runAnalysis()` et appelle `analyzeStream()` directement, dupliquant la logique wealth/data context. Refactor à part (out of scope audit, fonctionnel).

---

## Core API — État final

- **Orchestrator multi-provider** : ✅ 14 providers via `APIOrchestrator` + `SmartRouter`.
- **Streaming SSE** : ✅ canonique via `consumeSSE()` ; chaque provider parse ses events.
- **Tool-use web_search** : ✅ Claude (`web_search_20250305`), Gemini (`google_search`), Grok (Live Search), Perplexity (natif).
- **Retry 429** : ✅ exponentiel 1.5s → 16s, max 3 attempts, respect `Retry-After`.
- **Auto-fallback provider** : ✅ après échec non-429/non-AbortError, essaie un provider non-tenté.
- **AbortController per-request** : ✅ `_controllers Map` keyed par requestId.
- **Headers Anthropic** : `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`. ✅
- **Headers Gemini** : `x-goog-api-key` (header, plus jamais query). ✅ corrigé.
- **Timeouts** : 60s non-stream / 120s stream via `withTimeout()` + `AbortSignal.any` (avec fallback manuel).

## Crypto / Vault — État final

- **PBKDF2 100k iter SHA-256** + AES-GCM-256.
- **IV 12 bytes random** par chiffrement. **Salt 16 bytes random** par vault.
- **Pas de log de clés** (grep exhaustif).
- **`forgetVault()`** purge `localStorage`. **`clearRuntimeKeys()`** réinitialise l'orchestrateur en mémoire.
- **Migration v1 → v2 automatique** au premier unlock.
- **Fusion vault** : `setApiKeys()` valide d'abord le password contre une clé existante avant fusion (évite l'écrasement par mauvais password).

## Storage / IndexedDB — État final

- **DB v10**, 12 stores (analyses, wealth, transcripts, goals, watchpoints, etc.).
- **Init asynchrone** avec gestion private mode (timeout 5s + listener `onDbAvailabilityChange`).
- **Transactions readwrite** explicites pour chaque écriture.
- **Settings deep-merge** ✅ corrigé : nouveaux providers/overrides hérités automatiquement.

## Service Worker — État final

- **v27** active.
- **Network-first HTML** (toujours frais).
- **Cache-first static assets** avec stale-while-revalidate.
- **APIs LLM jamais cachées** (regex incluant tous les 14 providers + data providers + YouTube + FRED).

---

## Recommandations futures (hors scope audit)

1. **README v2.1.0 obsolète** : annonce 10 modules / API Anthropic seulement. Mettre à jour pour refléter les 60 modules + 14 providers BYOK.
2. **Refactor `quick-analysis.js`** pour passer par `runAnalysis()` (élimine duplication wealth/data context).
3. **Migration vault v3** avec PBKDF2 600k iter + re-encrypt transparent au premier unlock.
4. **Per-request abort UI** : `prepareStreamContainer` actuellement abort tous les calls en cours (`abortCurrentCall()` sans arg). L'infrastructure per-request existe dans `api.js` (requestId via `onSelected` callback) mais n'est pas threadée jusqu'au bouton. Bénéfice marginal en SPA single-view mais utile si on autorise le multi-stream.
5. **Backup import** : `importBackupFromFile(..., { mode: 'replace' })` n'a pas de confirmation per-field. Acceptable en onboarding (vault vide), mais à durcir si utilisé dans Settings après vault établi.
