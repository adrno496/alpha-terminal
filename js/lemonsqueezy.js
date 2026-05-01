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
     * Ouvre directement le checkout Lemonsqueezy. Pas d'auth requise — la
     * licence achetée est envoyée par email après paiement, l'utilisateur
     * la colle ensuite dans le modal "J'ai déjà une clé".
     */
    open() {
      const baseUrl = CHECKOUT_URL || `${BASE}${VARIANT_ID}`;
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    }
  }

  window.lemonsqueezy = new LemonsqueezyCheckout();
})();
