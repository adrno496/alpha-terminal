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

  class PaywallManager {
    constructor() {
      this.isPremium = false;
      // Refresh dès qu'une licence est activée/révoquée
      window.addEventListener('alpha:premiumChanged', (e) => {
        this.isPremium = !!(e?.detail?.isPremium);
      });
      window.addEventListener('alpha:licenseActivated', () => { this.isPremium = true; });
      window.addEventListener('alpha:licenseRevoked', () => { this.isPremium = false; });
    }

    isModuleFree(moduleId) {
      return FREE_MODULES.has(moduleId);
    }

    canAccess(moduleId) {
      if (!moduleId) return true;
      if (this.isModuleFree(moduleId)) return true;
      return this._readCache();
    }

    // Source de vérité (par ordre) :
    //   1. License Key Lemonsqueezy active (window.licenseManager.isPremium)
    //   2. Fallback Supabase magic link (legacy, en cours de dépréciation)
    _readCache() {
      try {
        if (window.licenseManager && window.licenseManager.isPremium()) return true;
      } catch {}
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

    /** Bloque l'accès au module et propose à l'utilisateur soit d'acheter,
     *  soit d'entrer une licence existante. Affiche un placeholder dans le
     *  container + ouvre le modal de licence Lemonsqueezy. */
    blockUI(container, moduleId) {
      const en = isEN();
      const LIFETIME_URL = 'https://alpha-terminal.lemonsqueezy.com/checkout/buy/bc77ee76-8202-4df6-8093-f353576c3f0b';
      // Échappe moduleId — vient de userland (URL hash ou config), peut contenir du HTML
      const safeId = String(moduleId || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const t = en
        ? {
            title: '🔒 Premium module',
            sub: `<strong>${safeId}</strong> requires an active Premium license.`,
            monthlyLabel: 'Monthly',
            monthlyPrice: '€9.99/month',
            lifetimeLabel: 'Lifetime · best value',
            lifetimePrice: '€299 once',
            buyBtn: '🚀 Subscribe €9.99/month',
            lifetimeBtn: '♾️ Get lifetime access €299',
            keyBtn: '🔑 I have a license key',
            bullets: [
              '✅ Unlimited access to all Pro modules',
              '✅ Your analyses stay 100% local (BYOK)',
              '✅ Cancel anytime · Lifetime breaks even after 30 months',
            ],
          }
        : {
            title: '🔒 Module Premium',
            sub: `<strong>${safeId}</strong> nécessite une licence Premium active.`,
            monthlyLabel: 'Mensuel',
            monthlyPrice: '9,99€/mois',
            lifetimeLabel: 'À vie · meilleure valeur',
            lifetimePrice: '299€ paiement unique',
            buyBtn: '🚀 S\'abonner 9,99€/mois',
            lifetimeBtn: '♾️ Accès à vie 299€',
            keyBtn: '🔑 J\'ai déjà une clé',
            bullets: [
              '✅ Accès illimité aux modules Pro',
              '✅ Tes analyses restent 100% locales (BYOK)',
              '✅ Annulable à tout moment · À vie rentabilisé en 30 mois',
            ],
          };

      // Placeholder dans le container du module
      if (container) {
        container.innerHTML = `
          <div class="paywall-modal" role="dialog" aria-modal="false" aria-labelledby="paywall-title">
            <div class="paywall-content">
              <h3 id="paywall-title">${t.title}</h3>
              <p class="paywall-sub">${t.sub}</p>
              <div class="paywall-plans" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin:14px 0;">
                <div style="border:1px solid var(--border);border-radius:8px;padding:14px 18px;min-width:180px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${t.monthlyLabel}</div>
                  <div style="font-size:22px;font-weight:700;margin:4px 0 10px;">${t.monthlyPrice}</div>
                  <button type="button" class="paywall-btn" data-paywall-action="checkout" style="width:100%;">${t.buyBtn}</button>
                </div>
                <div style="border:2px solid var(--accent-green);border-radius:8px;padding:14px 18px;min-width:180px;position:relative;">
                  <div style="font-size:11px;color:var(--accent-green);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${t.lifetimeLabel}</div>
                  <div style="font-size:22px;font-weight:700;margin:4px 0 10px;">${t.lifetimePrice}</div>
                  <a href="${LIFETIME_URL}" target="_blank" rel="noopener" class="paywall-btn" style="width:100%;text-decoration:none;display:block;text-align:center;box-sizing:border-box;">${t.lifetimeBtn}</a>
                </div>
              </div>
              <div style="text-align:center;margin:6px 0 14px;">
                <button type="button" class="paywall-btn paywall-btn-secondary" data-paywall-action="enter-key">${t.keyBtn}</button>
              </div>
              <ul class="paywall-info">
                ${t.bullets.map((b) => `<li>${b}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;
        container.querySelectorAll('[data-paywall-action]').forEach((btn) => {
          btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            const action = btn.getAttribute('data-paywall-action');
            if (action === 'checkout' && window.lemonsqueezy) {
              window.lemonsqueezy.open();
            } else if (action === 'enter-key' && window.licenseManager) {
              window.licenseManager.showLicenseModal();
            }
          });
        });
      }

      // Si pas de container (cas Mode avancé), ouvre directement le modal de licence
      if (!container && window.licenseManager) {
        window.licenseManager.showLicenseModal();
      }
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
