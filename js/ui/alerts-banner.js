// UI globale des alertes prix : badge sidebar + bannière home + check automatique au boot.
import { listPriceAlerts, checkPriceAlerts, dismissAlert, savePriceAlert } from '../core/price-alerts.js';
import { getLocale } from '../core/i18n.js';

const ALERT_CHECK_KEY = 'alpha-terminal:alerts:last-check';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h entre les checks auto

// Run au boot : vérifie les alertes si pas fait dans la dernière heure.
export async function bootAlertCheck({ force = false } = {}) {
  const last = parseInt(localStorage.getItem(ALERT_CHECK_KEY) || '0', 10);
  if (!force && Date.now() - last < CHECK_INTERVAL_MS) return null;
  try {
    const result = await checkPriceAlerts();
    localStorage.setItem(ALERT_CHECK_KEY, String(Date.now()));
    if (result.triggered.length > 0) {
      window.dispatchEvent(new CustomEvent('app:alerts-updated'));
    }
    return result;
  } catch (e) {
    console.warn('[alerts] boot check failed:', e);
    return null;
  }
}

// Met à jour le badge sur le bouton sidebar (Insights ou un placeholder dédié).
export async function updateAlertBadge() {
  const triggered = await listPriceAlerts({ status: 'triggered' });
  const count = triggered.length;

  // Badge sur l'item sidebar "price-alerts" (créé plus bas) — ou fallback sur le logo
  const sidebarBtn = document.querySelector('.sidebar-link[data-route="price-alerts"]');
  if (sidebarBtn) {
    let badge = sidebarBtn.querySelector('.alert-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'alert-badge';
        badge.style.cssText = 'display:inline-block;background:var(--accent-red);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:6px;animation:pulse 1.5s infinite;';
        sidebarBtn.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  // Voyant rouge global : indicateur fixe en haut à droite de la topbar
  let dot = document.getElementById('global-alert-dot');
  if (count > 0) {
    if (!dot) {
      dot = document.createElement('button');
      dot.id = 'global-alert-dot';
      dot.title = '';
      dot.style.cssText = 'position:relative;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--accent-red);color:#fff;border:0;border-radius:14px;font-size:11px;font-weight:600;font-family:var(--font-mono);cursor:pointer;animation:pulse 1.5s infinite;margin-right:8px;';
      const right = document.querySelector('.topbar-right');
      if (right) right.insertBefore(dot, right.firstChild);
      dot.addEventListener('click', () => { location.hash = '#price-alerts'; });
    }
    const isEN = getLocale() === 'en';
    dot.innerHTML = `🚨 ${count} ${isEN ? (count > 1 ? 'alerts' : 'alert') : 'alerte' + (count > 1 ? 's' : '')}`;
    dot.title = isEN ? 'Click to view triggered price alerts' : 'Cliquer pour voir les alertes déclenchées';
  } else if (dot) {
    dot.remove();
  }

  // Inject CSS animation pulse une fois
  if (!document.getElementById('global-alert-styles')) {
    const style = document.createElement('style');
    style.id = 'global-alert-styles';
    style.textContent = `
      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      .alert-badge { animation: pulse 1.5s infinite; }
    `;
    document.head.appendChild(style);
  }
  return count;
}

// Bannière d'alerte sur le home (au-dessus de tout)
export async function buildHomeAlertBanner() {
  const triggered = await listPriceAlerts({ status: 'triggered' });
  if (triggered.length === 0) return '';
  const isEN = getLocale() === 'en';
  return `
    <div class="card" style="border:2px solid var(--accent-red);background:rgba(255,51,85,0.08);padding:14px 18px;margin-bottom:14px;animation:pulse 2s infinite;">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="font-size:18px;font-weight:700;color:var(--accent-red);margin-bottom:6px;">🚨 ${triggered.length} ${isEN ? (triggered.length > 1 ? 'price alerts triggered!' : 'price alert triggered!') : 'alerte' + (triggered.length > 1 ? 's' : '') + ' prix déclenchée' + (triggered.length > 1 ? 's' : '') + ' !'}</div>
          <ul style="margin:6px 0 0 18px;padding:0;line-height:1.6;font-size:13px;">
            ${triggered.slice(0, 5).map(a => {
              const sym = ({ USD: '$', EUR: '€', GBP: '£' })[a.currency] || a.currency;
              const arrow = a.direction === 'above' ? '↑' : '↓';
              const kindLabel = a.kind === 'entry' ? (isEN ? 'entry' : 'entrée') : a.kind === 'exit' ? (isEN ? 'exit' : 'sortie') : 'stop';
              return `<li><strong>${a.ticker}</strong> ${arrow} ${a.targetPrice}${sym} (${kindLabel}) — ${isEN ? 'last seen' : 'observé'}: ${a.lastObservedPrice ? a.lastObservedPrice.toFixed(2) + sym : '—'}${a.source?.videoTitle ? ` <span style="color:var(--text-muted);font-size:11px;">via "${a.source.videoTitle.slice(0, 60)}"</span>` : ''}</li>`;
            }).join('')}
            ${triggered.length > 5 ? `<li style="color:var(--text-muted);">+ ${triggered.length - 5} ${isEN ? 'more' : 'autres'}…</li>` : ''}
          </ul>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <a href="#price-alerts" class="btn-primary" style="font-size:12px;text-decoration:none;text-align:center;">${isEN ? 'View all →' : 'Voir tout →'}</a>
        </div>
      </div>
    </div>
  `;
}
