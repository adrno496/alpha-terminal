# ALPHA TERMINAL

> Bloomberg-style finance analysis terminal — 100% client-side, BYOK (Bring Your Own Key).

10 modules d'analyse financière de niveau hedge fund, propulsés par l'API Anthropic (Claude Opus 4.5).
Aucun backend, aucune donnée ne quitte ton navigateur — sauf les requêtes envoyées directement à `api.anthropic.com`.

---

## ✨ Features

| # | Module | Description |
|---|---|---|
| 01 | **10-K Decoder** | Analyse value Buffett-style d'un rapport annuel (PDF). Moat, économie unitaire, red flags comptables, verdict. |
| 02 | **Macro Dashboard** | Identification du régime macro + scénarios Bull/Base/Bear probabilisés (style Bridgewater). |
| 03 | **Crypto Fundamental** | Analyse fondamentale d'un token (tokenomics, P/F, narrative timing, scénarios). |
| 04 | **Earnings Call** | Forensic du transcript : tonalité, changements vs Q-1, Q&A squirms, red flags language. |
| 05 | **Portfolio Rebalancer** | Recommandations risk-adjusted pondérées par conviction et profil de risque. |
| 06 | **Tax Optimizer FR** | Stratégie fiscale française avancée (PEA, CTO, PER, AV, crypto, holding). |
| 07 | **Whitepaper Reader** | Scan paranoïaque d'un whitepaper crypto sur 13 patterns de scam. |
| 08 | **Sentiment Tracker** | Score sentiment contrarian via web search (Reddit, FinTwit, news). |
| 09 | **Newsletter Voice** | Génère une newsletter financière dans TA voix (style cloning 2-pass). |
| 10 | **Position Sizing** | Kelly criterion (Full / Half / Quarter) avec contraintes de risque réelles. |

---

## 🚀 Installation

Aucun build. Aucun npm. Ça tourne en ouvrant `index.html`.

```bash
git clone <ce-repo> alpha-terminal
cd alpha-terminal
# Ouvre index.html dans ton browser
open index.html      # macOS
xdg-open index.html  # Linux
```

> ⚠️ Certains browsers (Chrome) bloquent les modules ES6 sur `file://`. Si tu vois une erreur dans la console, sers le dossier en local :
>
> ```bash
> python3 -m http.server 8080
> # → http://localhost:8080
> ```
> Ou utilise n'importe quel serveur statique (`npx serve`, `caddy`, etc.).

---

## 🔑 Comment créer ta clé API Anthropic

1. Va sur [console.anthropic.com](https://console.anthropic.com)
2. Crée un compte (carte bancaire requise pour l'API).
3. Onglet **API Keys** → **Create Key**.
4. Copie la clé (commence par `sk-ant-...`).
5. Reviens dans ALPHA TERMINAL → la modale de welcome demandera la clé + un mot de passe local pour la chiffrer.

**Coûts indicatifs (Opus 4.5)** : ~$15 / 1M tokens en entrée, ~$75 / 1M en sortie.
Une analyse 10-K typique (~30K tokens in / 3K out) coûte environ **$0.70**.
Sentiment Tracker ajoute ~$0.01 par recherche web.

---

## 🔐 FAQ Sécurité

**Ma clé API est-elle safe ?**
- Elle est chiffrée localement avec **AES-GCM 256** + clé dérivée par **PBKDF2** (100 000 itérations) à partir de ton mot de passe.
- Stockée *chiffrée* dans `localStorage`. Le mot de passe ne quitte jamais ton appareil.
- Vérifie toi-même : DevTools → Application → Local Storage → `alpha-terminal:vault`. Tu ne verras que du base64 chiffré.
- En mémoire, la clé est tenue dans un module ES6 (variable privée `_apiKey`). Bouton "Lock" pour l'effacer.

**Les analyses sont-elles envoyées quelque part ?**
- Non. Stockage 100% local (IndexedDB).
- Seules les requêtes vers `api.anthropic.com` partent du browser, comme avec n'importe quel SDK Anthropic.
- L'header `anthropic-dangerous-direct-browser-access: true` est utilisé pour activer l'appel browser direct (BYOK assumed).

**Si je perds mon mot de passe ?**
- Bouton "Reset vault" dans Settings → tu devras ressaisir ta clé API.
- Aucune récupération possible — c'est le but du chiffrement.

**Et l'historique IndexedDB ?**
- Stocké uniquement dans ton browser. Bouton "Effacer tout l'historique" dans Settings.

---

## ⚙️ Stack

- Vanilla JS (ES6 modules) — pas de framework
- HTML / CSS purs (CSS variables)
- [PDF.js](https://mozilla.github.io/pdf.js/) (CDN) — parsing PDF
- [Marked.js](https://marked.js.org/) (CDN) — rendu markdown
- [Chart.js](https://www.chartjs.org/) (CDN) — visualisations
- Web Crypto API native — chiffrement de la clé API
- IndexedDB — historique
- Direct browser fetch → `api.anthropic.com`

Aucune dépendance npm. Aucun build step. Compatible Capacitor 8 pour build Android.

---

## 📁 Structure

```
/
├── index.html
├── styles.css
├── README.md
└── js/
    ├── app.js                    Entry point + router
    ├── core/                     api, crypto, storage, pdf-parser, export, utils
    ├── prompts/                  10 system prompts (un par module)
    ├── modules/                  10 vues + logique business
    └── ui/                       sidebar, history, settings, modal
```

---

## 🛠 Settings

`Settings` (sidebar bas) permet de :
- Changer le modèle par défaut (Opus 4.5 ↔ Sonnet 4.5)
- Ajuster `max_tokens` et `temperature`
- Verrouiller / effacer le vault
- Effacer tout l'historique

---

## 🧠 Philosophie

ALPHA TERMINAL est conçu pour donner à un investisseur particulier les outils analytiques d'un fonds.
Chaque prompt est calibré pour produire des analyses **actionnables**, pas du blabla académique.

Ce n'est **pas du conseil financier**. Aucune des 10 analyses ne remplace un avis professionnel.

---

## 🤝 Crédits

Built by an investor, for investors. Free as in freedom.
