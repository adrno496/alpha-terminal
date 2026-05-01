// Alpha Terminal — License Manager
// Validation client-side d'une clé de licence Lemonsqueezy au format UUID :
// XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
//
// Stockage : localStorage (clé chiffrée par le navigateur via Web Storage API).
// Aucun appel serveur — la possession de la clé suffit. La sécurité repose sur
// la confidentialité de la clé envoyée à l'acheteur par email Lemonsqueezy.

(function () {
  'use strict';

  class LicenseManager {
    constructor() {
      this.storageKey = 'alpha-license-key';
    }

    // Valide le format UUID 8-4-4-4-12 hex (case-insensitive)
    validateFormat(key) {
      const pattern = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i;
      return pattern.test(String(key || '').trim());
    }

    // Active une clé de licence (validation format uniquement)
    activateLicense(key) {
      if (!this.validateFormat(key)) {
        return {
          success: false,
          error: 'Format invalide. Utilise : XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
        };
      }

      const normalized = String(key).trim().toUpperCase();
      try {
        localStorage.setItem(this.storageKey, normalized);
        localStorage.setItem('isPremium', 'true');
      } catch (e) {
        return { success: false, error: 'Impossible d\'enregistrer la clé localement.' };
      }

      // Broadcast pour que paywall + sidebar se rafraîchissent immédiatement
      window.dispatchEvent(new CustomEvent('alpha:licenseActivated', {
        detail: { key: normalized }
      }));
      window.dispatchEvent(new CustomEvent('alpha:premiumChanged', {
        detail: { isPremium: true }
      }));

      return {
        success: true,
        message: '✅ Clé de licence activée — modules Premium débloqués.'
      };
    }

    // Récupère la clé stockée
    getLicense() {
      try { return localStorage.getItem(this.storageKey); }
      catch { return null; }
    }

    // Vérifie si une clé est active (présente + format valide)
    isPremium() {
      const key = this.getLicense();
      return !!key && this.validateFormat(key);
    }

    // Logout : supprime la licence
    logout() {
      try {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('isPremium');
      } catch {}
      window.dispatchEvent(new CustomEvent('alpha:licenseRevoked'));
      window.dispatchEvent(new CustomEvent('alpha:premiumChanged', {
        detail: { isPremium: false }
      }));
    }

    // Affiche le modal de licence
    showLicenseModal() {
      const modal = document.getElementById('license-modal');
      if (!modal) return;
      modal.style.display = 'flex';
      const input = document.getElementById('license-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
      }
      // Reset messages
      const errorEl = document.getElementById('license-error');
      const successEl = document.getElementById('license-success');
      if (errorEl) errorEl.innerText = '';
      if (successEl) successEl.innerText = '';
    }

    // Cache le modal
    hideLicenseModal() {
      const modal = document.getElementById('license-modal');
      if (modal) modal.style.display = 'none';
    }

    // Active depuis l'input du modal
    activateFromInput() {
      const input = document.getElementById('license-input');
      const errorEl = document.getElementById('license-error');
      const successEl = document.getElementById('license-success');
      if (!input || !errorEl || !successEl) return;

      errorEl.innerText = '';
      successEl.innerText = '';

      const result = this.activateLicense(input.value);

      if (result.success) {
        successEl.innerText = result.message;
        input.value = '';
        setTimeout(() => {
          this.hideLicenseModal();
          location.reload(); // recharge pour appliquer toutes les UI
        }, 1500);
      } else {
        errorEl.innerText = '❌ ' + result.error;
      }
    }
  }

  window.licenseManager = new LicenseManager();
})();
