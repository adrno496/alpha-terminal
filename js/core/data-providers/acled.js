// ACLED — Armed Conflict Location & Event Data (https://acleddata.com/data-export-tool/)
// API publique, données mises à jour hebdomadairement.
// Note : ACLED a introduit une auth obligatoire en 2024 pour la plupart des endpoints.
// Pour rester aligné avec le mode "0-data" Alpha, on offre 2 modes :
//   1. Sans clé : tente l'endpoint legacy /acled/read (parfois ouvert pour requêtes simples)
//   2. Avec clé : utilise l'auth fournie par l'utilisateur (param `key` + `email`)
// Routé via /api/llm-proxy pour CORS.

import { getDataKey } from '../data-keys.js';
import { bumpQuota } from '../data-quota.js';

const BASE = 'https://api.acleddata.com/acled/read';

function viaProxy(url) {
  const base = (typeof window !== 'undefined' && window.ALPHA_CONFIG?.LLM_PROXY_URL) || '/api/llm-proxy';
  return `${base}?url=${encodeURIComponent(url)}`;
}

async function call(params = {}) {
  // Si l'utilisateur a configuré une clé ACLED, on l'ajoute. Format : "email:KEY".
  const credential = getDataKey('acled');
  let auth = {};
  if (credential && credential.includes(':')) {
    const [email, key] = credential.split(':');
    auth = { email: email.trim(), key: key.trim() };
  }
  const merged = { ...params, ...auth, limit: String(params.limit || 100) };
  const target = BASE + '?' + new URLSearchParams(merged);
  const res = await fetch(viaProxy(target));
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`ACLED ${res.status}: ${t.slice(0, 120)}`);
  }
  bumpQuota('acled');
  return res.json();
}

function severityFromCount(count) {
  if (count > 5) return 'HIGH';
  if (count > 2) return 'MEDIUM';
  return 'LOW';
}

// Récupère les événements impliquant certains acteurs (ex: Iran + Israel)
export async function acledByActor(actors = ['Iran', 'Israel'], { limit = 100 } = {}) {
  // ACLED filtre par "actor1" ou "actor2" via paramètre `actor1` (regex possible)
  // Pour rester simple : on requête par premier acteur, on filtre client-side ensuite
  const data = await call({ actor1: actors[0], limit });
  const events = (data.data || []).filter(e => {
    if (actors.length === 1) return true;
    return actors.some(a => (e.actor1 || '').includes(a) || (e.actor2 || '').includes(a));
  });
  // Compte les événements des 7 derniers jours
  const now = Date.now();
  const last7d = events.filter(e => {
    const d = new Date(e.event_date);
    return !isNaN(d) && (now - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });
  const intensity7d = last7d.length;
  return {
    actors,
    events,
    count: events.length,
    lastEvent: events[0]?.event_date || null,
    lastEventSummary: events[0]?.notes || events[0]?.event_type || null,
    intensity7d,
    severity: severityFromCount(intensity7d)
  };
}

// Aggrège le risque par région stratégique
export async function acledRegionRisks() {
  const REGIONS = {
    'Middle East': ['Iran', 'Israel'],
    'Eastern Europe': ['Russia', 'Ukraine'],
    'Asia-Pacific': ['China', 'Taiwan']
  };
  const out = {};
  await Promise.all(Object.entries(REGIONS).map(async ([region, actors]) => {
    try {
      const r = await acledByActor(actors, { limit: 50 });
      out[region] = {
        intensity: r.intensity7d,
        severity: r.severity,
        lastEvent: r.lastEvent,
        lastEventSummary: r.lastEventSummary,
        eventCount: r.count,
        suggestion: suggestionForRegion(region, r.severity)
      };
    } catch (e) {
      out[region] = { error: e?.message || 'Erreur', severity: 'UNKNOWN' };
    }
  }));
  return out;
}

function suggestionForRegion(region, severity) {
  if (severity === 'HIGH') {
    if (region === 'Middle East') return 'Hedge or + monitorer brut (risque pétrolier élevé)';
    if (region === 'Eastern Europe') return 'Hedge or + énergie (risque approvisionnement)';
    if (region === 'Asia-Pacific') return 'Monitorer semi-conducteurs + chaînes asiatiques';
    return 'Hedge défensif — or + cash';
  }
  if (severity === 'MEDIUM') return 'Surveillance — pas d\'action immédiate';
  return 'Situation stable — pas d\'impact macro notable';
}
