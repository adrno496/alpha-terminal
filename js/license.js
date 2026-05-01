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

    // Active une clé de licence : validation FORMAT puis validation SERVEUR
    // via Lemonsqueezy License API. Sans le check serveur, n'importe quelle
    // UUID au format correct passerait — donc on refuse tant que
    // l'API n'a pas confirmé valid:true + status:active.
    async activateLicense(key) {
      if (!this.validateFormat(key)) {
        return {
          success: false,
          error: 'Format invalide. Utilise : XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
        };
      }

      const normalized = String(key).trim().toUpperCase();

      // Vérification serveur Lemonsqueezy AVANT de stocker quoi que ce soit
      let data;
      try {
        const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new URLSearchParams({ license_key: normalized })
        });
        data = await res.json();
      } catch (e) {
        return { success: false, error: 'Impossible de joindre Lemonsqueezy. Vérifie ta connexion.' };
      }

      if (!data || data.valid !== true) {
        return { success: false, error: 'Clé inconnue ou invalide. Vérifie l\'email reçu après l\'achat.' };
      }
      const status = data.license_key?.status;
      if (status !== 'active') {
        const map = {
          inactive: 'Clé inactive — non encore activée chez Lemonsqueezy.',
          expired: 'Clé expirée — l\'abonnement n\'est plus valide.',
          disabled: 'Clé désactivée — abonnement annulé ou remboursé.'
        };
        return { success: false, error: map[status] || `Clé non utilisable (statut : ${status}).` };
      }

      try {
        localStorage.setItem(this.storageKey, normalized);
        localStorage.setItem('isPremium', 'true');
        localStorage.setItem('alpha-license-checked-at', String(Date.now()));
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

    // Vérifie si une clé est active (présente + format valide).
    // Sync : utilisé par paywall._readCache(). Déclenche une revalidation
    // serveur en arrière-plan si le dernier check date > 24h — si la clé
    // a été révoquée côté Lemonsqueezy, logout() sera appelé et l'event
    // alpha:licenseRevoked rebasculera l'UI sur le paywall.
    isPremium() {
      const key = this.getLicense();
      if (!key || !this.validateFormat(key)) return false;
      const last = parseInt(localStorage.getItem('alpha-license-checked-at') || '0', 10);
      if (Date.now() - last > 24 * 3600 * 1000) {
        this.checkLicenseStatus(); // fire-and-forget
      }
      return true;
    }

    // Vérification serveur via Lemonsqueezy License API (CORS-friendly).
    // Appelée au boot + toutes les 24h depuis isPremium().
    // Comportement offline : 7 jours de grâce depuis le dernier check OK.
    async checkLicenseStatus() {
      const key = this.getLicense();
      if (!key || !this.validateFormat(key)) return false;
      try {
        const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new URLSearchParams({ license_key: key })
        });
        const data = await res.json();
        const status = data?.license_key?.status;
        const ok = data?.valid === true && status === 'active';
        if (!ok) {
          console.warn('[license] revoked/inactive (status=' + status + ') — logging out');
          this.logout();
          return false;
        }
        localStorage.setItem('alpha-license-checked-at', String(Date.now()));
        return true;
      } catch (e) {
        // Offline ou API down → grâce 7j depuis le dernier check OK
        const last = parseInt(localStorage.getItem('alpha-license-checked-at') || '0', 10);
        const within = last > 0 && (Date.now() - last) < 7 * 24 * 3600 * 1000;
        if (!within) {
          console.warn('[license] cannot validate and grace period expired — logging out');
          this.logout();
          return false;
        }
        return true;
      }
    }

    // Logout : supprime la licence
    logout() {
      try {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('isPremium');
        localStorage.removeItem('alpha-license-checked-at');
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
    async activateFromInput() {
      const input = document.getElementById('license-input');
      const errorEl = document.getElementById('license-error');
      const successEl = document.getElementById('license-success');
      if (!input || !errorEl || !successEl) return;

      errorEl.innerText = '';
      successEl.innerText = '⏳ Vérification auprès de Lemonsqueezy…';

      const result = await this.activateLicense(input.value);

      if (result.success) {
        successEl.innerText = result.message;
        input.value = '';
        setTimeout(() => {
          this.hideLicenseModal();
          location.reload(); // recharge pour appliquer toutes les UI
        }, 1500);
      } else {
        successEl.innerText = '';
        errorEl.innerText = '❌ ' + result.error;
      }
    }
  }

  window.licenseManager = new LicenseManager();
})();
