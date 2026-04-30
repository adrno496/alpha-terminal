// Notifications unifiées : Web Notification API + Capacitor LocalNotifications.
// Fallback automatique selon la plateforme.

const PERMISSION_KEY = 'alpha-terminal:notifications:permission-asked';

function isCapacitor() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function getCapacitorLN() {
  return window.Capacitor?.Plugins?.LocalNotifications;
}

// Demande la permission au user (1 seule fois). Pas de spam : on stocke un flag.
export async function requestNotificationPermission({ force = false } = {}) {
  // Capacitor (Android/iOS natif)
  if (isCapacitor()) {
    const LN = getCapacitorLN();
    if (!LN) {
      console.warn('[notifications] @capacitor/local-notifications plugin not installed');
      return 'unsupported';
    }
    try {
      const r = await LN.requestPermissions();
      return r.display === 'granted' ? 'granted' : 'denied';
    } catch (e) {
      console.warn('[notifications] LN permission failed:', e);
      return 'denied';
    }
  }
  // Web Notification API (PWA + browser)
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied' && !force) return 'denied';
  try {
    const result = await Notification.requestPermission();
    localStorage.setItem(PERMISSION_KEY, '1');
    return result;
  } catch {
    return 'denied';
  }
}

export function getNotificationPermission() {
  if (isCapacitor()) {
    return getCapacitorLN() ? 'unknown' : 'unsupported';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Affiche une notif système. Body optionnel.
//   options : { body, icon, tag, requireInteraction, onClick }
export async function showNotification(title, options = {}) {
  const { body = '', icon, tag, requireInteraction = false, onClick = null } = options;

  // Capacitor
  if (isCapacitor()) {
    const LN = getCapacitorLN();
    if (!LN) {
      console.warn('[notifications] LN missing — fallback toast in-app');
      return false;
    }
    try {
      await LN.schedule({
        notifications: [{
          id: Date.now() % 2147483647,
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) },
          smallIcon: 'ic_stat_icon_config_sample',
          actionTypeId: tag || 'DEFAULT'
        }]
      });
      return true;
    } catch (e) {
      console.warn('[notifications] LN schedule failed:', e);
      return false;
    }
  }

  // Web Notification
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') {
    const p = await requestNotificationPermission();
    if (p !== 'granted') return false;
  }
  try {
    const n = new Notification(title, { body, icon, tag, requireInteraction });
    if (onClick) n.onclick = (e) => { try { window.focus(); } catch {} onClick(e); };
    return true;
  } catch (e) {
    console.warn('[notifications] new Notification failed:', e);
    return false;
  }
}

// Notif spécifique pour une alerte prix triggered
export async function notifyPriceAlert(alert) {
  const sym = ({ USD: '$', EUR: '€', GBP: '£' })[alert.currency] || alert.currency;
  const arrow = alert.direction === 'above' ? '↑' : '↓';
  const kind = alert.kind === 'entry' ? '🎯 Entrée' : alert.kind === 'exit' ? '💰 Sortie' : '🛑 Stop';
  const title = `🚨 ${alert.ticker} ${arrow} ${alert.targetPrice}${sym}`;
  const body = `${kind} déclenchée — observé ${alert.lastObservedPrice ? alert.lastObservedPrice.toFixed(2) + sym : '—'}`;
  return showNotification(title, {
    body,
    tag: 'alert-' + alert.id,
    requireInteraction: true,
    onClick: () => { location.hash = '#price-alerts'; }
  });
}
