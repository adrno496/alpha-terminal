// Alpha Terminal — Lemonsqueezy checkout
// Ouvre le checkout hosted Lemonsqueezy avec custom_data.user_id pour
// que le webhook puisse activer le bon compte premium.
//
// Config attendue (par ordre de priorité) :
//   window.ALPHA_CONFIG.LEMONSQUEEZY_CHECKOUT_URL  ← buy permalink officiel (recommandé)
//   window.ALPHA_CONFIG.LEMONSQUEEZY_VARIANT_ID    ← fallback si pas de permalink

(function () {
  'use strict';

  const CFG = window.ALPHA_CONFIG || {};
  // 1. URL permalink directe (ex: https://alpha-terminal.lemonsqueezy.com/checkout/buy/<uuid>)
  //    C'est la méthode officielle Lemonsqueezy — la plus fiable.
  const CHECKOUT_URL = CFG.LEMONSQUEEZY_CHECKOUT_URL || '';
  // 2. Fallback : construit depuis variant_id si pas d'URL permalink fournie
  const VARIANT_ID = CFG.LEMONSQUEEZY_VARIANT_ID || '1599882';
  const BASE = CFG.LEMONSQUEEZY_CHECKOUT_BASE || 'https://transactions.lemonsqueezy.com/buy/';

  class LemonsqueezyCheckout {
    /**
     * Ouvre le checkout. Si pas connecté, demande d'abord le login pour
     * pouvoir injecter user_id dans custom_data (sinon impossible
     * d'associer le paiement au bon compte côté webhook).
     */
    async open() {
      if (!window.alphaAuth) {
        alert('Auth non initialisée — réessaie dans quelques secondes.');
        return;
      }
      await window.alphaAuth.ready();
      let user = await window.alphaAuth.getUser();

      // Si pas connecté → propose magic link puis demande de réessayer
      if (!user) {
        const en = (document.documentElement.lang || 'fr').toLowerCase().startsWith('en');
        const email = window.prompt(
          en
            ? 'To start your subscription, enter your email (we send a magic link to sign in):'
            : 'Pour démarrer l\'abonnement, entre ton email (on envoie un lien magique pour te connecter) :',
          ''
        );
        if (!email) return;
        try {
          await window.alphaAuth.sendMagicLink(email);
          alert(
            en
              ? '✅ Magic link sent. Click it in your email, then return here and click "Subscribe" again.'
              : '✅ Lien magique envoyé. Clique-le dans ton email, puis reviens ici et clique à nouveau "S\'abonner".'
          );
        } catch (e) {
          alert((en ? 'Error: ' : 'Erreur : ') + (e?.message || e));
        }
        return;
      }

      // Construit l'URL avec user_id en custom data (repris par le webhook)
      const params = new URLSearchParams();
      params.set('checkout[email]', user.email || '');
      params.set('checkout[custom][user_id]', user.id);

      // Utilise le permalink officiel si fourni, sinon fallback sur variant_id.
      const baseUrl = CHECKOUT_URL || `${BASE}${VARIANT_ID}`;
      const sep = baseUrl.includes('?') ? '&' : '?';
      const url = `${baseUrl}${sep}${params.toString()}`;
      window.open(url, '_blank', 'noopener,noreferrer');

      // Polling : après checkout, l'user revient — on rafraîchit le statut
      // 3 fois espacées de 5s pour attraper le webhook async.
      this._scheduleRefreshAfterCheckout();
    }

    _scheduleRefreshAfterCheckout() {
      let attempts = 0;
      const maxAttempts = 6;
      const intervalMs = 5000;
      const tick = async () => {
        attempts++;
        try {
          const isPremium = await window.alphaAuth.checkPremiumStatus(true);
          if (isPremium) return; // event alpha:premiumChanged déclenché par alphaAuth
        } catch {}
        if (attempts < maxAttempts) setTimeout(tick, intervalMs);
      };
      setTimeout(tick, intervalMs);
    }
  }

  window.lemonsqueezy = new LemonsqueezyCheckout();
})();
