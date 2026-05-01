// Alpha Terminal — Paywall manager
// Bloque les modules Pro pour les comptes non-premium et affiche un modal
// d'upsell. Hooké dans js/modules/_shared.js:runAnalysis() — point d'entrée
// unique pour tous les modules LLM.
//
// Free  : quick-analysis · wealth · watchlist · knowledge-base
//        + tous les modules sans appel LLM (budget, csv-import, correlation-matrix,
//          watchpoints, accounts-view, goals, dividends-tracker, price-alerts, etc.)
// Pro   : tout le reste (decoder-10k, dcf, audit Buffett, fiscal, sentiment, etc.)

(function () {
  'use strict';

  // ---- Modules accessibles sans Premium ----
  const FREE_MODULES = new Set([
    // Always-visible (sidebar primaire)
    'quick-analysis',
    'wealth',
    'watchlist',
    'knowledge-base',
    // Modules locaux sans LLM (déjà gratuits car n'appellent pas runAnalysis)
    'budget',
    'csv-import',
    'correlation-matrix',
    'watchpoints',
    'accounts-view',
    'goals',
    'dividends-tracker',
    'price-alerts',
    'subscriptions-detector',
    'capital-gains-tracker',
    'multi-currency-pnl',
    'diversification-score',
    'fear-greed',
    'projection',
  ]);

  function isEN() {
    try {
      return (document.documentElement.lang || 'fr').toLowerCase().startsWith('en');
    } catch {
      return false;
    }
  }

  // ⚠️ PAYWALL DÉSACTIVÉ TEMPORAIREMENT
  // Le système de magic link Supabase est mis en pause. Migration en cours
  // vers Lemonsqueezy License Keys. Tant que le flow license n'est pas
  // implémenté, l'app reste 100% accessible (pas de blocage modules, pas de
  // cadenas sidebar, pas de bouton login).
  const PAYWALL_DISABLED = true;

  class PaywallManager {
    constructor() {
      this.isPremium = false;
      // Refresh dès que l'auth signale un changement
      window.addEventListener('alpha:premiumChanged', (e) => {
        this.isPremium = !!(e?.detail?.isPremium);
      });
      window.addEventListener('alpha:authChanged', () => this.refresh());
    }

    isModuleFree(moduleId) {
      return FREE_MODULES.has(moduleId);
    }

    canAccess(moduleId) {
      if (PAYWALL_DISABLED) return true;
      if (!moduleId) return true;
      if (this.isModuleFree(moduleId)) return true;
      return this._readCache();
    }

    _readCache() {
      if (PAYWALL_DISABLED) return true;
      // Source de vérité = alphaAuth.isPremiumLocal() (cache validé)
      try {
        return !!(window.alphaAuth && window.alphaAuth.isPremiumLocal());
      } catch {
        return false;
      }
    }

    async refresh() {
      try {
        if (!window.alphaAuth) return;
        await window.alphaAuth.ready();
        this.isPremium = await window.alphaAuth.checkPremiumStatus(true);
      } catch (e) {
        console.warn('[paywall] refresh failed:', e?.message);
      }
    }

    /** Injecte le modal paywall dans le container du module. */
    blockUI(container, moduleId) {
      if (!container) return;
      const en = isEN();
      const t = en
        ? {
            title: '🔒 Premium feature',
            sub: `<strong>${moduleId}</strong> requires an active Premium subscription.`,
            price: '€9.99 / month',
            login: '🔑 Sign in with magic link',
            signup: '🚀 Subscribe €9.99/month',
            bullets: [
              '✅ Unlimited access to all 56 Pro modules',
              '✅ Your analyses stay 100% local (BYOK)',
              '✅ Cancel anytime',
            ],
            already: 'Already subscribed?',
            refresh: 'Refresh status',
          }
        : {
            title: '🔒 Module Premium',
            sub: `<strong>${moduleId}</strong> nécessite un abonnement Premium actif.`,
            price: '9,99 € / mois',
            login: '🔑 Se connecter (lien magique)',
            signup: '🚀 S\'abonner 9,99€/mois',
            bullets: [
              '✅ Accès illimité aux 56 modules Pro',
              '✅ Tes analyses restent 100% locales (BYOK)',
              '✅ Annulable à tout moment',
            ],
            already: 'Déjà abonné ?',
            refresh: 'Rafraîchir le statut',
          };

      const isAuthed = !!(window.alphaAuth && window.alphaAuth.isAuthenticated());

      container.innerHTML = `
        <div class="paywall-modal" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
          <div class="paywall-content">
            <h3 id="paywall-title">${t.title}</h3>
            <p class="paywall-sub">${t.sub}</p>
            <div class="paywall-price">${t.price}</div>
            <div class="paywall-actions">
              ${
                isAuthed
                  ? `<button type="button" class="paywall-btn" data-paywall-action="checkout">${t.signup}</button>`
                  : `<button type="button" class="paywall-btn" data-paywall-action="login">${t.login}</button>
                     <button type="button" class="paywall-btn paywall-btn-secondary" data-paywall-action="checkout">${t.signup}</button>`
              }
            </div>
            <ul class="paywall-info">
              ${t.bullets.map((b) => `<li>${b}</li>`).join('')}
            </ul>
            <p class="paywall-info-line">
              ${t.already} <a href="#" data-paywall-action="refresh">${t.refresh}</a>
            </p>
          </div>
        </div>
      `;

      // Wire actions
      container.querySelectorAll('[data-paywall-action]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          const action = btn.getAttribute('data-paywall-action');
          if (action === 'checkout') {
            if (window.lemonsqueezy) window.lemonsqueezy.open();
          } else if (action === 'login') {
            this.promptLogin();
          } else if (action === 'refresh') {
            this.refresh().then(() => {
              if (this._readCache()) {
                // Recharge la vue pour relancer le module débloqué
                location.reload();
              } else {
                btn.textContent = (en ? 'Still locked' : 'Toujours verrouillé') + ' ✗';
              }
            });
          }
        });
      });
    }

    /** Petit prompt natif pour saisir l'email du magic link. */
    async promptLogin() {
      const en = isEN();
      const email = window.prompt(
        en
          ? 'Enter your email to receive a magic link:'
          : 'Entre ton email pour recevoir un lien magique :',
        ''
      );
      if (!email) return;
      try {
        await window.alphaAuth.sendMagicLink(email);
        alert(
          en
            ? '✅ Magic link sent. Check your inbox (and spam folder).'
            : '✅ Lien magique envoyé. Vérifie ta boîte mail (et les spams).'
        );
      } catch (e) {
        alert((en ? 'Error: ' : 'Erreur : ') + (e?.message || e));
      }
    }
  }

  window.paywall = new PaywallManager();

  // Init premium state au boot (non-bloquant)
  if (window.alphaAuth) {
    window.alphaAuth.ready().then(() => window.paywall.refresh());
  }
})();
