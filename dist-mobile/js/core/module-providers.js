// Helper : pour un module donné, retourne les providers nécessaires/dispo/manquants.
// Permet d'afficher un badge ⚠️ sur les modules non utilisables et un message clair en runtime.

import { MODULE_ROUTING } from './router.js';
import { KNOWN_PROVIDERS, getOrchestrator, isConnected } from './api.js';

const PROVIDER_BY_NAME = Object.fromEntries(KNOWN_PROVIDERS.map(p => [p.name, p]));

// Liste des providers actuellement configurés (clés API présentes)
export function getConfiguredProviders() {
  if (!isConnected()) return [];
  try { return getOrchestrator().getProviderNames(); }
  catch { return []; }
}

// Pour un module, retourne :
//   { runnable, configured, optimal, fallback, missing, suggested }
//   - runnable  : true si au moins un provider compatible est configuré
//   - configured: liste des providers actuellement configurés
//   - optimal   : liste des providers optimaux pour ce module
//   - fallback  : liste des providers fallback
//   - missing   : optimal+fallback non configurés
//   - suggested : top 3 providers manquants à proposer en priorité (avec leurs metadata)
export function getModuleProviderStatus(moduleId) {
  const config = MODULE_ROUTING[moduleId];
  const configured = getConfiguredProviders();

  // Si moduleId pas dans MODULE_ROUTING → c'est un module pure local (budget, csv-import…)
  // → toujours "runnable", pas besoin de clé.
  if (!config) {
    return {
      isLocalOnly: true,
      runnable: true,
      configured,
      optimal: [],
      fallback: [],
      missing: [],
      suggested: []
    };
  }

  const optimal = config.optimalProviders || [];
  const fallback = config.fallbackProviders || [];
  const allCompatible = [...new Set([...optimal, ...fallback])];

  // Runnable = au moins un compatible ou n'importe quel autre provider (last-resort dans selectProvider)
  const hasOptimalOrFallback = allCompatible.some(p => configured.includes(p));
  const hasAnyConfigured = configured.length > 0;
  // Le router fait un fallback générique si rien dans la liste → runnable si au moins UN provider est configuré
  const runnable = hasOptimalOrFallback || hasAnyConfigured;

  const missing = allCompatible.filter(p => !configured.includes(p));
  const suggested = (optimal.length ? optimal : fallback)
    .filter(p => !configured.includes(p))
    .slice(0, 3)
    .map(p => PROVIDER_BY_NAME[p])
    .filter(Boolean);

  return {
    isLocalOnly: false,
    runnable,
    isOptimallyRunnable: hasOptimalOrFallback,
    configured,
    optimal,
    fallback,
    missing,
    suggested,
    reason: config.reason || ''
  };
}

// Retourne true si le module a besoin d'une clé API et que rien de compatible n'est configuré.
// Utilisé pour afficher un badge ⚠️ "clé API manquante" dans la sidebar.
export function isModuleMissingApiKey(moduleId) {
  const s = getModuleProviderStatus(moduleId);
  if (s.isLocalOnly) return false;
  return !s.runnable;
}

// Set des modules qui requièrent une clé API non configurée (pour rendu sidebar)
export function modulesMissingApiKey(allModuleIds) {
  const out = new Set();
  for (const id of allModuleIds) {
    if (isModuleMissingApiKey(id)) out.add(id);
  }
  return out;
}

// Format markdown lisible pour l'utilisateur expliquant ce qu'il manque pour ce module.
//   moduleId : id du module
//   isEN     : booléen FR/EN
// Retourne du HTML prêt à injecter dans une carte d'erreur.
export function renderMissingKeysMessage(moduleId, isEN = false) {
  const s = getModuleProviderStatus(moduleId);
  if (s.isLocalOnly) return '';

  if (s.runnable && !s.isOptimallyRunnable) {
    // Marche mais pas optimal
    const optimalLabels = s.optimal.map(p => PROVIDER_BY_NAME[p]).filter(Boolean);
    return `
      <div style="background:rgba(255,170,0,0.08);border:1px solid var(--accent-orange);padding:12px;border-radius:6px;font-size:12.5px;">
        <strong>⚠️ ${isEN ? 'Module will run but not on the optimal model' : 'Le module va tourner mais pas sur le modèle optimal'}</strong>
        <div style="margin-top:6px;color:var(--text-secondary);">
          ${isEN ? 'For best results, configure one of:' : 'Pour de meilleurs résultats, configure une de ces clés :'}
          <span>${optimalLabels.map(p => `${p.icon} ${p.displayName}`).join(' · ')}</span>
        </div>
      </div>
    `;
  }

  // Pas runnable → besoin d'une clé compatible
  const sugg = s.suggested.length ? s.suggested : s.optimal.map(n => PROVIDER_BY_NAME[n]).filter(Boolean);
  return `
    <div style="background:rgba(255,51,85,0.08);border:2px dashed var(--accent-red);padding:16px;border-radius:8px;">
      <div style="font-size:15px;font-weight:600;margin-bottom:10px;">
        🔑 ${isEN ? 'API key required to run this module' : 'Clé API requise pour ce module'}
      </div>
      <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 10px;line-height:1.5;">
        ${isEN
          ? 'This module needs at least one of the following AI providers configured:'
          : 'Ce module a besoin d\'au moins un de ces providers IA configuré :'}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        ${sugg.map((p, i) => `
          <a href="${p.linkKey}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;flex-direction:column;gap:4px;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;min-width:160px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${p.icon} ${p.displayName}${i === 0 ? ' ⭐' : ''}</div>
            <div style="font-size:10.5px;color:var(--text-muted);line-height:1.3;">${p.recommendedFor || ''}</div>
            <div style="font-size:10px;color:var(--accent-green);">${isEN ? 'Get a key →' : 'Obtenir une clé →'}</div>
          </a>
        `).join('')}
      </div>
      ${s.reason ? `<p style="font-size:11.5px;color:var(--text-muted);font-style:italic;margin:0 0 10px;">💡 ${isEN ? 'Why' : 'Pourquoi'} : ${s.reason}</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="run-need-keys" class="btn-primary">🔑 ${isEN ? 'Configure API keys now' : 'Configurer mes clés maintenant'}</button>
        ${s.configured.length === 0 ? '' : `
          <span style="font-size:11px;color:var(--text-muted);align-self:center;">
            ${isEN ? 'You currently have' : 'Tu as actuellement'} : ${s.configured.map(p => (PROVIDER_BY_NAME[p]?.icon || '·') + ' ' + (PROVIDER_BY_NAME[p]?.displayName || p)).join(', ')}
          </span>
        `}
      </div>
    </div>
  `;
}
