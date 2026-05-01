// 🎯 Today's Actions — to-do investing du jour : ce que l'utilisateur doit faire ou surveiller maintenant.
// Compose des données depuis : watchpoints, wealth, goals, price-alerts, budget, earnings calendar, macro events.
import { $ } from '../core/utils.js';
import { listWealth } from '../core/wealth.js';
import { listWatchpoints, detectUpcomingEvents } from '../core/watchpoints.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'todays-actions';

function priorityBadge(p) {
  const map = { high: { c: 'var(--accent-red)', l: 'URGENT' }, medium: { c: 'var(--accent-orange)', l: 'IMPORTANT' }, low: { c: 'var(--accent-blue)', l: 'INFO' } };
  const x = map[p] || map.low;
  return `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${x.c};color:#000;font-weight:700;letter-spacing:0.04em;">${x.l}</span>`;
}

async function buildActions() {
  const actions = [];
  const isEN = getLocale() === 'en';
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // 1. Watchpoints — événements à venir dans 7 jours
  try {
    const evts = await detectUpcomingEvents(7);
    for (const e of evts) {
      const w = e.watchpoint;
      const action = e.daysUntil === 0
        ? (isEN ? `🔔 TODAY: ${w.note || w.ticker || 'event'}` : `🔔 AUJOURD'HUI : ${w.note || w.ticker || 'événement'}`)
        : (isEN ? `📅 In ${e.daysUntil} day(s): ${w.note || w.ticker || 'event'}` : `📅 Dans ${e.daysUntil} jour(s) : ${w.note || w.ticker || 'événement'}`);
      actions.push({
        priority: e.daysUntil === 0 ? 'high' : e.daysUntil <= 3 ? 'medium' : 'low',
        icon: w.type === 'ipo' ? '🚀' : '📅',
        title: action,
        desc: w.target ? `Cible : ${w.target}` : '',
        link: '#watchpoints',
        linkLabel: isEN ? 'View →' : 'Voir →'
      });
    }
  } catch {}

  // 2. Watchpoints prix — les actifs avec target
  try {
    const wps = await listWatchpoints({ status: 'active' });
    const priceWps = wps.filter(w => w.target && w.ticker && ['entry', 'exit', 'stop_loss', 'take_profit'].includes(w.type));
    if (priceWps.length > 0) {
      actions.push({
        priority: 'low',
        icon: '📌',
        title: isEN ? `${priceWps.length} price target(s) being scanned` : `${priceWps.length} cible(s) prix surveillée(s)`,
        desc: priceWps.slice(0, 5).map(w => `${w.ticker} → ${w.target}`).join(' · '),
        link: '#watchpoints',
        linkLabel: isEN ? 'Manage →' : 'Gérer →'
      });
    }
  } catch {}

  // 3. Wealth check — refresh prices il y a > 24h ?
  try {
    const wealth = await listWealth();
    const auto = wealth.filter(h => h.autoValue && h.priceLastUpdated);
    if (auto.length > 0) {
      const oldest = auto.reduce((m, h) => h.priceLastUpdated < m ? h.priceLastUpdated : m, auto[0].priceLastUpdated);
      const ageHours = (Date.now() - new Date(oldest).getTime()) / 3600000;
      if (ageHours > 24) {
        actions.push({
          priority: 'medium',
          icon: '🔄',
          title: isEN ? 'Refresh portfolio prices' : 'Rafraîchir les prix du patrimoine',
          desc: isEN ? `Some holdings haven't updated in ${Math.round(ageHours)}h` : `Certaines positions pas à jour depuis ${Math.round(ageHours)}h`,
          link: '#wealth',
          linkLabel: isEN ? 'Open Wealth →' : 'Ouvrir Patrimoine →'
        });
      }
    }
    // First time : no wealth
    if (wealth.length === 0) {
      actions.push({
        priority: 'high',
        icon: '🚀',
        title: isEN ? 'Set up your portfolio' : 'Configure ton patrimoine',
        desc: isEN ? 'Add your holdings to unlock personalized analyses' : 'Ajoute tes positions pour débloquer les analyses personnalisées',
        link: '#wealth',
        linkLabel: isEN ? 'Add holdings →' : 'Ajouter →'
      });
    }
  } catch {}

  // 4. Macro events imminents (depuis le store de macro-events-calendar)
  try {
    const mc = JSON.parse(localStorage.getItem('alpha-terminal:macro:custom') || '[]');
    const upcoming = mc.filter(e => e.date && e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    for (const e of upcoming) {
      const days = Math.ceil((Date.parse(e.date) - Date.now()) / 86400000);
      if (days > 7) continue;
      actions.push({
        priority: e.impact === 'high' && days <= 1 ? 'high' : 'low',
        icon: '🏛️',
        title: `${e.event} (${e.region})`,
        desc: `${days === 0 ? (isEN ? 'TODAY' : 'AUJOURD\\u2019HUI') : 'J-' + days} · impact ${e.impact}`,
        link: '#macro-events-calendar',
        linkLabel: isEN ? 'See →' : 'Voir →'
      });
    }
  } catch {}

  // 5. Earnings overrides (si user a saisi des dates)
  try {
    const overrides = JSON.parse(localStorage.getItem('alpha-terminal:earnings:dates') || '{}');
    const upcomingE = Object.entries(overrides).filter(([_, v]) => v.date && v.date >= todayStr).sort((a, b) => a[1].date.localeCompare(b[1].date)).slice(0, 3);
    for (const [tk, v] of upcomingE) {
      const days = Math.ceil((Date.parse(v.date) - Date.now()) / 86400000);
      if (days > 14) continue;
      actions.push({
        priority: days <= 1 ? 'high' : 'low',
        icon: '🎙️',
        title: `${tk} earnings`,
        desc: `${days === 0 ? (isEN ? 'TODAY' : 'AUJOURD\\u2019HUI') : 'J-' + days}${v.note ? ' · ' + v.note : ''}`,
        link: '#earnings-calendar',
        linkLabel: isEN ? 'See →' : 'Voir →'
      });
    }
  } catch {}

  // 6. Si aucune action → message
  if (actions.length === 0) {
    actions.push({
      priority: 'low',
      icon: '✅',
      title: isEN ? 'All clear today' : 'Rien d’urgent aujourd’hui',
      desc: isEN ? 'Add watchpoints to track price targets, IPOs, earnings...' : 'Ajoute des points de surveillance pour suivre cibles prix, IPO, earnings...',
      link: '#watchpoints',
      linkLabel: isEN ? 'Add watchpoint →' : 'Ajouter →'
    });
  }

  // Tri par priorité
  const order = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => (order[a.priority] || 9) - (order[b.priority] || 9));
  return actions;
}

