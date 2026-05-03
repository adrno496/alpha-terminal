// Alpha Terminal — Auth (magic link Supabase)
// Aucune donnée d'analyse n'est envoyée. Sert uniquement à savoir
// QUI est connecté et SI le compte est premium (via premium_access).
//
// Dépendances : window.supabase (CDN @supabase/supabase-js@2)
//               window.ALPHA_CONFIG = { SUPABASE_URL, SUPABASE_ANON }

(function () {
  'use strict';

  const CFG = window.ALPHA_CONFIG || {};
  const PREMIUM_CACHE_KEY = 'alpha-terminal:premium-cache';

  class AlphaAuth {
    constructor() {
      this.client = null;
      this._user = null;
      this._readyPromise = this._init();
    }

    async _init() {
      // Attend que le SDK Supabase soit chargé (tag <script defer>)
      const supabase = window.supabase;
      if (!supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON) {
        console.warn('[auth] Supabase SDK ou config absente — paywall désactivé');
        return;
      }
      this.client = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON, {
        auth: {
          storage: window.localStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // capture le token du magic link au retour
        },
      });

      // Capture l'user au boot
      try {
        const { data } = await this.client.auth.getSession();
        this._user = data?.session?.user || null;
      } catch {}

      // Réagit aux changements de session (login, logout, refresh)
      this.client.auth.onAuthStateChange((_event, session) => {
        this._user = session?.user || null;
        // Refresh du cache premium quand le user change
        this.checkPremiumStatus(true).catch(() => {});
        window.dispatchEvent(new CustomEvent('alpha:authChanged', { detail: { user: this._user } }));
      });
    }

    async ready() {
      return this._readyPromise;
    }

    isInitialized() {
      return !!this.client;
    }

    // ---- Magic link ----
    async sendMagicLink(email) {
      await this.ready();
      if (!this.client) throw new Error('Supabase non configuré');
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Email invalide');
      // Détermine l'URL de redirection :
      // - En localhost (dev) → utilise quand même localhost (le user dev local lit son mail sur le même device)
      // - En prod (alpha-terminal.app, *.vercel.app, etc.) → utilise l'origin courant
      // - Override possible via window.ALPHA_CONFIG.AUTH_REDIRECT_URL
      const cfgRedirect = window.ALPHA_CONFIG?.AUTH_REDIRECT_URL;
      const isLocalhost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(window.location.hostname);
      const redirectTo = cfgRedirect
        || (isLocalhost ? 'https://alpha-terminal-sepia.vercel.app/' : window.location.origin + '/');
      const { error } = await this.client.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      return { ok: true, message: `Lien magique envoyé. Clique le lien dans ton email (redirection vers ${redirectTo}).` };
    }

    // ---- Getters ----
    async getUser() {
      await this.ready();
      if (!this.client) return null;
      const { data } = await this.client.auth.getUser();
      this._user = data?.user || null;
      return this._user;
    }

    async getJWT() {
      await this.ready();
      if (!this.client) return null;
      const { data } = await this.client.auth.getSession();
      return data?.session?.access_token || null;
    }

    isAuthenticated() {
      return !!this._user;
    }

    // ---- Premium status ----
    // Cache localStorage 5 min pour éviter de spammer Supabase à chaque navigation.
    isPremiumLocal() {
      try {
        const raw = localStorage.getItem(PREMIUM_CACHE_KEY);
        if (!raw) return false;
        const c = JSON.parse(raw);
        if (!c || !c.expiresAt) return false;
        return c.isPremium === true && new Date(c.expiresAt).getTime() > Date.now();
      } catch {
        return false;
      }
    }

    async checkPremiumStatus(force = false) {
      await this.ready();
      // Cache en mémoire 5 min sauf force
      const cacheRaw = localStorage.getItem(PREMIUM_CACHE_KEY);
      const cache = cacheRaw ? JSON.parse(cacheRaw) : null;
      if (!force && cache && (Date.now() - (cache.fetchedAt || 0)) < 5 * 60 * 1000) {
        return this.isPremiumLocal();
      }

      if (!this.client || !this._user) {
        this._writeCache(false, null);
        return false;
      }

      try {
        // Lecture via PostgREST + JWT (RLS filtre par auth.uid())
        const { data, error } = await this.client
          .from('premium_access')
          .select('is_active, subscription_expires_at')
          .eq('user_id', this._user.id)
          .maybeSingle();
        if (error) throw error;

        const isActive = !!(
          data &&
          data.is_active &&
          data.subscription_expires_at &&
          new Date(data.subscription_expires_at).getTime() > Date.now()
        );
        this._writeCache(isActive, data?.subscription_expires_at || null);
        window.dispatchEvent(
          new CustomEvent('alpha:premiumChanged', { detail: { isPremium: isActive } })
        );
        return isActive;
      } catch (e) {
        console.warn('[auth] checkPremiumStatus failed:', e?.message || e);
        return this.isPremiumLocal();
      }
    }

    _writeCache(isPremium, expiresAt) {
      try {
        localStorage.setItem(
          PREMIUM_CACHE_KEY,
          JSON.stringify({
            isPremium: !!isPremium,
            expiresAt: expiresAt || (isPremium ? new Date(Date.now() + 86400000).toISOString() : null),
            fetchedAt: Date.now(),
          })
        );
      } catch {}
    }

    // ---- Logout ----
    async logout() {
      try {
        if (this.client) await this.client.auth.signOut();
      } catch {}
      try {
        localStorage.removeItem(PREMIUM_CACHE_KEY);
      } catch {}
      this._user = null;
      window.dispatchEvent(new CustomEvent('alpha:authChanged', { detail: { user: null } }));
      window.dispatchEvent(new CustomEvent('alpha:premiumChanged', { detail: { isPremium: false } }));
    }
  }

  window.alphaAuth = new AlphaAuth();
})();
