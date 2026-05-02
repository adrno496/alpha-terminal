// Module : risque géopolitique via ACLED.
// Affiche par région : sévérité, intensité 7j, dernier événement, suggestion.
import { $, escHtml } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';
import { acledRegionRisks, acledByActor } from '../core/data-providers/acled.js';
import { getDataKey } from '../core/data-keys.js';

const MODULE_ID = 'geo-risk';

const SEVERITY_STYLE = {
  HIGH:   { color: '#f44336', icon: '🔴', label: 'Élevé' },
  MEDIUM: { color: '#ff9800', icon: '🟠', label: 'Modéré' },
  LOW:    { color: '#4CAF50', icon: '🟢', label: 'Faible' },
  UNKNOWN:{ color: 'var(--text-muted)', icon: '⚪', label: 'Inconnu' }
};

export async function renderGeoRiskView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader('🌍 Risque géopolitique', isEN ? 'Conflict tracking by strategic region (ACLED data, weekly updates).' : 'Suivi des conflits par région stratégique (données ACLED, mise à jour hebdomadaire).', { moduleId: MODULE_ID })}

    <div class="card" style="border-left:3px solid var(--accent-blue);font-size:12px;color:var(--text-secondary);">
      ℹ️ ${isEN ? 'Raw ACLED data view. For an LLM-driven geopolitical analysis with thesis & impact, see' : 'Vue données ACLED brutes. Pour une analyse géopolitique LLM avec thèse & impact, voir'} <a href="#geopolitical-analysis" style="color:var(--accent-green);">🗺️ Analyse géopolitique (LLM)</a>.
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="font-size:13px;color:var(--text-secondary);">
          ${isEN ? 'Live tracking of armed conflict events in 3 hot regions.' : 'Suivi en temps réel des événements armés dans 3 régions chaudes.'}
        </div>
        <button id="geo-refresh" class="btn-primary">🔄 ${isEN ? 'Refresh' : 'Rafraîchir'}</button>
      </div>
    </div>

    <div id="geo-overview" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px;"></div>
    <div id="geo-detail" style="margin-top:12px;"></div>
  `;

  // ACLED nécessite désormais une clé pour la plupart des requêtes
  if (!getDataKey('acled')) {
    $('#geo-overview').innerHTML = `
      <div class="card" style="border-left:3px solid var(--accent-amber);grid-column:1/-1;">
        <div style="font-size:13px;line-height:1.6;">
          ⚠️ <strong>${isEN ? 'ACLED credentials required' : 'Identifiants ACLED requis'}</strong><br>
          ${isEN ? 'ACLED requires an account for most queries. Register free at' : 'ACLED requiert un compte pour la plupart des requêtes. Inscription gratuite sur'}
          <a href="https://developer.acleddata.com/" target="_blank" rel="noopener">developer.acleddata.com</a>.<br>
          ${isEN ? 'Then add your credentials in' : 'Puis ajoute tes identifiants dans'}
          <a href="#settings/data-keys" style="color:var(--accent-green);">Settings → Données</a>
          ${isEN ? '(format' : '(format'} <code>email:KEY</code>).
        </div>
      </div>
    `;
    return;
  }

  $('#geo-refresh').addEventListener('click', () => doFetch(viewEl));
  await doFetch(viewEl);
}

async function doFetch(viewEl) {
  const isEN = getLocale() === 'en';
  const overview = $('#geo-overview');
  const detail = $('#geo-detail');
  overview.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);">⏳ ${isEN ? 'Fetching ACLED data…' : 'Récupération données ACLED…'}</div>`;
  detail.innerHTML = '';

  try {
    const risks = await acledRegionRisks();
    overview.innerHTML = Object.entries(risks).map(([region, r]) => renderRegionCard(region, r, isEN)).join('');

    // Bind clic carte → détail
    overview.querySelectorAll('[data-geo-region]').forEach(card => {
      card.addEventListener('click', async () => {
        const region = card.getAttribute('data-geo-region');
        await renderRegionDetail(detail, region, isEN);
      });
    });
  } catch (e) {
    overview.innerHTML = `<div class="card" style="border-left:3px solid var(--accent-red);grid-column:1/-1;font-size:13px;color:var(--accent-red);">❌ ${escHtml(e?.message || 'Erreur ACLED')}</div>`;
  }
}

function renderRegionCard(region, r, isEN) {
  if (r.error) {
    return `<div class="card" style="border-left:3px solid var(--accent-red);">
      <div style="font-weight:600;font-size:14px;">${escHtml(region)}</div>
      <div style="font-size:12px;color:var(--accent-red);margin-top:6px;">❌ ${escHtml(r.error)}</div>
    </div>`;
  }
  const s = SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.UNKNOWN;
  return `
    <div class="card" data-geo-region="${escHtml(region)}" style="cursor:pointer;border-left:4px solid ${s.color};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="font-weight:600;font-size:14.5px;">${escHtml(region)}</div>
        <span style="font-size:12px;color:${s.color};font-weight:600;">${s.icon} ${s.label}</span>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;line-height:1.5;">
        <div><strong>${r.intensity}</strong> ${isEN ? 'events in last 7 days' : 'événements sur 7j'}</div>
        <div>${isEN ? 'Last event' : 'Dernier événement'} : <strong>${r.lastEvent || '—'}</strong></div>
      </div>
      ${r.suggestion ? `<div style="font-size:12px;color:var(--text-primary);margin-top:8px;padding:6px 8px;background:var(--bg-tertiary);border-radius:4px;">💡 ${escHtml(r.suggestion)}</div>` : ''}
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${isEN ? 'Click for details →' : 'Clique pour les détails →'}</div>
    </div>
  `;
}

const REGION_ACTORS = {
  'Middle East': ['Iran', 'Israel'],
  'Eastern Europe': ['Russia', 'Ukraine'],
  'Asia-Pacific': ['China', 'Taiwan']
};

async function renderRegionDetail(container, region, isEN) {
  container.innerHTML = `<div class="card"><div style="text-align:center;color:var(--text-muted);">⏳ ${isEN ? 'Loading events…' : 'Chargement événements…'}</div></div>`;
  try {
    const actors = REGION_ACTORS[region] || [];
    const r = await acledByActor(actors, { limit: 30 });
    container.innerHTML = `
      <div class="card">
        <div class="card-title">📍 ${escHtml(region)} — ${isEN ? 'Recent events' : 'Événements récents'}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${r.events.length} ${isEN ? 'events found' : 'événements trouvés'}</div>
        ${r.events.slice(0, 30).map(e => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:12.5px;font-weight:600;">
              ${escHtml(e.event_type || 'Event')} · ${escHtml(e.country || '')}${e.location ? ' (' + escHtml(e.location) + ')' : ''}
            </div>
            <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">
              ${escHtml(e.event_date || '')} · ${escHtml(e.actor1 || '')}${e.actor2 ? ' vs ' + escHtml(e.actor2) : ''}
              ${e.fatalities ? ` · 💀 ${e.fatalities}` : ''}
            </div>
            ${e.notes ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;line-height:1.4;">${escHtml(String(e.notes).slice(0, 240))}${String(e.notes).length > 240 ? '…' : ''}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="card" style="color:var(--accent-red);">❌ ${escHtml(e?.message || 'Erreur')}</div>`;
  }
}
