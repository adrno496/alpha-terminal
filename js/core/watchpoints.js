// Watchpoints — notes de surveillance partagées entre tous les modules.
// Chaque watchpoint = un point d'attention que l'utilisateur veut suivre :
// prix d'entrée, prix de sortie, IPO, niveau technique, deadline, news event...
// D'autres modules peuvent les détecter et alerter (Daily Brief, Smart Alerts, Today's Actions).

import { uuid } from './utils.js';
import { openWithMinVersion } from './db-open.js';

const DB_NAME = 'alpha-terminal';
const STORE = 'watchpoints';

function openDB() {
  return openWithMinVersion(DB_NAME, 10, () => {});
}

async function tx(mode = 'readonly') {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}
function p(req) { return new Promise((r, rj) => { req.onsuccess = () => r(req.result); req.onerror = () => rj(req.error); }); }

// === Types de watchpoint ===
// 'entry'      : prix d'achat cible (alerte si prix <= target)
// 'exit'       : prix de vente cible (alerte si prix >= target)
// 'stop_loss'  : stop loss (alerte si prix <= target)
// 'take_profit': take profit (alerte si prix >= target)
// 'level'      : niveau technique (support/résistance) — alerte si traversé
// 'ipo'        : IPO à surveiller (alerte à la date)
// 'event'      : événement (FDA, earnings, deadline)
// 'note'       : note libre, pas de trigger automatique

export const WATCHPOINT_TYPES = [
  { id: 'entry',       label: '🟢 Prix d’achat cible',  hint: 'Alerte si prix passe sous la cible' },
  { id: 'exit',        label: '🔴 Prix de vente cible',      hint: 'Alerte si prix passe au-dessus' },
  { id: 'stop_loss',   label: '🛑 Stop-loss',                 hint: 'Alerte de baisse critique' },
  { id: 'take_profit', label: '🎯 Take-profit',               hint: 'Alerte de prise de bénéfices' },
  { id: 'level',       label: '📐 Niveau technique',          hint: 'Support / résistance à surveiller' },
  { id: 'ipo',         label: '🚀 IPO',                       hint: 'Introduction en bourse à venir' },
  { id: 'event',       label: '📅 Événement',                 hint: 'Earnings, FDA, deadline...' },
  { id: 'note',        label: '📝 Note libre',                hint: 'Réflexion sans déclencheur auto' }
];

// === CRUD ===

export async function listWatchpoints({ status = null, ticker = null } = {}) {
  const store = await tx();
  return new Promise((resolve, reject) => {
    const out = [];
    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return resolve(out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      const v = c.value;
      if ((!status || v.status === status) && (!ticker || (v.ticker || '').toUpperCase() === ticker.toUpperCase())) {
        out.push(v);
      }
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function getWatchpoint(id) { return p((await tx()).get(id)); }

export async function saveWatchpoint(w) {
  const store = await tx('readwrite');
  const now = new Date().toISOString();
  if (!w.id) w.id = uuid();
  if (!w.createdAt) w.createdAt = now;
  if (!w.status) w.status = 'active'; // active | triggered | dismissed | done
  w.updatedAt = now;
  await p(store.put(w));
  return w;
}

export async function deleteWatchpoint(id) {
  const store = await tx('readwrite');
  return p(store.delete(id));
}

export async function markTriggered(id, payload = {}) {
  const w = await getWatchpoint(id);
  if (!w) return null;
  w.status = 'triggered';
  w.triggeredAt = new Date().toISOString();
  w.triggerPayload = payload;
  return saveWatchpoint(w);
}

export async function markDismissed(id) {
  const w = await getWatchpoint(id);
  if (!w) return null;
  w.status = 'dismissed';
  return saveWatchpoint(w);
}

// === Détection : pour un dictionnaire {ticker: currentPrice}, retourne les watchpoints déclenchés ===
export async function detectTriggered(prices = {}) {
  const all = await listWatchpoints({ status: 'active' });
  const triggered = [];
  for (const w of all) {
    if (!w.ticker || !w.target) continue;
    const tk = w.ticker.toUpperCase();
    const price = prices[tk] || prices[tk.replace(/\.[A-Z]+$/, '')];
    if (typeof price !== 'number') continue;
    let hit = false;
    if (w.type === 'entry' && price <= w.target) hit = true;
    if (w.type === 'exit' && price >= w.target) hit = true;
    if (w.type === 'stop_loss' && price <= w.target) hit = true;
    if (w.type === 'take_profit' && price >= w.target) hit = true;
    if (w.type === 'level') {
      // un level est traversé si l'on a un previousPrice et que le prix a changé de côté
      // Pour l'instant : déclenche si prix proche à 1% du target
      if (Math.abs(price - w.target) / w.target <= 0.01) hit = true;
    }
    if (hit) triggered.push({ watchpoint: w, currentPrice: price });
  }
  return triggered;
}

// === Détection événements datés (IPO, earnings, deadlines) ===
// Retourne les watchpoints actifs de type 'ipo' ou 'event' dont la date <= aujourd'hui+daysAhead
export async function detectUpcomingEvents(daysAhead = 7) {
  const all = await listWatchpoints({ status: 'active' });
  const now = Date.now();
  const cutoff = now + daysAhead * 86400000;
  return all
    .filter(w => (w.type === 'ipo' || w.type === 'event') && w.eventDate)
    .filter(w => {
      const t = Date.parse(w.eventDate);
      return !isNaN(t) && t >= now - 86400000 && t <= cutoff;
    })
    .map(w => ({ watchpoint: w, daysUntil: Math.ceil((Date.parse(w.eventDate) - now) / 86400000) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