export async function renderTodaysActionsView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🎯 ' + t('mod.todays-actions.label'), t('mod.todays-actions.desc'), { moduleId: MODULE_ID })}
    <div id="ta-list" class="card"><div style="color:var(--text-muted);">${isEN ? 'Computing...' : 'Calcul...'}</div></div>
  `;
  const actions = await buildActions();
  $('#ta-list').innerHTML = `
    <div class="card-title">${isEN ? `${actions.length} action${actions.length > 1 ? 's' : ''} for today` : `${actions.length} action${actions.length > 1 ? 's' : ''} aujourd’hui`}</div>
    ${actions.map(a => `
      <div style="display:flex;gap:12px;padding:12px;border:1px solid var(--border);border-radius:6px;margin-bottom:8px;align-items:flex-start;">
        <div style="font-size:22px;">${a.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
            ${priorityBadge(a.priority)}
            <strong style="font-size:14px;">${a.title}</strong>
          </div>
          ${a.desc ? `<div style="font-size:13px;color:var(--text-secondary);">${a.desc}</div>` : ''}
        </div>
        ${a.link ? `<a href="${a.link}" style="font-size:12px;color:var(--accent-green);text-decoration:none;white-space:nowrap;">${a.linkLabel}</a>` : ''}
      </div>
    `).join('')}
  `;
}
