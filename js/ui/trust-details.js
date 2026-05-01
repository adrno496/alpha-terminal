// Trust badges → ouvre un modal détaillant chaque garantie pour rassurer l'utilisateur.
import { showGenericModal } from './modal.js';
import { getLocale } from '../core/i18n.js';

const CONTENT = {
  fr: {
    private: {
      title: '🔒 100% privé — comment ça marche',
      body: `
        <p style="font-size:15px;"><strong>Aucune donnée ne quitte ton appareil pour aller vers un serveur Alpha.</strong> L'app fonctionne 100% côté client (PWA dans ton navigateur ou app Capacitor sur ton téléphone).</p>
        <h3>Ce que ça veut dire concrètement</h3>
        <ul>
          <li>Quand tu lances une analyse, ton navigateur appelle <em>directement</em> l'API du provider IA (Anthropic, OpenAI, Google…) sans passer par un quelconque serveur Alpha.</li>
          <li>Vérifiable toi-même : ouvre les <strong>DevTools → onglet Network</strong> pendant une analyse. Tu ne verras que des requêtes vers <code>api.anthropic.com</code>, <code>api.openai.com</code>, etc. Aucune vers <code>alpha-terminal.app</code> ou un domaine inconnu.</li>
          <li>Aucune télémétrie, aucun analytics, aucun pixel de tracking.</li>
          <li>Pas de cookie d'identification — l'app n'a même pas de système de comptes.</li>
        </ul>
        <h3>Et l'abonnement alors ?</h3>
        <p>Le paiement de l'abonnement passe par un fournisseur tiers (Stripe / App Store / Play Store) qui sait que <em>tu paies pour Alpha</em>, mais qui n'a aucun accès à ce que tu fais dans l'app : pas de visibilité sur tes analyses, ton patrimoine, tes clés API, tes notes, etc.</p>
        <h3>Limites honnêtes</h3>
        <p>Les providers d'IA (Anthropic, OpenAI…) reçoivent ta requête via leur API. Leur politique de rétention varie : Claude promet <em>zero retention</em> sur l'API par défaut, OpenAI conserve 30 jours sauf opt-out, etc. Lis leurs CGU. <strong>Alpha n'a aucun pouvoir là-dessus</strong> — choisis le provider qui te convient.</p>
      `
    },
    byok: {
      title: '🔑 Ta clé, tes données — modèle BYOK',
      body: `
        <p style="font-size:15px;"><strong>BYOK = Bring Your Own Key</strong>. Tu paies ton fournisseur d'IA <em>directement</em> à son tarif (Anthropic, OpenAI, Google…) au lieu d'une marge appliquée par un intermédiaire.</p>
        <h3>Avantages</h3>
        <ul>
          <li><strong>Tarif au prix coûtant</strong> — comptes ~$0,005-0,10 par analyse. Pas de marge SaaS multipliée par 5.</li>
          <li><strong>Contrôle total</strong> — tu peux définir un budget mensuel chez ton provider, couper la clé à tout moment, voir ton usage exact.</li>
          <li><strong>Choix du modèle</strong> — Claude pour les 10-K, Gemini pour les longs PDFs, Grok pour le sentiment X, GPT-4o pour le polyvalent. Tu n'es pas enfermé dans un seul modèle moyen.</li>
          <li><strong>7 providers gratuits</strong> — GitHub Models, Cerebras, Mistral, NVIDIA, Cloudflare, HuggingFace, Cohere. Tu peux explorer Alpha sans payer un centime d'IA.</li>
        </ul>
        <h3>Stockage de la clé</h3>
        <p>Ta clé API est <strong>chiffrée localement</strong> dans IndexedDB avec :</p>
        <ul>
          <li>Algorithme : <strong>AES-GCM 256 bits</strong></li>
          <li>Dérivation : <strong>PBKDF2 100 000 itérations</strong> à partir d'un mot de passe maître que <em>toi seul</em> connais</li>
          <li>Aucune partie de la clé n'est jamais envoyée à un serveur Alpha — elle ne sort que pour appeler l'API du provider</li>
        </ul>
        <p>Si tu oublies ton mot de passe maître : <strong>aucune récupération possible</strong>. C'est le prix de la sécurité 100% locale. Exporte un backup chiffré régulièrement.</p>
        <p>📖 <a href="api-keys-guide.html" target="_blank">Guide complet : comment obtenir une clé API →</a></p>
      `
    },
    local: {
      title: '💾 Stockage local — où vivent tes données',
      body: `
        <p style="font-size:15px;"><strong>Tout est dans ton navigateur</strong> ou ton app Capacitor. Aucune base de données distante, aucun cloud Alpha.</p>
        <h3>Ce qui est stocké localement</h3>
        <ul>
          <li><strong>IndexedDB du navigateur</strong> — tes analyses passées, ton patrimoine (holdings, snapshots), tes objectifs, ton budget, tes alertes prix, ta knowledge base, tes lots d'achat, etc.</li>
          <li><strong>localStorage</strong> — préférences UI (langue, mode sombre, catégories ouvertes, override providers), profil utilisateur (questionnaire onboarding).</li>
          <li><strong>Coffre chiffré (AES-GCM)</strong> — tes clés API, dérivées d'un mot de passe maître.</li>
        </ul>
        <h3>Aucun cloud Alpha</h3>
        <p>Si tu désinstalles l'app ou clears tes données navigateur, tout disparaît. Inversement, on n'a aucun moyen de récupérer tes données pour toi — elles n'existent que sur tes appareils.</p>
        <h3>Comment migrer ou backuper</h3>
        <ul>
          <li>Bouton <strong>"Export backup chiffré (.atb)"</strong> dans Paramètres → Backup. Génère un fichier chiffré avec ton mot de passe maître.</li>
          <li>Tu peux le réimporter sur un autre appareil avec le même mot de passe.</li>
          <li>Backup conseillé après chaque ajout important au patrimoine ou tous les mois.</li>
        </ul>
        <h3>Combien d'espace ?</h3>
        <p>L'app utilise typiquement <strong>1-50 Mo</strong> selon ton usage. Le plus lourd : la knowledge base (PDFs indexés) et l'historique d'analyses. Tu peux nettoyer manuellement dans Paramètres.</p>
      `
    },
    cancel: {
      title: '✋ Annulable à tout moment — détails de l\'abonnement',
      body: `
        <p style="font-size:15px;"><strong>Aucun engagement de durée.</strong> Tu annules quand tu veux, depuis l'app ou depuis ton compte App Store / Play Store / Stripe.</p>
        <h3>Ce qui se passe à l'annulation</h3>
        <ul>
          <li>Tu gardes l'accès <strong>jusqu'à la fin de la période payée</strong> (par exemple, si tu paies le 15 et tu annules le 20, tu gardes le service jusqu'au 14 du mois suivant).</li>
          <li>Aucun renouvellement automatique au-delà.</li>
          <li>Tu retombes ensuite sur le <strong>plan gratuit</strong> : 4 modules essentiels (Quick Analysis, Patrimoine, Watchlist, Knowledge Base) restent accessibles à vie.</li>
          <li><strong>Tes données restent intactes</strong> — patrimoine, analyses passées, snapshots, etc. Si tu te réabonnes plus tard, tu retrouves tout.</li>
        </ul>
        <h3>Comment annuler</h3>
        <ul>
          <li><strong>Sur iPhone / iPad</strong> : Réglages iOS → Apple ID → Abonnements → Alpha → Annuler.</li>
          <li><strong>Sur Android</strong> : Play Store → Profil → Paiements et abonnements → Abonnements → Alpha → Annuler.</li>
          <li><strong>Sur web (PWA via Stripe)</strong> : Paramètres Alpha → Mon abonnement → Gérer → Annuler.</li>
        </ul>
        <h3>Remboursements</h3>
        <p>Apple et Google gèrent les demandes de remboursement directement sur leur plateforme (politiques standard 14j sous condition). Pour Stripe, contacte <a href="mailto:savetheworldfr@gmail.com">savetheworldfr@gmail.com</a> dans les 14 jours suivant le paiement initial.</p>
        <h3>Essayer sans payer</h3>
        <p>Le mode démo permet d'explorer tous les modules avec des analyses pré-générées sans clé API ni paiement. Le plan Gratuit donne aussi accès à 4 modules essentiels en illimité avec une clé LLM gratuite (GitHub Models, Cerebras, Mistral).</p>
      `
    }
  },
  en: {
    private: {
      title: '🔒 100% private — how it works',
      body: `
        <p style="font-size:15px;"><strong>No data leaves your device for any Alpha server.</strong> The app runs 100% client-side (PWA in your browser or Capacitor app on your phone).</p>
        <h3>What this means concretely</h3>
        <ul>
          <li>When you run an analysis, your browser calls the AI provider's API (Anthropic, OpenAI, Google…) <em>directly</em>, no Alpha server in between.</li>
          <li>Verify it yourself: open <strong>DevTools → Network tab</strong> during an analysis. You'll only see requests to <code>api.anthropic.com</code>, <code>api.openai.com</code>, etc. Nothing to <code>alpha-terminal.app</code> or any unknown domain.</li>
          <li>No telemetry, no analytics, no tracking pixel.</li>
          <li>No identification cookie — the app doesn't even have an account system.</li>
        </ul>
        <h3>What about the subscription?</h3>
        <p>Subscription payments go through a third-party provider (Stripe / App Store / Play Store) which knows <em>you pay for Alpha</em>, but has zero access to what you do inside the app: no visibility on your analyses, wealth, API keys, notes, etc.</p>
        <h3>Honest limits</h3>
        <p>AI providers (Anthropic, OpenAI…) receive your request through their API. Their retention policy varies: Claude promises <em>zero retention</em> on API by default, OpenAI keeps 30 days unless opted out, etc. Read their TOS. <strong>Alpha has no power over this</strong> — choose the provider that suits you.</p>
      `
    },
    byok: {
      title: '🔑 Your key, your data — BYOK model',
      body: `
        <p style="font-size:15px;"><strong>BYOK = Bring Your Own Key</strong>. You pay your AI provider <em>directly</em> at their rate (Anthropic, OpenAI, Google…) instead of paying a markup applied by a middleman.</p>
        <h3>Benefits</h3>
        <ul>
          <li><strong>At-cost pricing</strong> — about $0.005-0.10 per analysis. No 5× SaaS markup.</li>
          <li><strong>Total control</strong> — set a monthly budget at your provider, kill the key anytime, see exact usage.</li>
          <li><strong>Model choice</strong> — Claude for 10-K, Gemini for long PDFs, Grok for X sentiment, GPT-4o for general. You're not locked into one average model.</li>
          <li><strong>7 free providers</strong> — GitHub Models, Cerebras, Mistral, NVIDIA, Cloudflare, HuggingFace, Cohere. You can explore Alpha at zero AI cost.</li>
        </ul>
        <h3>Key storage</h3>
        <p>Your API key is <strong>encrypted locally</strong> in IndexedDB with:</p>
        <ul>
          <li>Algorithm: <strong>AES-GCM 256-bit</strong></li>
          <li>Derivation: <strong>PBKDF2 100,000 iterations</strong> from a master password only <em>you</em> know</li>
          <li>No part of the key is ever sent to an Alpha server — it only leaves to call the provider's API</li>
        </ul>
        <p>If you forget your master password: <strong>no recovery possible</strong>. That's the price of 100% local security. Export an encrypted backup regularly.</p>
        <p>📖 <a href="api-keys-guide.html" target="_blank">Full guide: how to get an API key →</a></p>
      `
    },
    local: {
      title: '💾 Local storage — where your data lives',
      body: `
        <p style="font-size:15px;"><strong>Everything lives in your browser</strong> or your Capacitor app. No remote database, no Alpha cloud.</p>
        <h3>What's stored locally</h3>
        <ul>
          <li><strong>Browser IndexedDB</strong> — past analyses, wealth (holdings, snapshots), goals, budget, price alerts, knowledge base, purchase lots, etc.</li>
          <li><strong>localStorage</strong> — UI prefs (language, dark mode, open categories, provider overrides), user profile (onboarding questionnaire).</li>
          <li><strong>Encrypted vault (AES-GCM)</strong> — your API keys, derived from a master password.</li>
        </ul>
        <h3>No Alpha cloud</h3>
        <p>If you uninstall the app or clear browser data, it all disappears. Conversely, we have no way to recover your data for you — it only exists on your devices.</p>
        <h3>How to migrate or backup</h3>
        <ul>
          <li><strong>"Export encrypted backup (.atb)"</strong> button in Settings → Backup. Generates a file encrypted with your master password.</li>
          <li>Reimport on another device with the same master password.</li>
          <li>Backup recommended after each significant wealth update or monthly.</li>
        </ul>
        <h3>How much space?</h3>
        <p>The app typically uses <strong>1-50 MB</strong> depending on usage. Heaviest: knowledge base (indexed PDFs) and analysis history. You can manually clean up in Settings.</p>
      `
    },
    cancel: {
      title: '✋ Cancel anytime — subscription details',
      body: `
        <p style="font-size:15px;"><strong>No commitment.</strong> Cancel whenever you want, from the app or from your App Store / Play Store / Stripe account.</p>
        <h3>What happens on cancellation</h3>
        <ul>
          <li>You keep access <strong>until the end of the paid period</strong> (e.g., pay on the 15th, cancel on the 20th → service runs until the 14th of next month).</li>
          <li>No automatic renewal beyond that.</li>
          <li>You then fall back to the <strong>free plan</strong>: 4 essential modules (Quick Analysis, Wealth, Watchlist, Knowledge Base) remain accessible for life.</li>
          <li><strong>Your data stays intact</strong> — wealth, past analyses, snapshots, etc. If you resubscribe later, you find everything.</li>
        </ul>
        <h3>How to cancel</h3>
        <ul>
          <li><strong>iPhone / iPad</strong>: iOS Settings → Apple ID → Subscriptions → Alpha → Cancel.</li>
          <li><strong>Android</strong>: Play Store → Profile → Payments & subscriptions → Subscriptions → Alpha → Cancel.</li>
          <li><strong>Web (PWA via Stripe)</strong>: Alpha Settings → My subscription → Manage → Cancel.</li>
        </ul>
        <h3>Refunds</h3>
        <p>Apple and Google handle refund requests on their platforms (standard 14-day policies). For Stripe, email <a href="mailto:savetheworldfr@gmail.com">savetheworldfr@gmail.com</a> within 14 days of the initial payment.</p>
        <h3>Try without paying</h3>
        <p>Demo mode lets you explore all modules with pre-generated analyses without any API key or payment. The Free plan also gives unlimited access to 4 essential modules with a free LLM key (GitHub Models, Cerebras, Mistral).</p>
      `
    }
  }
};

export function showTrustDetail(which) {
  const lang = getLocale() === 'en' ? 'en' : 'fr';
  const c = CONTENT[lang]?.[which] || CONTENT.fr[which];
  if (!c) return;
  showGenericModal(c.title, `<div class="trust-detail-body">${c.body}</div>`, { wide: true });
}

// Auto-bind global click handler — opens the modal when any trust-badge is clicked.
if (typeof document !== 'undefined' && !window.__trustDetailsWired) {
  window.__trustDetailsWired = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-trust]');
    if (!btn) return;
    e.preventDefault();
    showTrustDetail(btn.getAttribute('data-trust'));
  });
}
