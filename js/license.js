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
      this.instanceKey = 'alpha-license-instance-id';
      this.metaKey = 'alpha-license-meta'; // { expires_at, status, customer_email }
      this.portalUrl = 'https://alpha-terminal.lemonsqueezy.com/billing';
    }

    // Lit les métadonnées stockées de la dernière validation (status, expires_at, email)
    getMeta() {
      try { return JSON.parse(localStorage.getItem(this.metaKey) || 'null'); }
      catch { return null; }
    }
    _saveMeta(licenseObj) {
      if (!licenseObj) return;
      try {
        localStorage.setItem(this.metaKey, JSON.stringify({
          status: licenseObj.status || null,
          expires_at: licenseObj.expires_at || null,
          customer_email: licenseObj.customer_email || licenseObj.email || null,
        }));
      } catch {}
    }

    _instanceName() {
      // Identifiant lisible côté dashboard Lemonsqueezy (1 ligne par device)
      const ua = (navigator.userAgent || '').slice(0, 60);
      return `alpha-terminal-web · ${ua}`;
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
      let status = data.license_key?.status;

      // Une clé fraîche est "inactive" tant qu'on ne l'a pas activée sur une
      // instance. On le fait de manière transparente ici : POST /activate
      // avec un instance_name lisible (UA tronqué). L'instance_id retourné
      // est stocké pour pouvoir désactiver plus tard si besoin.
      if (status === 'inactive') {
        try {
          const actRes = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: new URLSearchParams({
              license_key: normalized,
              instance_name: this._instanceName()
            })
          });
          const actData = await actRes.json();
          if (!actData?.activated) {
            const errMsg = actData?.error || 'activation refusée';
            return { success: false, error: `Activation impossible : ${errMsg}. Limite d'appareils atteinte ?` };
          }
          if (actData.instance?.id) {
            try { localStorage.setItem(this.instanceKey, actData.instance.id); } catch {}
          }
          status = actData.license_key?.status || 'active';
        } catch (e) {
          return { success: false, error: 'Impossible d\'activer la clé chez Lemonsqueezy. Réessaie.' };
        }
      }

      if (status !== 'active') {
        const map = {
          expired: 'Clé expirée — l\'abonnement n\'est plus valide.',
          disabled: 'Clé désactivée — abonnement annulé ou remboursé.'
        };
        return { success: false, error: map[status] || `Clé non utilisable (statut : ${status}).` };
      }

      try {
        localStorage.setItem(this.storageKey, normalized);
        localStorage.setItem('isPremium', 'true');
        localStorage.setItem('alpha-license-checked-at', String(Date.now()));
        this._saveMeta(data?.license_key);
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
    // Politique : ne JAMAIS auto-logout sur erreur réseau / CORS / réponse
    // ambiguë — on ne logout que si Lemonsqueezy répond explicitement
    // `valid:false` ou status revoked. Une erreur transitoire ne doit pas
    // priver l'utilisateur de son accès Premium (clé déjà validée à l'achat).
    async checkLicenseStatus() {
      const key = this.getLicense();
      if (!key || !this.validateFormat(key)) return false;
      let data;
      try {
        const params = new URLSearchParams({ license_key: key });
        const instanceId = (() => { try { return localStorage.getItem(this.instanceKey); } catch { return null; } })();
        if (instanceId) params.set('instance_id', instanceId);
        const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: params
        });
        data = await res.json();
      } catch (e) {
        // Réseau / CORS / DNS — on conserve l'accès, on retentera plus tard
        console.warn('[license] check failed (network):', e?.message, '— keeping access');
        return true;
      }

      // Réponse reçue : on ne logout que si Lemonsqueezy dit explicitement non
      const status = data?.license_key?.status;
      if (data?.valid === false && (status === 'expired' || status === 'disabled')) {
        console.warn('[license] explicitly revoked by Lemonsqueezy (status=' + status + ') — logging out');
        this.logout();
        return false;
      }
      if (data?.valid === true && status === 'active') {
        localStorage.setItem('alpha-license-checked-at', String(Date.now()));
        this._saveMeta(data?.license_key);
        return true;
      }
      // Réponse ambiguë (status inactive, valid manquant, etc.) → on garde l'accès,
      // on prévient l'utilisateur dans les logs sans le couper.
      console.warn('[license] ambiguous response, keeping access:', data);
      return true;
    }

    // Logout : supprime la licence
    logout() {
      try {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('isPremium');
        localStorage.removeItem('alpha-license-checked-at');
        localStorage.removeItem(this.instanceKey);
        localStorage.removeItem(this.metaKey);
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
