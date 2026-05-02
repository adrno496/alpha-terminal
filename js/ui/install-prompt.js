// Install App prompt — PWA install pour Android/Chrome + tutoriel iOS/Safari.
//
// Comportement :
// - Affiche un mini-banner en bas de l'écran après 3s
// - Si Android/Chrome : capture beforeinstallprompt, déclenche l'install natif
// - Si iOS Safari : affiche un tutoriel "Partager → Ajouter à l'écran d'accueil"
// - Cache le banner si l'app est déjà installée (display-mode: standalone)
// - Mémorise le dismiss pendant 7 jours (localStorage)
// - Re-prompte 1× / mois si l'user a juste fermé sans installer

(function () {
  'use strict';

  const DISMISS_KEY = 'alpha-install-prompt-dismissed';
  const DISMISS_DAYS = 7;
  const DELAY_MS = 3000;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }
  function isMobile() {
    return isIOS() || isAndroid() || /Mobi/i.test(navigator.userAgent);
  }
  function isEN() {
    try { return (document.documentElement.lang || 'fr').toLowerCase().startsWith('en'); }
    catch { return false; }
  }
  function recentlyDismissed() {
    try {
      const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return ts > 0 && (Date.now() - ts) < DISMISS_DAYS * 24 * 3600 * 1000;
    } catch { return false; }
  }
  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  }

  let deferredPrompt = null;

  // Android / Chrome capture native install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!recentlyDismissed() && !isStandalone()) {
      setTimeout(() => showBanner('android'), DELAY_MS);
    }
  });

  // iOS — pas d'event beforeinstallprompt, on déclenche manuellement
  document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone() || recentlyDismissed()) return;
    if (isIOS()) setTimeout(() => showBanner('ios'), DELAY_MS);
    // Android : on attend beforeinstallprompt (peut prendre 1-30s selon Chrome)
    // En cas d'absence (PWA déjà installée puis désinstallée → l'event ne refire pas
    // toujours immédiatement), on pousse aussi un fallback générique sur mobile
    // après 6s s'il n'y a toujours rien.
    if (isAndroid()) {
      setTimeout(() => {
        if (!deferredPrompt && !document.getElementById('install-banner')) {
          showBanner('android-fallback');
        }
      }, 6000);
    }
  });

  function injectStyles() {
    if (document.getElementById('install-banner-styles')) return;
    const css = `
      #install-banner {
        position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 99999;
        max-width: 480px; margin: 0 auto;
        background: linear-gradient(135deg, #0d0d0d, #1a1a1a);
        border: 1px solid #00ff88;
        border-radius: 14px; padding: 16px 18px;
        box-shadow: 0 12px 40px rgba(0,255,136,0.18), 0 4px 16px rgba(0,0,0,0.55);
        color: #fff; font-family: 'Inter', system-ui, sans-serif; font-size: 14px;
        animation: ib-slide 0.32s ease-out;
      }
      @keyframes ib-slide { from { transform: translateY(120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      #install-banner.closing { animation: ib-slide-out 0.25s ease-in forwards; }
      @keyframes ib-slide-out { to { transform: translateY(120%); opacity: 0; } }
      .ib-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
      .ib-icon { width: 38px; height: 38px; border-radius: 9px; background: #00ff88; color: #000; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; flex-shrink: 0; }
      .ib-title { font-weight: 700; font-size: 15px; line-height: 1.2; }
      .ib-sub { font-size: 12px; color: #aaa; margin-top: 2px; line-height: 1.35; }
      .ib-close { margin-left: auto; background: transparent; border: 0; color: #888; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1; }
      .ib-close:hover { color: #fff; }
      .ib-body { font-size: 13px; line-height: 1.55; color: #ccc; }
      .ib-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
      .ib-btn { background: #00ff88; color: #000; padding: 10px 18px; border-radius: 7px; border: 0; font-weight: 700; font-size: 13px; cursor: pointer; flex: 1; min-width: 130px; }
      .ib-btn:hover { background: #00cc6a; }
      .ib-btn.secondary { background: transparent; border: 1px solid #444; color: #ccc; }
      .ib-btn.secondary:hover { border-color: #888; color: #fff; }
      .ib-ios-steps { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; margin: 8px 0; font-size: 12.5px; line-height: 1.6; }
      .ib-ios-steps strong { color: #00ff88; display: inline-block; min-width: 16px; }
      .ib-ios-icon { display: inline-block; padding: 1px 6px; border: 1px solid #555; border-radius: 4px; font-size: 14px; vertical-align: middle; }
      @media (max-width: 380px) { .ib-btn { font-size: 12px; padding: 9px 12px; min-width: 110px; } }
    `;
    const s = document.createElement('style');
    s.id = 'install-banner-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function showBanner(mode) {
    if (document.getElementById('install-banner')) return;
    if (isStandalone()) return;
    injectStyles();

    const en = isEN();
    const t = en ? {
      title: 'Install Alpha as an app',
      sub: 'Faster access · Works offline · Native feel',
      iosBody: 'Install Alpha on your iPhone in 3 steps:',
      step1: 'Tap the <span class="ib-ios-icon">🔗</span> Share button (bottom of Safari)',
      step2: 'Scroll and tap <strong>« Add to Home Screen »</strong>',
      step3: 'Tap <strong>Add</strong> in the top right',
      androidBody: 'Add Alpha to your home screen for instant access, even offline.',
      installBtn: '📲 Install',
      gotIt: 'Got it',
      later: 'Later',
      androidFallback: 'On Android: open this site in Chrome, tap the menu (⋮) and select <strong>« Install app »</strong>.'
    } : {
      title: 'Installer Alpha en app',
      sub: 'Accès rapide · Hors ligne · Comme une vraie app',
      iosBody: 'Installer Alpha sur ton iPhone en 3 étapes :',
      step1: 'Appuie sur le bouton <span class="ib-ios-icon">🔗</span> Partager (bas de Safari)',
      step2: 'Descends et choisis <strong>« Sur l\'écran d\'accueil »</strong>',
      step3: 'Appuie sur <strong>Ajouter</strong> en haut à droite',
      androidBody: 'Ajoute Alpha à ton écran d\'accueil pour un accès instantané, même hors-ligne.',
      installBtn: '📲 Installer',
      gotIt: 'C\'est noté',
      later: 'Plus tard',
      androidFallback: 'Sur Android : ouvre ce site dans Chrome, appuie sur le menu (⋮) et choisis <strong>« Installer l\'application »</strong>.'
    };

    const el = document.createElement('div');
    el.id = 'install-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'ib-title');

    let bodyHTML, actionsHTML;

    if (mode === 'ios') {
      bodyHTML = `
        <div class="ib-body">${t.iosBody}</div>
        <div class="ib-ios-steps">
          <strong>1.</strong> ${t.step1}<br>
          <strong>2.</strong> ${t.step2}<br>
          <strong>3.</strong> ${t.step3}
        </div>
      `;
      actionsHTML = `
        <button class="ib-btn" id="ib-got-it">${t.gotIt}</button>
        <button class="ib-btn secondary" id="ib-close-2">${t.later}</button>
      `;
    } else if (mode === 'android-fallback') {
      bodyHTML = `<div class="ib-body">${t.androidFallback}</div>`;
      actionsHTML = `<button class="ib-btn" id="ib-got-it">${t.gotIt}</button>`;
    } else {
      // android (native prompt available)
      bodyHTML = `<div class="ib-body">${t.androidBody}</div>`;
      actionsHTML = `
        <button class="ib-btn" id="ib-install">${t.installBtn}</button>
        <button class="ib-btn secondary" id="ib-close-2">${t.later}</button>
      `;
    }

    el.innerHTML = `
      <div class="ib-head">
        <div class="ib-icon">α</div>
        <div>
          <div class="ib-title" id="ib-title">${t.title}</div>
          <div class="ib-sub">${t.sub}</div>
        </div>
        <button class="ib-close" aria-label="Close" id="ib-close">×</button>
      </div>
      ${bodyHTML}
      <div class="ib-actions">${actionsHTML}</div>
    `;

    document.body.appendChild(el);

    function close() {
      el.classList.add('closing');
      setTimeout(() => { try { el.remove(); } catch {} }, 260);
      markDismissed();
      try { window.plausible && window.plausible('PWA+Prompt+Dismiss'); } catch {}
    }

    el.querySelector('#ib-close').addEventListener('click', close);
    const close2 = el.querySelector('#ib-close-2');
    if (close2) close2.addEventListener('click', close);
    const gotIt = el.querySelector('#ib-got-it');
    if (gotIt) gotIt.addEventListener('click', close);

    const installBtn = el.querySelector('#ib-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) { close(); return; }
        try {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          try {
            window.plausible && window.plausible(
              choice.outcome === 'accepted' ? 'PWA+Install+Accepted' : 'PWA+Install+Dismissed'
            );
          } catch {}
        } catch {}
        deferredPrompt = null;
        close();
      });
    }
  }

  // Détecte un install réussi (même si déclenché depuis le menu Chrome)
  window.addEventListener('appinstalled', () => {
    try { window.plausible && window.plausible('PWA+Installed'); } catch {}
    markDismissed();
    const banner = document.getElementById('install-banner');
    if (banner) banner.remove();
  });
})();
