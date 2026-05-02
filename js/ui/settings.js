// Settings v3 — onglets : keys / routing / costs / models / advanced
import { $, toast, fmtUSD } from '../core/utils.js';
import { getSettings, setSettings, clearAnalyses, listAnalyses, saveAnalysis } from '../core/storage.js';
import { hasVault, vaultProviderNames, setApiKeys, removeProviderKey, forgetVault, unlockVault } from '../core/crypto.js';
import { isConnected, clearRuntimeKeys, setRuntimeKeys, validateProviderKey, KNOWN_PROVIDERS, getOrchestrator, MODULE_ROUTING } from '../core/api.js';
import { MODULES as ALL_MODULES } from './sidebar.js';
import { getCost, resetTotalCost, getBudgetLimits, setBudgetLimits } from '../core/cost-tracker.js';
import { MODEL_CATALOG } from '../core/models-catalog.js';
import { t, getLocale } from '../core/i18n.js';
import { DATA_PROVIDERS, KEYLESS_DATA_SOURCES, getDataKey, setDataKey, getDataKeyStatus, validateDataKey } from '../core/data-keys.js';
import { explainAsPillHTML, explainAsDetailHTML } from './error-explainer.js';
import { resetTour, startTour } from './tour.js';
import { downloadFullBackup, importBackupFromFile, getLocalDataStats, wipeAllLocalData, copyBackupToClipboard, diagnosticBackup } from '../core/backup.js';

let currentTab = 'keys';

export function renderSettingsView(viewEl) {
  viewEl.innerHTML = `
    <div class="module-header"><h2>${t('settings.title')}</h2><div class="module-desc">${t('settings.desc')}</div></div>
    <div class="tabs-bar">
      ${['keys','data_keys','routing','costs','models','premium','advanced'].map(tab => `<button class="tab ${tab===currentTab?'active':''}" data-tab="${tab}">${tabLabel(tab)}</button>`).join('')}
    </div>
    <div id="settings-content"></div>
  `;
  viewEl.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    currentTab = b.getAttribute('data-tab');
    renderSettingsView(viewEl);
  }));
  renderTab(currentTab);
}

function tabLabel(tab) {
  return t('settings.tabs.' + tab) || tab;
}

function renderTab(tab) {
  const c = $('#settings-content');
  if (tab === 'keys') renderKeysTab(c);
  else if (tab === 'data_keys') renderDataKeysTab(c);
  else if (tab === 'routing') renderRoutingTab(c);
  else if (tab === 'costs') renderCostsTab(c);
  else if (tab === 'models') renderModelsTab(c);
  else if (tab === 'premium') renderPremiumTab(c);
  else if (tab === 'advanced') renderAdvancedTab(c);
}

function renderPremiumTab(c) {
  const en = (document.documentElement.lang || 'fr').toLowerCase().startsWith('en');
  const lm = window.licenseManager;
  const hasLicense = !!(lm && lm.getLicense());
  const meta = lm && lm.getMeta ? lm.getMeta() : null;
  const status = meta?.status || (hasLicense ? 'active' : null);
  const expiresAt = meta?.expires_at ? new Date(meta.expires_at) : null;
  const now = new Date();
  const isExpiringSoon = expiresAt && (expiresAt - now) > 0 && (expiresAt - now) < 30 * 24 * 3600 * 1000;

  const fmtDate = (d) => d ? d.toLocaleDateString(en ? 'en-US' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const maskedKey = (() => {
    const k = lm?.getLicense();
    if (!k) return '—';
    return k.slice(0, 8) + '-XXXX-XXXX-XXXX-' + k.slice(-4);
  })();

  // Statut human-readable
  let statusBadge, statusDesc;
  if (!hasLicense) {
    statusBadge = `<span style="color:var(--text-muted);">${en ? '○ No license' : '○ Aucune licence'}</span>`;
    statusDesc = en
      ? 'You don\'t have an active Premium license on this device. Subscribe or paste an existing key.'
      : 'Aucune licence Premium active sur cet appareil. Abonne-toi ou colle une clé existante.';
  } else if (status === 'active') {
    statusBadge = `<span style="color:var(--accent-green);">● ${en ? 'Active' : 'Actif'}</span>`;
    statusDesc = expiresAt
      ? (en ? `Renews on ${fmtDate(expiresAt)}.` : `Renouvellement le ${fmtDate(expiresAt)}.`)
      : (en ? 'Subscription active.' : 'Abonnement actif.');
  } else if (status === 'expired') {
    statusBadge = `<span style="color:var(--accent-red);">● ${en ? 'Expired' : 'Expirée'}</span>`;
    statusDesc = en ? 'License has expired. Renew to regain Premium access.' : 'La licence a expiré. Renouvelle pour récupérer l\'accès Premium.';
  } else if (status === 'disabled') {
    statusBadge = `<span style="color:var(--accent-amber);">● ${en ? 'Cancelled' : 'Annulée'}</span>`;
    statusDesc = expiresAt && expiresAt > now
      ? (en ? `Cancelled — Premium access until ${fmtDate(expiresAt)}.` : `Annulée — accès Premium jusqu'au ${fmtDate(expiresAt)}.`)
      : (en ? 'Subscription cancelled — Premium access lost.' : 'Abonnement annulé — accès Premium perdu.');
  } else {
    statusBadge = `<span style="color:var(--text-muted);">● ${status || '—'}</span>`;
    statusDesc = '';
  }

  const portalUrl = lm?.portalUrl || 'https://alpha-terminal.lemonsqueezy.com/billing';
  const checkoutUrl = (window.ALPHA_CONFIG && window.ALPHA_CONFIG.LEMONSQUEEZY_CHECKOUT_URL)
    || 'https://alpha-terminal.lemonsqueezy.com/checkout/buy/7b4016cb-9be7-4db8-b304-268722544f06';

  c.innerHTML = `
    <div class="card">
      <div class="card-title">${en ? '💎 Premium subscription' : '💎 Abonnement Premium'}</div>

      <div style="display:grid;grid-template-columns:max-content 1fr;gap:8px 18px;font-size:13px;margin:8px 0 16px;">
        <div style="color:var(--text-muted);">${en ? 'Status' : 'Statut'}</div>
        <div>${statusBadge}</div>

        <div style="color:var(--text-muted);">${en ? 'License key' : 'Clé de licence'}</div>
        <div style="font-family:monospace;font-size:12px;">${maskedKey}</div>

        ${meta?.customer_email ? `
        <div style="color:var(--text-muted);">${en ? 'Email' : 'Email'}</div>
        <div>${meta.customer_email}</div>` : ''}

        ${expiresAt ? `
        <div style="color:var(--text-muted);">${status === 'disabled' ? (en ? 'Access until' : 'Accès jusqu\'au') : (en ? 'Next renewal' : 'Prochain renouvellement')}</div>
        <div>${fmtDate(expiresAt)}</div>` : ''}
      </div>

      <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 14px;line-height:1.5;">${statusDesc}</p>

      ${isExpiringSoon && status === 'active' ? `
      <div class="alert alert-warning" style="margin-bottom:14px;">
        ⚠️ ${en ? 'Your subscription renews soon. No action needed unless you want to cancel.' : 'Ton abonnement se renouvelle bientôt. Rien à faire sauf si tu veux annuler.'}
      </div>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${hasLicense ? `
        <a href="${portalUrl}" target="_blank" rel="noopener" class="btn-primary" style="text-decoration:none;display:inline-block;">
          ${en ? '⚙️ Manage subscription' : '⚙️ Gérer mon abonnement'}
        </a>
        <button id="prem-recheck" class="btn-secondary">${en ? '🔄 Refresh status' : '🔄 Rafraîchir le statut'}</button>
        <button id="prem-logout" class="btn-ghost" style="color:var(--accent-red);">${en ? '🚪 Remove license from this device' : '🚪 Retirer la licence de cet appareil'}</button>
        ` : `
        <a href="${checkoutUrl}" target="_blank" rel="noopener" class="btn-primary" style="text-decoration:none;display:inline-block;">
          ${en ? '🚀 Subscribe €9.99/month' : '🚀 S\'abonner 9,99€/mois'}
        </a>
        <button id="prem-enter-key" class="btn-secondary">${en ? '🔑 I have a license key' : '🔑 J\'ai déjà une clé'}</button>
        `}
      </div>

      <p style="font-size:11px;color:var(--text-muted);margin:14px 0 0;line-height:1.5;">
        ${en
          ? 'Cancelling on Lemonsqueezy keeps your access until the end of the paid period. You can also "Remove license from this device" to free a slot for another machine.'
          : 'Annuler sur Lemonsqueezy te garde l\'accès jusqu\'à la fin de la période payée. Tu peux aussi "Retirer la licence de cet appareil" pour libérer un slot pour une autre machine.'}
      </p>
    </div>

    ${hasLicense ? `
    <!-- Stats d'utilisation locale (calculées depuis IndexedDB) -->
    <div class="card">
      <div class="card-title">${en ? '📊 Your Alpha usage' : '📊 Ton usage Alpha'}</div>
      <div id="prem-stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:6px;">
        <div style="background:var(--bg-tertiary);padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${en ? 'Days active' : 'Jours actifs'}</div>
          <div id="stat-days" style="font-size:24px;font-weight:700;color:var(--accent-green);margin-top:4px;">…</div>
        </div>
        <div style="background:var(--bg-tertiary);padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${en ? 'Analyses' : 'Analyses'}</div>
          <div id="stat-analyses" style="font-size:24px;font-weight:700;color:var(--accent-green);margin-top:4px;">…</div>
        </div>
        <div style="background:var(--bg-tertiary);padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${en ? 'Modules used' : 'Modules utilisés'}</div>
          <div id="stat-modules" style="font-size:24px;font-weight:700;color:var(--accent-green);margin-top:4px;">…</div>
        </div>
        <div style="background:var(--bg-tertiary);padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${en ? 'Holdings tracked' : 'Holdings suivies'}</div>
          <div id="stat-holdings" style="font-size:24px;font-weight:700;color:var(--accent-green);margin-top:4px;">…</div>
        </div>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin:12px 0 0;text-align:center;">
        ${en ? '🔒 Stats computed locally — never sent to our servers.' : '🔒 Stats calculées localement — jamais envoyées à nos serveurs.'}
      </p>
    </div>` : ''}
  `;

  // Calcule les stats depuis IndexedDB / localStorage (lazy, async)
  if (hasLicense) {
    (async () => {
      try {
        const { listAnalyses, getAllWealthHoldings } = await import('../core/storage.js');
        const analyses = await listAnalyses();
        const totalAnalyses = analyses?.length || 0;
        const moduleSet = new Set((analyses || []).map(a => a.moduleId).filter(Boolean));
        // Days active : depuis l'activation de la licence
        const checkedAt = parseInt(localStorage.getItem('alpha-license-checked-at') || '0', 10);
        const days = checkedAt ? Math.max(1, Math.floor((Date.now() - checkedAt) / (24 * 3600 * 1000))) : 1;
        // Holdings : si fonction dispo
        let holdings = 0;
        try {
          const h = await getAllWealthHoldings();
          holdings = h?.length || 0;
        } catch {}
        const $ = (id) => c.querySelector('#' + id);
        if ($('stat-days')) $('stat-days').textContent = days;
        if ($('stat-analyses')) $('stat-analyses').textContent = totalAnalyses;
        if ($('stat-modules')) $('stat-modules').textContent = moduleSet.size;
        if ($('stat-holdings')) $('stat-holdings').textContent = holdings;
      } catch {}
    })();
  }

  const recheckBtn = c.querySelector('#prem-recheck');
  if (recheckBtn) recheckBtn.addEventListener('click', async () => {
    recheckBtn.disabled = true;
    recheckBtn.textContent = en ? '⏳ Checking…' : '⏳ Vérification…';
    await lm.checkLicenseStatus();
    renderPremiumTab(c);
  });

  const logoutBtn = c.querySelector('#prem-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    const ok = window.confirm(en
      ? 'Remove the license from this device? You\'ll need to paste your key again to regain Premium access here. Your subscription is NOT cancelled.'
      : 'Retirer la licence de cet appareil ? Tu devras recoller ta clé pour récupérer l\'accès Premium ici. L\'abonnement n\'est PAS annulé.');
    if (!ok) return;
    lm.logout();
    renderPremiumTab(c);
  });

  const enterKeyBtn = c.querySelector('#prem-enter-key');
  if (enterKeyBtn) enterKeyBtn.addEventListener('click', () => lm && lm.showLicenseModal());
}

function renderDataKeysTab(c) {
  c.innerHTML = `
    <div class="card">
      <div class="card-title">✅ Active free sources (no key required)</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">These run automatically — already integrated into all relevant analyses to save on LLM web searches.</p>
      <div class="keyless-grid">
        ${KEYLESS_DATA_SOURCES.map(s => `
          <div class="keyless-card">
            <div class="keyless-status">✅</div>
            <div class="keyless-info">
              <strong>${s.label}</strong>
              <span class="keyless-desc">${s.desc}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">${t('settings.data.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;">${t('settings.data.desc')}</p>

      <!-- Test all data keys panel -->
      <div id="data-test-panel" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <strong style="font-size:13px;">🧪 Tester toutes mes clés data configurées</strong>
            <p style="color:var(--text-muted);font-size:11.5px;margin:4px 0 0;line-height:1.5;">
              Envoie une requête de validation minimale (~1 call gratuit) à chaque provider pour vérifier que tes clés sont valides.
            </p>
          </div>
          <button id="data-test-all" class="btn-secondary" style="white-space:nowrap;font-size:12.5px;padding:8px 14px;">⚡ Tester toutes</button>
        </div>
        <div id="data-test-results" style="margin-top:10px;display:none;"></div>
      </div>

      ${DATA_PROVIDERS.map(p => {
        const status = getDataKeyStatus(p.id);
        const value = getDataKey(p.id) || '';
        return `
        <div class="data-key-row">
          <div class="data-key-info">
            <strong>${p.label}</strong>
            <span class="data-key-desc">${p.desc}</span>
          </div>
          <input type="password" class="input data-key-input" data-id="${p.id}" placeholder="${status === 'set' ? '••• (' + t('common.optional') + ')' : 'API key…'}" />
          <span class="data-key-status" data-status-id="${p.id}">${status === 'set' ? '✅' : '⏳'}</span>
          <button type="button" class="btn-secondary data-key-test" data-test-id="${p.id}" title="Tester cette clé" style="font-size:11px;padding:5px 9px;white-space:nowrap;">⚡ Test</button>
          <a href="${p.link}" target="_blank" class="btn-ghost data-key-getlink" rel="noopener">${t('settings.data.get_key')}</a>
        </div>
        `;
      }).join('')}
      <button id="data-keys-save" class="btn-primary" style="margin-top:10px;">${t('common.save')}</button>
    </div>
  `;
  $('#data-keys-save').addEventListener('click', () => {
    c.querySelectorAll('.data-key-input').forEach(inp => {
      const id = inp.getAttribute('data-id');
      const v = inp.value.trim();
      if (v) setDataKey(id, v);
    });
    toast(t('common.save'), 'success');
    setTimeout(() => renderTab('data_keys'), 400);
  });

  // Test individuel par clé : prend la valeur de l'input si présente, sinon la clé sauvée.
  c.querySelectorAll('.data-key-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-test-id');
      const input = c.querySelector(`.data-key-input[data-id="${id}"]`);
      const statusEl = c.querySelector(`[data-status-id="${id}"]`);
      const k = (input?.value || '').trim() || getDataKey(id) || '';
      if (!k) { statusEl.innerHTML = '<span style="color:var(--accent-amber);">⚠ vide</span>'; return; }
      const oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳';
      statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;"></span>';
      try {
        const v = await validateDataKey(id, k);
        statusEl.innerHTML = explainAsPillHTML(v);
        // Affiche aussi le détail (explication + action) sous la ligne pour que l'user comprenne
        let detailEl = c.querySelector(`[data-detail-id="${id}"]`);
        const detailHTML = explainAsDetailHTML(v);
        if (detailHTML) {
          if (!detailEl) {
            detailEl = document.createElement('div');
            detailEl.setAttribute('data-detail-id', id);
            statusEl.parentElement.appendChild(detailEl);
          }
          detailEl.innerHTML = detailHTML;
        } else if (detailEl) {
          detailEl.remove();
        }
      } catch (e) {
        statusEl.innerHTML = explainAsPillHTML({ ok: false, error: e?.message || 'erreur' });
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    });
  });

  // Tester toutes les clés configurées en parallèle
  const testAllBtn = c.querySelector('#data-test-all');
  const resultsBox = c.querySelector('#data-test-results');
  if (testAllBtn && resultsBox) {
    testAllBtn.addEventListener('click', async () => {
      // Récupère uniquement les providers avec une clé saisie ou sauvée
      const toTest = DATA_PROVIDERS.filter(p => {
        const inputVal = c.querySelector(`.data-key-input[data-id="${p.id}"]`)?.value.trim();
        return inputVal || getDataKey(p.id);
      });
      if (!toTest.length) {
        resultsBox.style.display = 'block';
        resultsBox.innerHTML = `<div style="color:var(--accent-amber);font-size:12.5px;">⚠ Aucune clé data configurée. Saisis-en au moins une ci-dessous.</div>`;
        return;
      }
      testAllBtn.disabled = true;
      const oldLabel = testAllBtn.textContent;
      testAllBtn.textContent = '⏳ Test en cours…';
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = `<div id="dt-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;font-size:12.5px;"></div>`;
      const grid = resultsBox.querySelector('#dt-grid');
      const pills = {};
      for (const p of toTest) {
        const pill = document.createElement('div');
        pill.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px;';
        pill.innerHTML = `<span style="flex:1;font-size:12px;">${p.label}</span><span class="dt-status" style="color:var(--text-muted);font-size:11px;">⏳</span>`;
        grid.appendChild(pill);
        pills[p.id] = pill;
      }
      let okCount = 0, failCount = 0;
      // Stocke les résultats détaillés pour les afficher en dessous
      const failures = [];
      await Promise.all(toTest.map(async (p) => {
        const inputVal = c.querySelector(`.data-key-input[data-id="${p.id}"]`)?.value.trim();
        const key = inputVal || getDataKey(p.id);
        const status = pills[p.id].querySelector('.dt-status');
        try {
          const v = await validateDataKey(p.id, key);
          status.innerHTML = explainAsPillHTML(v);
          if (v.ok) okCount++;
          else { failCount++; failures.push({ p, v }); }
        } catch (e) {
          const errResult = { ok: false, error: e?.message || 'error' };
          status.innerHTML = explainAsPillHTML(errResult);
          failCount++; failures.push({ p, v: errResult });
        }
      }));
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:12px;';
      if (failCount === 0) {
        summary.style.background = 'rgba(0,255,136,0.08)';
        summary.style.color = 'var(--accent-green)';
        summary.textContent = `✅ Les ${okCount} clés data sont opérationnelles.`;
        resultsBox.appendChild(summary);
      } else {
        summary.style.background = 'rgba(255,80,80,0.08)';
        summary.style.color = 'var(--accent-red)';
        summary.innerHTML = `⚠️ ${okCount} OK · ${failCount} échec(s). <strong>Détails ci-dessous</strong> :`;
        resultsBox.appendChild(summary);
        // Affiche un panneau détaillé pour chaque échec avec explication + action
        const details = document.createElement('div');
        details.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:8px;';
        for (const { p, v } of failures) {
          const block = document.createElement('div');
          block.innerHTML = `<div style="font-size:12.5px;font-weight:600;color:var(--text-primary);">${p.label}</div>${explainAsDetailHTML(v)}`;
          details.appendChild(block);
        }
        resultsBox.appendChild(details);
      }
      testAllBtn.disabled = false;
      testAllBtn.textContent = '⚡ Re-tester toutes';
    });
  }
}

// === KEYS ===
function renderKeysTab(c) {
  const present = vaultProviderNames();
  const isEN = getLocale() === 'en';
  c.innerHTML = `
    <div class="card">
      <div class="card-title">${t('settings.keys.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">
        ${isConnected() ? `<span style="color:var(--accent-green);">${t('settings.keys.unlocked')}</span>` : `<span style="color:var(--accent-red);">${t('settings.keys.locked')}</span>`}
        ${hasVault() ? ' · ' + t('settings.keys.has_vault') : ' · ' + t('settings.keys.no_vault')}
      </p>

      <!-- Test all configured LLM keys -->
      ${isConnected() && present.length ? `
      <div id="llm-test-panel" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <strong style="font-size:13px;">${isEN ? '🧪 Test all configured LLM keys' : '🧪 Tester toutes mes clés LLM configurées'}</strong>
            <p style="color:var(--text-muted);font-size:11.5px;margin:4px 0 0;line-height:1.5;">
              ${isEN
                ? 'Pings each provider with a minimal validation request to confirm your keys are alive and authorized.'
                : 'Envoie une requête de validation minimale à chaque provider pour vérifier que tes clés répondent.'}
            </p>
          </div>
          <button id="llm-test-all" class="btn-secondary" style="white-space:nowrap;font-size:12.5px;padding:8px 14px;">${isEN ? '⚡ Test all' : '⚡ Tester toutes'}</button>
        </div>
        <div id="llm-test-results" style="margin-top:10px;display:none;"></div>
      </div>` : ''}

      <div id="keys-list"></div>
      <p style="color:var(--text-muted);font-size:11.5px;margin-top:12px;">
        ${t('settings.keys.add_help')}
      </p>
      <details>
        <summary style="cursor:pointer;color:var(--accent-blue);font-size:12px;margin-bottom:8px;">${t('settings.keys.add_modify')}</summary>
        <div class="field"><label class="field-label">${t('settings.keys.current_password')}</label><input id="keys-pwd" class="input" type="password" /></div>
        ${KNOWN_PROVIDERS.map(p => {
          const browserBadge = p.proxiedViaApp
            ? `<span style="background:rgba(80,180,255,0.12);color:#5ab8ff;font-size:9.5px;padding:2px 5px;border-radius:3px;margin-left:6px;font-weight:600;">🔄 ${isEN ? 'via Alpha proxy' : 'via proxy Alpha'}</span>`
            : '';
          const browserHint = p.proxiedViaApp
            ? `<div style="background:rgba(80,180,255,0.06);border-left:2px solid #5ab8ff;padding:6px 10px;margin-top:6px;font-size:11px;color:var(--text-secondary);border-radius:3px;line-height:1.5;">
                🔄 ${isEN
                  ? 'This provider normally requires a backend. Alpha automatically routes via its secure CORS proxy (API key passes through, never stored).'
                  : 'Ce provider nécessite normalement un backend. Alpha route automatiquement via son proxy CORS sécurisé (clé API passe through, jamais stockée).'}
              </div>`
            : '';
          return `
          <div class="field">
            <label class="field-label">${p.icon} ${p.displayName}${browserBadge} <span class="keys-set-status" data-status-set="${p.name}" style="margin-left:6px;font-size:11px;"></span></label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="keys-set-${p.name}" class="input" type="password" placeholder="${present.includes(p.name) ? '••• (' + t('common.optional') + ')' : (p.placeholder || 'sk-...')}" style="flex:1;" />
              <button type="button" class="btn-secondary" data-test-set="${p.name}" title="Tester cette clé sans la sauvegarder" style="font-size:11.5px;padding:6px 10px;white-space:nowrap;">⚡ ${t('common.test')}</button>
            </div>
            <div class="field-hint">${p.recommendedFor} · <a href="${p.linkKey}" target="_blank">${t('settings.keys.create')}</a></div>
            ${browserHint}
          </div>
        `;
        }).join('')}
        <button id="keys-save" class="btn-primary">${t('common.save')}</button>
        <span id="keys-status" style="margin-left:10px;font-size:12px;"></span>
      </details>
    </div>

    <div class="card">
      <div class="card-title">Lock</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="set-lock" class="btn-secondary">${t('settings.keys.lock')}</button>
        <button id="set-forget" class="btn-danger">${t('settings.keys.forget')}</button>
      </div>
    </div>
  `;
  const list = $('#keys-list');
  if (!present.length) list.innerHTML = '<div class="alert alert-warning">No keys configured.</div>';
  else list.innerHTML = present.map(name => {
    const p = KNOWN_PROVIDERS.find(x => x.name === name);
    const browserBadge = p?.proxiedViaApp
      ? `<span style="background:rgba(80,180,255,0.12);color:#5ab8ff;font-size:10px;padding:2px 6px;border-radius:3px;margin-left:6px;font-weight:600;cursor:help;" title="${isEN ? 'Routed through Alpha CORS proxy (key passes through, never stored).' : 'Routé via le proxy CORS Alpha (clé passe through, jamais stockée).'}">🔄 ${isEN ? 'via Alpha proxy' : 'via proxy Alpha'}</span>`
      : '';
    return `
      <div class="key-row">
        <span style="font-size:18px;">${p?.icon || '🔑'}</span>
        <span style="flex:1;">${p?.displayName || name} <span style="color:var(--text-muted);font-size:11px;">· ${t('settings.keys.encrypted')}</span>${browserBadge}</span>
        <button class="btn-ghost" data-test="${name}">${t('common.test')}</button>
        <button class="btn-danger" data-rm="${name}">×</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
    const name = b.getAttribute('data-rm');
    if (!confirm(`Retirer la clé ${name} ?`)) return;
    removeProviderKey(name);
    // Re-déverrouille les clés restantes en mémoire si possible
    toast('Clé retirée. Reconnecte-toi pour mettre à jour la session.', 'warning', 4000);
    renderTab('keys');
  }));
  list.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', async () => {
    const name = b.getAttribute('data-test');
    if (!isConnected()) { toast('Vault verrouillé', 'warning'); return; }
    const provider = getOrchestrator().providers[name];
    if (!provider) return;
    b.disabled = true; b.textContent = '⏳';
    let v;
    try { v = await provider.validate(); }
    catch (e) { v = { ok: false, error: e?.message || 'erreur' }; }
    b.disabled = false;
    // Affiche le résultat compact dans le bouton + détail en dessous de la ligne
    const explained = explainAsPillHTML(v);
    // Le bouton ne supporte que du texte simple, donc on injecte l'HTML dans un span sibling
    const row = b.closest('.key-row');
    let detailEl = row?.nextElementSibling;
    if (!detailEl || !detailEl.classList.contains('key-row-detail')) {
      detailEl = document.createElement('div');
      detailEl.className = 'key-row-detail';
      detailEl.style.cssText = 'margin:-4px 0 8px 36px;';
      row?.parentElement?.insertBefore(detailEl, row.nextSibling);
    }
    detailEl.innerHTML = `<div style="font-size:12px;">${explained}</div>${explainAsDetailHTML(v)}`;
    b.textContent = v.ok ? '✓' : '✗';
    setTimeout(() => b.textContent = 'Test', 4000);
  }));

  $('#set-lock').addEventListener('click', () => { clearRuntimeKeys(); location.reload(); });
  $('#set-forget').addEventListener('click', () => {
    if (confirm('Effacer le vault chiffré ? Toutes les clés API devront être ressaisies.')) {
      forgetVault(); clearRuntimeKeys(); location.reload();
    }
  });

  // Test individuel par clé dans le panneau "Ajouter / modifier" — valide une
  // seule clé à la blanc sans la sauvegarder ni nécessiter le mot de passe.
  c.querySelectorAll('[data-test-set]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-test-set');
      const input = $('#keys-set-' + name);
      const statusEl = c.querySelector(`[data-status-set="${name}"]`);
      const k = (input?.value || '').trim();
      if (!k) {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent-amber);">⚠ vide</span>';
        return;
      }
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳';
      if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;"></span>';
      try {
        const v = await validateProviderKey(name, k);
        if (statusEl) statusEl.innerHTML = explainAsPillHTML(v);
        // Affiche aussi l'explication détaillée sous le champ pour aiguiller l'user
        const fieldEl = statusEl?.closest('.field');
        let detailEl = fieldEl?.querySelector('.key-test-detail');
        const detailHTML = explainAsDetailHTML(v);
        if (detailHTML) {
          if (!detailEl) {
            detailEl = document.createElement('div');
            detailEl.className = 'key-test-detail';
            fieldEl?.appendChild(detailEl);
          }
          detailEl.innerHTML = detailHTML;
        } else if (detailEl) {
          detailEl.remove();
        }
      } catch (e) {
        if (statusEl) statusEl.innerHTML = explainAsPillHTML({ ok: false, error: e?.message || 'erreur' });
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });
  });

  $('#keys-save').addEventListener('click', async () => {
    const status = $('#keys-status');
    const pwd = $('#keys-pwd').value;
    if (!pwd) { status.textContent = 'Mot de passe requis'; status.style.color = 'var(--accent-red)'; return; }
    const newKeys = {};
    for (const p of KNOWN_PROVIDERS) {
      const v = $('#keys-set-' + p.name).value.trim();
      if (v) newKeys[p.name] = v;
    }
    if (!Object.keys(newKeys).length) { status.textContent = 'Rien à sauvegarder'; return; }
    status.textContent = '⏳ Sauvegarde...'; status.style.color = 'var(--text-secondary)';
    try {
      await setApiKeys(newKeys, pwd);
      // Re-unlock pour mettre à jour la session
      const all = await unlockVault(pwd);
      setRuntimeKeys(all);
      status.textContent = '✓ Sauvegardé'; status.style.color = 'var(--accent-green)';
      toast('Clés sauvegardées', 'success');
      setTimeout(() => renderTab('keys'), 600);
    } catch (e) {
      status.textContent = '✗ ' + e.message; status.style.color = 'var(--accent-red)';
    }
  });

  // === Tester toutes les clés LLM configurées ===
  const llmTestBtn = c.querySelector('#llm-test-all');
  const llmResultsBox = c.querySelector('#llm-test-results');
  if (llmTestBtn && llmResultsBox && isConnected()) {
    llmTestBtn.addEventListener('click', async () => {
      const orch = getOrchestrator();
      const names = orch.getProviderNames();
      if (!names.length) {
        llmResultsBox.style.display = 'block';
        llmResultsBox.innerHTML = `<div style="color:var(--accent-amber);font-size:12.5px;">${isEN ? '⚠ No keys configured.' : '⚠ Aucune clé configurée.'}</div>`;
        return;
      }
      llmTestBtn.disabled = true;
      const oldLabel = llmTestBtn.textContent;
      llmTestBtn.textContent = isEN ? '⏳ Testing…' : '⏳ Test en cours…';
      llmResultsBox.style.display = 'block';
      llmResultsBox.innerHTML = `<div id="lt-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;"></div>`;
      const grid = llmResultsBox.querySelector('#lt-grid');
      const pills = {};
      for (const name of names) {
        const meta = KNOWN_PROVIDERS.find(p => p.name === name) || { displayName: name, icon: '·' };
        const pill = document.createElement('div');
        pill.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px;';
        pill.innerHTML = `<span style="font-size:14px;">${meta.icon}</span><span style="flex:1;font-size:12px;">${meta.displayName}</span><span class="lt-status" style="color:var(--text-muted);font-size:11px;">⏳</span>`;
        grid.appendChild(pill);
        pills[name] = pill;
      }
      let okCount = 0, failCount = 0;
      const failures = [];
      await Promise.all(names.map(async (name) => {
        const provider = orch.providers[name];
        const status = pills[name].querySelector('.lt-status');
        const meta = KNOWN_PROVIDERS.find(p => p.name === name) || { displayName: name };
        try {
          const v = await provider.validate();
          status.innerHTML = explainAsPillHTML(v);
          if (v.ok) okCount++;
          else { failCount++; failures.push({ label: meta.displayName, v }); }
        } catch (e) {
          const errResult = { ok: false, error: e?.message || 'error' };
          status.innerHTML = explainAsPillHTML(errResult);
          failCount++; failures.push({ label: meta.displayName, v: errResult });
        }
      }));
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:12px;';
      if (failCount === 0) {
        summary.style.background = 'rgba(0,255,136,0.08)';
        summary.style.color = 'var(--accent-green)';
        summary.textContent = isEN ? `✅ All ${okCount} LLM keys are working.` : `✅ Les ${okCount} clés LLM sont opérationnelles.`;
        llmResultsBox.appendChild(summary);
      } else {
        summary.style.background = 'rgba(255,80,80,0.08)';
        summary.style.color = 'var(--accent-red)';
        summary.innerHTML = isEN
          ? `⚠️ ${okCount} OK · ${failCount} failed. <strong>Details below</strong>:`
          : `⚠️ ${okCount} OK · ${failCount} échec(s). <strong>Détails ci-dessous</strong> :`;
        llmResultsBox.appendChild(summary);
        const details = document.createElement('div');
        details.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:8px;';
        for (const { label, v } of failures) {
          const block = document.createElement('div');
          block.innerHTML = `<div style="font-size:12.5px;font-weight:600;color:var(--text-primary);">${label}</div>${explainAsDetailHTML(v)}`;
          details.appendChild(block);
        }
        llmResultsBox.appendChild(details);
      }
      llmTestBtn.disabled = false;
      llmTestBtn.textContent = isEN ? '⚡ Re-test all' : '⚡ Re-tester toutes';
    });
  }
}

// === ROUTING ===
function renderRoutingTab(c) {
  if (!isConnected()) { c.innerHTML = '<div class="alert alert-warning">Vault verrouillé.</div>'; return; }
  const preview = getOrchestrator().getRoutingPreview();
  const settings = getSettings();
  const overrides = settings.moduleOverrides || {};
  const avail = getOrchestrator().getProviderNames();
  const isEN = getLocale() === 'en';

  // Coûts estimés par module : utilise modelPricing pour le modèle actuellement choisi
  // Hypothèses moyennes par catégorie de module : input tokens × output tokens
  const MODULE_TOKEN_PROFILES = {
    'quick-analysis':         { input: 1500,  output: 800,  label_fr: 'Quick Analysis (verdict 30s)', label_en: 'Quick Analysis (30s verdict)' },
    'research-agent':         { input: 8000,  output: 4000, label_fr: 'Research Agent (analyse complète)', label_en: 'Research Agent (full analysis)' },
    'decoder-10k':            { input: 25000, output: 5000, label_fr: '10-K Decoder (PDF entier)', label_en: '10-K Decoder (full PDF)' },
    'dcf':                    { input: 2500,  output: 2000, label_fr: 'DCF / Fair Value', label_en: 'DCF / Fair Value' },
    'macro-dashboard':        { input: 3000,  output: 2500, label_fr: 'Macro Dashboard', label_en: 'Macro Dashboard' },
    'crypto-fundamental':     { input: 4000,  output: 2500, label_fr: 'Crypto Fundamental', label_en: 'Crypto Fundamental' },
    'earnings-call':          { input: 30000, output: 4000, label_fr: 'Earnings Call (transcript)', label_en: 'Earnings Call (transcript)' },
    'whitepaper-reader':      { input: 20000, output: 3000, label_fr: 'Whitepaper Reader', label_en: 'Whitepaper Reader' },
    'sentiment-tracker':      { input: 4000,  output: 2000, label_fr: 'Sentiment Tracker (web search)', label_en: 'Sentiment Tracker (web search)' },
    'newsletter-investor':    { input: 5000,  output: 4000, label_fr: 'Newsletter (Voice clone)', label_en: 'Newsletter (Voice clone)' },
    'investment-memo':        { input: 4000,  output: 3500, label_fr: 'Investment Memo', label_en: 'Investment Memo' },
    'pre-mortem':             { input: 3500,  output: 3000, label_fr: 'Pre-Mortem', label_en: 'Pre-Mortem' },
    'stock-screener':         { input: 3000,  output: 2500, label_fr: 'Stock Screener', label_en: 'Stock Screener' },
    'portfolio-rebalancer':   { input: 4000,  output: 3000, label_fr: 'Portfolio Rebalancer', label_en: 'Portfolio Rebalancer' },
    'tax-optimizer-fr':       { input: 3500,  output: 3500, label_fr: 'Tax Optimizer FR', label_en: 'Tax Optimizer FR' },
    'tax-international':      { input: 3500,  output: 3500, label_fr: 'Tax Optimizer Int\'l', label_en: 'Tax Optimizer Int\'l' },
    'position-sizing':        { input: 1200,  output: 800,  label_fr: 'Position Sizing', label_en: 'Position Sizing' },
    'fire-calculator':        { input: 2000,  output: 2500, label_fr: 'FIRE Calculator', label_en: 'FIRE Calculator' },
    'stress-test':            { input: 4000,  output: 3000, label_fr: 'Stress Test', label_en: 'Stress Test' },
    'battle-mode':            { input: 5000,  output: 4000, label_fr: 'Battle Mode (5 rounds)', label_en: 'Battle Mode (5 rounds)' },
    'watchlist':              { input: 4000,  output: 2500, label_fr: 'Watchlist (brief 24h)', label_en: 'Watchlist (24h brief)' },
    'portfolio-audit':        { input: 6000,  output: 4500, label_fr: 'Portfolio Audit (Buffett-style)', label_en: 'Portfolio Audit (Buffett-style)' },
    'youtube-transcript':     { input: 35000, output: 4000, label_fr: 'YouTube + CEO Forensics', label_en: 'YouTube + CEO Forensics' },
    'fees-analysis':          { input: 4000,  output: 3500, label_fr: 'Frais cachés', label_en: 'Hidden Fees' },
    'wealth-method':          { input: 3000,  output: 2500, label_fr: 'Méthode patrimoniale', label_en: 'Wealth Method' },
    'insights-engine':        { input: 1500,  output: 1000, label_fr: 'Insights auto', label_en: 'Auto Insights' },
    'chatbot':                { input: 1000,  output: 600,  label_fr: 'Chat assistant (par message)', label_en: 'Chat assistant (per message)' },
    'trade-journal':          { input: 3000,  output: 2500, label_fr: 'Trade Journal', label_en: 'Trade Journal' },
    'knowledge-base':         { input: 3000,  output: 2000, label_fr: 'Knowledge Base (RAG)', label_en: 'Knowledge Base (RAG)' }
  };

  // Calcule le coût USD pour un module donné selon le modèle sélectionné dans la routing preview
  function estimateModuleCostUSD(moduleId, providerName, modelId) {
    const p = MODULE_TOKEN_PROFILES[moduleId];
    if (!p) return null;
    let pricing = null;
    try {
      // Cherche dans le catalogue le modèle correspondant
      // (lazy require de modelPricing pour éviter import au load)
      const orch = getOrchestrator();
      const provider = orch?.providers?.[providerName];
      if (!provider) return null;
      const caps = provider.getCapabilities();
      pricing = caps?.pricing?.[modelId];
      if (!pricing && provider.estimateCostUSD) {
        return provider.estimateCostUSD(p.input, p.output, modelId);
      }
    } catch {}
    if (!pricing) return null;
    return (p.input / 1e6) * pricing.input + (p.output / 1e6) * pricing.output;
  }

  // Synthèse des coûts par tier (moyenne sur l'ensemble des modules connus)
  const tierAverages = { fast: [], balanced: [], flagship: [] };
  for (const [id, sel] of Object.entries(preview)) {
    const tier = sel.tier || 'balanced';
    const cost = estimateModuleCostUSD(id, sel.provider, sel.model);
    if (cost != null && tierAverages[tier]) tierAverages[tier].push(cost);
  }
  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Détecte si l'user a des providers proxiés (les 4 ex-CORS-bloqués)
  const proxiedProviders = avail.filter(name => {
    const meta = KNOWN_PROVIDERS.find(p => p.name === name);
    return meta?.proxiedViaApp === true;
  });
  const hasOpenRouter = avail.includes('openrouter');

  c.innerHTML = `
    ${proxiedProviders.length && !hasOpenRouter ? `
    <!-- OpenRouter migration suggestion : si user a des providers proxiés mais pas OpenRouter -->
    <div class="card" style="border-left:4px solid var(--accent-amber);">
      <div class="card-title">🌀 ${isEN ? 'Faster + more reliable with OpenRouter' : 'Plus rapide + plus fiable avec OpenRouter'}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin:0 0 12px;">
        ${isEN
          ? `You have ${proxiedProviders.length} provider(s) routed via Alpha's CORS proxy (${proxiedProviders.join(', ')}). It works but adds latency. <strong>OpenRouter</strong> exposes the same models (Llama 3.x, Qwen, Mistral, GPT-4o, etc.) with native browser support — 1 key, 200+ models, zero CORS.`
          : `Tu as ${proxiedProviders.length} provider(s) routés via le proxy CORS Alpha (${proxiedProviders.join(', ')}). Ça marche mais ajoute de la latence. <strong>OpenRouter</strong> expose les mêmes modèles (Llama 3.x, Qwen, Mistral, GPT-4o, etc.) avec support browser natif — 1 clé, 200+ modèles, zéro CORS.`}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="btn-primary" style="text-decoration:none;display:inline-block;font-size:12.5px;padding:8px 14px;">
          ${isEN ? '🌀 Get an OpenRouter key (free)' : '🌀 Obtenir une clé OpenRouter (gratuit)'}
        </a>
        <button id="route-openrouter-info" class="btn-secondary" style="font-size:12.5px;padding:8px 14px;">
          ${isEN ? 'Why OpenRouter ?' : 'Pourquoi OpenRouter ?'}
        </button>
      </div>
      <details id="route-openrouter-detail" style="margin-top:10px;font-size:12px;color:var(--text-muted);">
        <summary style="cursor:pointer;">${isEN ? 'See model equivalents' : 'Voir les équivalences de modèles'}</summary>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11.5px;">
          <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:4px 6px;">${isEN ? 'Proxied provider' : 'Provider proxié'}</th><th style="text-align:left;padding:4px 6px;">${isEN ? 'OpenRouter equivalent (often free)' : 'Équivalent OpenRouter (souvent gratuit)'}</th></tr></thead>
          <tbody style="font-family:monospace;font-size:11px;">
            <tr><td style="padding:4px 6px;">🐙 GitHub Models</td><td style="padding:4px 6px;">openai/gpt-4o · meta-llama/llama-3.3-70b-instruct:free</td></tr>
            <tr><td style="padding:4px 6px;">🟢 NVIDIA NIM</td><td style="padding:4px 6px;">nvidia/llama-3.1-nemotron-70b-instruct:free</td></tr>
            <tr><td style="padding:4px 6px;">🤗 Hugging Face</td><td style="padding:4px 6px;">qwen/qwen-2.5-72b-instruct:free · mistralai/mistral-7b-instruct:free</td></tr>
            <tr><td style="padding:4px 6px;">☁️ Cloudflare AI</td><td style="padding:4px 6px;">meta-llama/llama-3.1-8b-instruct:free · google/gemma-2-9b-it:free</td></tr>
          </tbody>
        </table>
      </details>
    </div>` : ''}

    <div class="card" style="border-left:4px solid var(--accent-green);">
      <div class="card-title">💰 ${isEN ? 'Estimated API costs' : 'Coûts API estimés'}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin:0 0 14px;">
        ${isEN
          ? 'Approximate cost per analysis based on the model currently selected for each module. <strong>You pay your AI provider directly</strong> (BYOK) — Alpha never proxies or stores your usage.'
          : 'Coût approximatif par analyse selon le modèle actuellement sélectionné pour chaque module. <strong>Tu paies ton provider IA directement</strong> (BYOK) — Alpha ne stocke ni ne re-route ton usage.'}
      </p>

      <div class="stat-grid" style="margin-bottom:14px;">
        <div class="stat"><div class="stat-label">⚡ ${isEN ? 'Fast tier average' : 'Moyenne fast'}</div><div class="stat-value">${fmtUSD(avg(tierAverages.fast))}</div><div style="font-size:10px;color:var(--text-muted);">${isEN ? 'per analysis' : 'par analyse'}</div></div>
        <div class="stat"><div class="stat-label">⚖️ ${isEN ? 'Balanced tier' : 'Moyenne balanced'}</div><div class="stat-value">${fmtUSD(avg(tierAverages.balanced))}</div><div style="font-size:10px;color:var(--text-muted);">${isEN ? 'per analysis' : 'par analyse'}</div></div>
        <div class="stat"><div class="stat-label">🏆 ${isEN ? 'Flagship tier' : 'Moyenne flagship'}</div><div class="stat-value">${fmtUSD(avg(tierAverages.flagship))}</div><div style="font-size:10px;color:var(--text-muted);">${isEN ? 'per analysis' : 'par analyse'}</div></div>
      </div>

      <details style="margin-bottom:8px;">
        <summary style="cursor:pointer;font-size:12.5px;color:var(--text-secondary);padding:6px 0;">${isEN ? '📋 Detail per module' : '📋 Détail par module'}</summary>
        <table class="wiz-routing" style="margin-top:8px;font-size:12px;">
          <thead><tr>
            <th>${isEN ? 'Module' : 'Module'}</th>
            <th>${isEN ? 'Selected provider' : 'Provider sélectionné'}</th>
            <th style="text-align:right;">${isEN ? 'Input/Output (tokens)' : 'Input/Output (tokens)'}</th>
            <th style="text-align:right;">${isEN ? 'Cost / analysis' : 'Coût / analyse'}</th>
            <th style="text-align:right;">${isEN ? '×100 analyses' : '×100 analyses'}</th>
          </tr></thead>
          <tbody>
            ${Object.entries(preview).filter(([id]) => MODULE_TOKEN_PROFILES[id]).map(([id, sel]) => {
              const p = MODULE_TOKEN_PROFILES[id];
              const cost = estimateModuleCostUSD(id, sel.provider, sel.model);
              const label = isEN ? (p.label_en || id) : (p.label_fr || id);
              return `<tr>
                <td><strong>${label}</strong></td>
                <td>${sel.icon || ''} ${sel.providerDisplay || sel.provider} <span style="color:var(--text-muted);font-size:10.5px;">(${sel.tier})</span></td>
                <td style="text-align:right;font-family:var(--font-mono);font-size:11px;">${p.input.toLocaleString()} / ${p.output.toLocaleString()}</td>
                <td style="text-align:right;font-family:var(--font-mono);">${cost != null ? fmtUSD(cost) : '<span style="color:var(--text-muted);">?</span>'}</td>
                <td style="text-align:right;font-family:var(--font-mono);color:var(--text-muted);">${cost != null ? fmtUSD(cost * 100) : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </details>

      <div style="background:var(--bg-tertiary);padding:10px;border-radius:4px;font-size:12px;line-height:1.6;">
        <strong>💡 ${isEN ? 'Order of magnitude' : 'Ordres de grandeur'} :</strong><br>
        ${isEN
          ? '• Light analyses (Quick Analysis, Position Sizing, Chatbot) : <strong>$0.001–$0.01</strong><br>• Mid analyses (DCF, Macro, Crypto fund.) : <strong>$0.02–$0.10</strong><br>• Heavy analyses (10-K, Earnings, YouTube) : <strong>$0.10–$0.50</strong><br>• Web search modules add <strong>$0.005–$0.02</strong> per call (Perplexity/Grok native, others billed separately).'
          : '• Analyses légères (Quick Analysis, Position Sizing, Chat) : <strong>$0,001–$0,01</strong><br>• Analyses moyennes (DCF, Macro, Crypto fond.) : <strong>$0,02–$0,10</strong><br>• Analyses lourdes (10-K, Earnings, YouTube) : <strong>$0,10–$0,50</strong><br>• Modules avec web search ajoutent <strong>$0,005–$0,02</strong> par appel (Perplexity/Grok natif, autres facturés séparément).'}
        <br><br>
        <strong>📊 ${isEN ? 'Realistic monthly budget' : 'Budget mensuel réaliste'} :</strong><br>
        ${isEN
          ? '• Casual user (5 analyses/week) : <strong>$2–$8/month</strong><br>• Active user (3 analyses/day) : <strong>$15–$40/month</strong><br>• Power user (research-agent + 10-K + youtube daily) : <strong>$50–$150/month</strong>'
          : '• Utilisateur occasionnel (5 analyses/semaine) : <strong>$2–$8/mois</strong><br>• Utilisateur actif (3 analyses/jour) : <strong>$15–$40/mois</strong><br>• Power user (research-agent + 10-K + youtube quotidien) : <strong>$50–$150/mois</strong>'}
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin:8px 0 0;">
        🔗 <a href="api-costs.html" target="_blank" rel="noopener">${isEN ? 'Full BYOK pricing guide →' : 'Guide complet des coûts BYOK →'}</a>
      </p>
    </div>

    <div class="card">
      <div class="card-title">${t('settings.routing.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">${t('settings.routing.desc')} <strong>L'icône ⭐ = provider optimal recommandé pour ce module.</strong> Les providers grisés ne sont pas encore configurés mais visibles pour info.</p>

      <!-- Tester toutes les clés configurées -->
      <div id="route-test-panel" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <strong style="font-size:13px;">${isEN ? '🧪 Test all configured keys' : '🧪 Tester toutes mes clés configurées'}</strong>
            <p style="color:var(--text-muted);font-size:11.5px;margin:4px 0 0;line-height:1.5;">
              ${isEN
                ? 'Pings each provider with a minimal validation request to confirm your keys are alive and authorized. Cost ≈ $0 (validation endpoints are free or near-free).'
                : 'Envoie une requête de validation minimale à chaque provider pour vérifier que tes clés répondent. Coût ≈ 0 $ (les endpoints de validation sont gratuits ou quasi-gratuits).'}
            </p>
          </div>
          <button id="route-test-all" class="btn-secondary" style="white-space:nowrap;font-size:12.5px;padding:8px 14px;">
            ${isEN ? '⚡ Test all keys' : '⚡ Tester toutes les clés'}
          </button>
        </div>
        <div id="route-test-results" style="margin-top:10px;display:none;"></div>
      </div>

      <table class="wiz-routing">
        <thead><tr><th>${t('settings.routing.col_module')}</th><th>${t('settings.routing.col_auto')}</th><th>${t('settings.routing.col_status')}</th><th>${t('settings.routing.col_override')}</th></tr></thead>
        <tbody>
          ${Object.entries(preview).map(([id, sel]) => {
            const ov = overrides[id]?.provider || 'auto';
            const routing = MODULE_ROUTING[id] || {};
            const optimalSet = new Set(routing.optimalProviders || []);
            const fallbackSet = new Set(routing.fallbackProviders || []);
            const availSet = new Set(avail);
            // Construit la liste des options : tous les providers connus
            const opts = KNOWN_PROVIDERS.map(p => {
              const configured = availSet.has(p.name);
              const isOptimal = optimalSet.has(p.name);
              const isFallback = fallbackSet.has(p.name);
              const star = isOptimal ? ' ⭐' : (isFallback ? ' ·' : '');
              const status = configured ? '' : ' (clé non configurée)';
              return `<option value="${p.name}" ${ov===p.name?'selected':''} ${configured?'':'disabled'}>${p.icon} ${p.displayName}${star}${status}</option>`;
            }).join('');
            return `
              <tr>
                <td><strong>${moduleLabel(id)}</strong><br><span style="font-size:11px;color:var(--text-muted);">${sel.reason || ''}</span></td>
                <td>${sel.error ? '<span style="color:var(--accent-red);">' + sel.error + '</span>' : sel.icon + ' ' + sel.providerDisplay + '<br><code style="font-size:10.5px;">' + sel.model + '</code>'}</td>
                <td>${sel.isOptimal ? `<span style="color:var(--accent-green);">${t('settings.routing.optimal')}</span>` : (sel.error ? '—' : `<span style="color:var(--accent-amber);">${t('settings.routing.fallback')}</span>`)}</td>
                <td>
                  <select class="input route-override" data-mod="${id}" style="font-size:11px;padding:4px 6px;min-width:180px;max-width:220px;">
                    <option value="auto" ${ov==='auto'?'selected':''}>🎯 Auto (smart router)</option>
                    ${opts}
                  </select>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.6;">
        ⭐ <strong>Provider optimal</strong> — recommandé pour ce module (selon caractéristiques : long contexte, web search, raisonnement, etc.).<br>
        · <strong>Fallback</strong> — fonctionne mais qualité un peu inférieure.<br>
        🎯 <strong>Auto</strong> — le smart router choisit automatiquement parmi tes clés configurées le meilleur disponible.
      </p>
    </div>

    ${(() => {
      // Liste les modules pure-local (pas dans MODULE_ROUTING) pour info
      const llmModules = new Set(Object.keys(MODULE_ROUTING));
      const localModules = ALL_MODULES.map(m => m.id).filter(id => !llmModules.has(id));
      if (!localModules.length) return '';
      return `
      <div class="card" style="border-left:4px solid var(--accent-blue);">
        <div class="card-title">🏠 ${isEN ? 'Pure local modules' : 'Modules 100% locaux'} (${localModules.length}) — ${isEN ? 'no AI provider needed' : 'pas de provider IA requis'}</div>
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:10px;">
          ${isEN
            ? 'These modules run entirely on your device with deterministic algorithms. No LLM call, no API cost, no data leaves your browser.'
            : 'Ces modules tournent intégralement sur ton appareil avec des algorithmes déterministes. Zéro appel LLM, zéro coût API, aucune donnée ne quitte ton navigateur.'}
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;font-size:12px;">
          ${localModules.map(id => `<div style="padding:6px 10px;background:var(--bg-tertiary);border-radius:4px;">✓ ${moduleLabel(id)}</div>`).join('')}
        </div>
      </div>`;
    })()}
  `;
  c.querySelectorAll('.route-override').forEach(sel => {
    sel.addEventListener('change', () => {
      const mod = sel.getAttribute('data-mod');
      const overrides = { ...(getSettings().moduleOverrides || {}) };
      if (sel.value === 'auto') delete overrides[mod];
      else overrides[mod] = { provider: sel.value };
      setSettings({ moduleOverrides: overrides });
      toast('Override mis à jour', 'success');
    });
  });

  // === Test all configured keys ===
  const testBtn = c.querySelector('#route-test-all');
  const resultsBox = c.querySelector('#route-test-results');
  if (testBtn && resultsBox) {
    testBtn.addEventListener('click', async () => {
      const orch = getOrchestrator();
      const names = orch.getProviderNames();
      if (!names.length) {
        resultsBox.style.display = 'block';
        resultsBox.innerHTML = `<div style="color:var(--accent-amber);font-size:12.5px;">${isEN ? '⚠ No keys configured. Add at least one in the Keys tab.' : '⚠ Aucune clé configurée. Ajoute-en au moins une dans l\'onglet Clés API.'}</div>`;
        return;
      }
      testBtn.disabled = true;
      const oldLabel = testBtn.textContent;
      testBtn.textContent = isEN ? '⏳ Testing…' : '⏳ Test en cours…';
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = `<div id="rt-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;font-size:12.5px;"></div>`;
      const grid = resultsBox.querySelector('#rt-grid');
      // Affiche d'abord toutes les pills en "pending"
      const pills = {};
      for (const name of names) {
        const meta = KNOWN_PROVIDERS.find(p => p.name === name) || { displayName: name, icon: '·' };
        const pill = document.createElement('div');
        pill.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px;';
        pill.innerHTML = `<span style="font-size:14px;">${meta.icon}</span><span style="flex:1;">${meta.displayName}</span><span class="rt-status" style="color:var(--text-muted);font-size:11px;">⏳</span>`;
        grid.appendChild(pill);
        pills[name] = pill;
      }
      // Test parallèle
      let okCount = 0, failCount = 0;
      const failures = [];
      await Promise.all(names.map(async (name) => {
        const provider = orch.providers[name];
        const status = pills[name].querySelector('.rt-status');
        const meta = KNOWN_PROVIDERS.find(p => p.name === name) || { displayName: name };
        try {
          const v = await provider.validate();
          status.innerHTML = explainAsPillHTML(v);
          if (v.ok) okCount++;
          else { failCount++; failures.push({ name, label: meta.displayName, v }); }
        } catch (e) {
          const errResult = { ok: false, error: e?.message || 'error' };
          status.innerHTML = explainAsPillHTML(errResult);
          failCount++; failures.push({ name, label: meta.displayName, v: errResult });
        }
      }));
      // Summary
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:12px;';
      if (failCount === 0) {
        summary.style.background = 'rgba(0,255,136,0.08)';
        summary.style.color = 'var(--accent-green)';
        summary.textContent = isEN ? `✅ All ${okCount} keys are working.` : `✅ Les ${okCount} clés sont opérationnelles.`;
        resultsBox.appendChild(summary);
      } else {
        summary.style.background = 'rgba(255,80,80,0.08)';
        summary.style.color = 'var(--accent-red)';
        summary.innerHTML = isEN
          ? `⚠️ ${okCount} OK · ${failCount} failed. <strong>Details below</strong>:`
          : `⚠️ ${okCount} OK · ${failCount} échec(s). <strong>Détails ci-dessous</strong> :`;
        resultsBox.appendChild(summary);
        // Détail explicatif pour chaque échec
        const details = document.createElement('div');
        details.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:8px;';
        for (const { label, v } of failures) {
          const block = document.createElement('div');
          block.innerHTML = `<div style="font-size:12.5px;font-weight:600;color:var(--text-primary);">${label}</div>${explainAsDetailHTML(v)}`;
          details.appendChild(block);
        }
        resultsBox.appendChild(details);
      }
      testBtn.disabled = false;
      testBtn.textContent = isEN ? '⚡ Re-test all' : '⚡ Re-tester toutes';
    });
  }
}

// === COSTS ===
function renderCostsTab(c) {
  const cost = getCost();
  const byP = cost.byProvider || {};
  const limits = getBudgetLimits();
  const isEN = getLocale() === 'en';
  const today = cost.todayUSD || 0;
  const month = cost.monthUSD || 0;
  // Pourcentage de barre pour les caps actifs
  const dailyPct = limits.dailyCapUSD > 0 ? Math.min(100, (today / limits.dailyCapUSD) * 100) : 0;
  const monthlyPct = limits.monthlyCapUSD > 0 ? Math.min(100, (month / limits.monthlyCapUSD) * 100) : 0;
  const barColor = (pct) => pct >= 90 ? 'var(--accent-red)' : pct >= 70 ? 'var(--accent-orange)' : 'var(--accent-green)';

  c.innerHTML = `
    <div class="card">
      <div class="card-title">${t('settings.costs.title')}</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-label">${t('home.cost_total')}</div><div class="stat-value green">${fmtUSD(cost.total || 0)}</div></div>
        <div class="stat"><div class="stat-label">${isEN ? 'Today' : 'Aujourd\u2019hui'}</div><div class="stat-value">${fmtUSD(today)}</div></div>
        <div class="stat"><div class="stat-label">${isEN ? 'This month' : 'Ce mois-ci'}</div><div class="stat-value">${fmtUSD(month)}</div></div>
        <div class="stat"><div class="stat-label">${t('home.api_calls')}</div><div class="stat-value">${cost.calls || 0}</div></div>
      </div>
      <table class="wiz-routing" style="margin-top:14px;">
        <thead><tr><th>${t('home.providers')}</th><th>${t('home.cost_total')}</th><th>${t('home.api_calls')}</th></tr></thead>
        <tbody>
          ${Object.entries(byP).map(([p, v]) => `<tr><td>${({claude:'🤖 Claude',openai:'🧠 OpenAI',gemini:'✨ Gemini',grok:'🐦 Grok'})[p] || p}</td><td>${fmtUSD(v.total)}</td><td>${v.calls}</td></tr>`).join('') || `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">${t('settings.costs.no_data')}</td></tr>`}
        </tbody>
      </table>
      <button id="cost-reset" class="btn-ghost" style="margin-top:12px;">${t('settings.costs.reset')}</button>
    </div>

    <div class="card" style="border-left:4px solid var(--accent-orange);">
      <div class="card-title">💸 ${isEN ? 'Budget control' : 'Contrôle du budget'}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin:0 0 14px;">
        ${isEN
          ? 'Cap your monthly / daily / per-call API spend. Useful when using premium providers (Claude, OpenAI, Gemini Pro) to avoid surprises.'
          : 'Plafonne ta dépense API par mois / jour / analyse. Utile avec les providers premium (Claude, OpenAI, Gemini Pro) pour éviter les surprises.'}
      </p>

      <label class="form-row" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:14px;">
        <input type="checkbox" id="bud-enabled" ${limits.enabled ? 'checked' : ''} />
        <strong>${isEN ? 'Enable budget control' : 'Activer le contrôle de budget'}</strong>
      </label>

      <div id="bud-fields" style="${limits.enabled ? '' : 'opacity:0.5;pointer-events:none;'}display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-size:13px;">
        <label>
          ${isEN ? 'Daily cap (USD)' : 'Plafond journalier (USD)'}
          <input type="number" id="bud-daily" min="0" step="0.10" value="${limits.dailyCapUSD || ''}" placeholder="${isEN ? '0 = unlimited' : '0 = illimité'}" class="input" />
          <small style="color:var(--text-muted);">${isEN ? 'Today' : 'Aujourd\u2019hui'} : <strong>${fmtUSD(today)}</strong>${limits.dailyCapUSD > 0 ? ` / ${fmtUSD(limits.dailyCapUSD)}` : ''}</small>
          ${limits.dailyCapUSD > 0 ? `<div class="bud-bar"><div class="bud-bar-fill" style="width:${dailyPct}%;background:${barColor(dailyPct)};"></div></div>` : ''}
        </label>
        <label>
          ${isEN ? 'Monthly cap (USD)' : 'Plafond mensuel (USD)'}
          <input type="number" id="bud-monthly" min="0" step="1" value="${limits.monthlyCapUSD || ''}" placeholder="${isEN ? '0 = unlimited' : '0 = illimité'}" class="input" />
          <small style="color:var(--text-muted);">${isEN ? 'This month' : 'Ce mois'} : <strong>${fmtUSD(month)}</strong>${limits.monthlyCapUSD > 0 ? ` / ${fmtUSD(limits.monthlyCapUSD)}` : ''}</small>
          ${limits.monthlyCapUSD > 0 ? `<div class="bud-bar"><div class="bud-bar-fill" style="width:${monthlyPct}%;background:${barColor(monthlyPct)};"></div></div>` : ''}
        </label>
        <label>
          ${isEN ? 'Per-call cap (USD)' : 'Plafond par analyse (USD)'}
          <input type="number" id="bud-percall" min="0" step="0.01" value="${limits.perCallCapUSD || ''}" placeholder="${isEN ? '0 = unlimited' : '0 = illimité'}" class="input" />
          <small style="color:var(--text-muted);">${isEN ? 'Refuses any single analysis above this amount.' : 'Refuse toute analyse au-dessus de ce montant.'}</small>
        </label>
        <label>
          ${isEN ? 'When limit reached' : 'Quand la limite est atteinte'}
          <select id="bud-action" class="input">
            <option value="warn" ${limits.action === 'warn' ? 'selected' : ''}>⚠️ ${isEN ? 'Warn (analysis still runs)' : 'Avertir (analyse lancée)'}</option>
            <option value="block" ${limits.action === 'block' ? 'selected' : ''}>🚫 ${isEN ? 'Block (refuse analysis)' : 'Bloquer (refuser l\u2019analyse)'}</option>
          </select>
        </label>
      </div>

      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="bud-save" class="btn-primary">${isEN ? 'Save limits' : 'Enregistrer'}</button>
        <button id="bud-preset-light" class="btn-ghost">${isEN ? 'Preset: light ($5/month)' : 'Préset : light ($5/mois)'}</button>
        <button id="bud-preset-active" class="btn-ghost">${isEN ? 'Preset: active ($30/month)' : 'Préset : actif ($30/mois)'}</button>
        <button id="bud-preset-power" class="btn-ghost">${isEN ? 'Preset: power ($100/month)' : 'Préset : intensif ($100/mois)'}</button>
      </div>

      <div style="margin-top:14px;padding:10px;background:var(--bg-tertiary);border-radius:6px;font-size:12px;line-height:1.7;">
        💡 ${isEN
          ? '<strong>Recommended setup</strong>: combine "Block" action + a per-call cap (e.g. $0.50) to prevent runaway 10-K Decoder calls. Set a monthly cap matching your budget.'
          : '<strong>Recommandé</strong> : combine action "Bloquer" + plafond par analyse (ex: $0,50) pour éviter qu\u2019un 10-K Decoder explose ton budget. Mets un plafond mensuel calé sur ton vrai budget.'}<br><br>
        ${isEN
          ? 'These limits run <strong>locally in your browser</strong> — they do not prevent provider-side overages if you have other apps using the same API key. Set a hard limit at your provider too (Anthropic / OpenAI dashboards offer monthly caps).'
          : 'Ces limites tournent <strong>localement dans ton navigateur</strong> — elles ne bloquent pas les autres apps qui utilisent la même clé. Mets aussi une vraie limite côté provider (Anthropic / OpenAI offrent des plafonds mensuels).'}
      </div>
    </div>
  `;

  $('#cost-reset').addEventListener('click', () => {
    if (confirm(isEN ? 'Reset cost counter?' : 'Reset le compteur de coût ?')) { resetTotalCost(); toast('Reset', 'success'); renderTab('costs'); }
  });

  // Budget toggles
  $('#bud-enabled').addEventListener('change', () => {
    setBudgetLimits({ enabled: $('#bud-enabled').checked });
    renderTab('costs');
  });
  $('#bud-save').addEventListener('click', () => {
    setBudgetLimits({
      dailyCapUSD: Number($('#bud-daily').value) || 0,
      monthlyCapUSD: Number($('#bud-monthly').value) || 0,
      perCallCapUSD: Number($('#bud-percall').value) || 0,
      action: $('#bud-action').value
    });
    toast(isEN ? 'Budget saved' : 'Budget enregistré', 'success');
    renderTab('costs');
  });
  $('#bud-preset-light').addEventListener('click', () => {
    setBudgetLimits({ enabled: true, dailyCapUSD: 0.50, monthlyCapUSD: 5, perCallCapUSD: 0.10, action: 'warn' });
    toast(isEN ? 'Light preset applied' : 'Préset light appliqué', 'success');
    renderTab('costs');
  });
  $('#bud-preset-active').addEventListener('click', () => {
    setBudgetLimits({ enabled: true, dailyCapUSD: 2, monthlyCapUSD: 30, perCallCapUSD: 0.50, action: 'warn' });
    toast(isEN ? 'Active preset applied' : 'Préset actif appliqué', 'success');
    renderTab('costs');
  });
  $('#bud-preset-power').addEventListener('click', () => {
    setBudgetLimits({ enabled: true, dailyCapUSD: 6, monthlyCapUSD: 100, perCallCapUSD: 1.50, action: 'warn' });
    toast(isEN ? 'Power preset applied' : 'Préset intensif appliqué', 'success');
    renderTab('costs');
  });
}

// === MODELS ===
function renderModelsTab(c) {
  const settings = getSettings();
  const m = settings.modelOverrides || {};
  const customCatalog = settings.customModelCatalog || {};
  c.innerHTML = `
    <div class="card">
      <div class="card-title">${t('settings.models.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">${t('settings.models.desc')}</p>
      ${KNOWN_PROVIDERS.map(p => {
        const catalog = MODEL_CATALOG[p.name] || [];
        const custom = customCatalog[p.name] || [];
        const allModels = [...catalog, ...custom];
        const ov = m[p.name] || {};
        return `
        <div class="card" style="background:var(--bg-tertiary);">
          <div class="card-title">${p.icon} ${p.displayName}</div>
          <div class="field-row-3">
            ${['flagship','balanced','fast'].map(tier => `
              <div class="field">
                <label class="field-label">${tier}</label>
                <select class="input model-select" data-prov="${p.name}" data-tier="${tier}">
                  ${allModels.map(mod => `<option value="${mod.id}" ${ov[tier]===mod.id?'selected':''} ${mod.tier===tier?'':''}>${mod.label}${mod.recommended?' ★':''} (${mod.tier})</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>
          <details style="margin-top:8px;">
            <summary style="cursor:pointer;color:var(--accent-blue);font-size:11.5px;">${t('settings.models.add_custom')}</summary>
            <div class="field-row" style="margin-top:8px;">
              <div class="field"><label class="field-label">Model ID</label><input class="input custom-id" data-prov="${p.name}" placeholder="ex: claude-opus-5" /></div>
              <div class="field">
                <label class="field-label">Tier</label>
                <select class="input custom-tier" data-prov="${p.name}"><option>flagship</option><option>balanced</option><option>fast</option></select>
              </div>
            </div>
            <button class="btn-secondary add-custom" data-prov="${p.name}">${t('settings.models.add')}</button>
          </details>
        </div>
      `;
      }).join('')}
      <button id="models-save" class="btn-primary" style="margin-top:8px;">${t('common.save')}</button>
      <button id="models-reset" class="btn-ghost" style="margin-left:8px;">${t('settings.models.reset')}</button>
    </div>

    <div class="card">
      <div class="card-title">${t('settings.models.prompts.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">${t('settings.models.prompts.desc')}</p>
      ${Object.keys(MODULE_ROUTING).map(id => `
        <details style="margin-bottom:6px;border:1px solid var(--border);border-radius:4px;padding:0 12px;">
          <summary style="cursor:pointer;padding:10px 0;font-size:13px;">${moduleLabel(id)}</summary>
          <textarea class="textarea custom-prompt" data-mod="${id}" rows="6" placeholder="${t('settings.models.prompts.placeholder')}">${(settings.customPrompts || {})[id] || ''}</textarea>
        </details>
      `).join('')}
      <button id="prompts-save" class="btn-primary" style="margin-top:10px;">${t('settings.models.prompts.save')}</button>
      <button id="prompts-reset" class="btn-ghost" style="margin-left:8px;">${t('settings.models.prompts.reset')}</button>
    </div>
  `;
  $('#models-save').addEventListener('click', () => {
    const overrides = { ...(getSettings().modelOverrides || {}) };
    c.querySelectorAll('.model-select').forEach(i => {
      const prov = i.getAttribute('data-prov');
      const tier = i.getAttribute('data-tier');
      if (!overrides[prov]) overrides[prov] = {};
      overrides[prov][tier] = i.value;
    });
    setSettings({ modelOverrides: overrides });
    toast('Modèles sauvegardés. Recharge la page pour appliquer.', 'success');
  });
  $('#models-reset').addEventListener('click', () => {
    setSettings({ modelOverrides: {} });
    location.reload();
  });
  c.querySelectorAll('.add-custom').forEach(btn => btn.addEventListener('click', () => {
    const prov = btn.getAttribute('data-prov');
    const id = c.querySelector(`.custom-id[data-prov="${prov}"]`).value.trim();
    const tier = c.querySelector(`.custom-tier[data-prov="${prov}"]`).value;
    if (!id) { toast('ID requis', 'warning'); return; }
    const settings = getSettings();
    const cc = { ...(settings.customModelCatalog || {}) };
    if (!cc[prov]) cc[prov] = [];
    cc[prov].push({ id, tier, label: id + ' (custom)', context: 200000, pricing: { input: 1, output: 5 } });
    setSettings({ customModelCatalog: cc });
    toast('Modèle ajouté', 'success');
    renderTab('models');
  }));
  $('#prompts-save').addEventListener('click', () => {
    const cp = {};
    c.querySelectorAll('.custom-prompt').forEach(t => {
      const id = t.getAttribute('data-mod');
      const v = t.value.trim();
      if (v) cp[id] = v;
    });
    setSettings({ customPrompts: cp });
    toast('Prompts sauvegardés', 'success');
  });
  $('#prompts-reset').addEventListener('click', () => {
    setSettings({ customPrompts: {} });
    toast('Reset', 'success');
    renderTab('models');
  });
}

// === ADVANCED ===
function renderAdvancedTab(c) {
  const s = getSettings();
  c.innerHTML = `
    <div class="card" style="border-left:4px solid var(--accent-green);">
      <div class="card-title">🪙 ${getLocale() === 'en' ? 'Cost optimization' : 'Optimisation des coûts'}</div>
      <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;line-height:1.5;">
        ${getLocale() === 'en'
          ? 'Reduce your API costs by up to 70% without losing quality.'
          : 'Réduis tes coûts API jusqu\'à 70% sans perte de qualité notable.'}
      </p>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;cursor:pointer;padding:10px;border:1px solid var(--border);border-radius:6px;background:${s.ecoMode ? 'rgba(0,255,136,0.06)' : 'transparent'};">
        <input type="checkbox" id="set-eco-mode" ${s.ecoMode ? 'checked' : ''} style="margin-top:3px;" />
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">🪙 ${getLocale() === 'en' ? 'Eco mode (force balanced tier everywhere)' : 'Mode Éco (force le tier balanced partout)'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;line-height:1.4;">
            ${getLocale() === 'en'
              ? 'Sonnet 4.6 / GPT-5 Mini / Gemini Flash instead of Opus / GPT-5 / Gemini Pro. ~5× cheaper, quality difference rarely noticeable.'
              : 'Sonnet 4.6 / GPT-5 Mini / Gemini Flash au lieu de Opus / GPT-5 / Gemini Pro. ~5× moins cher, différence de qualité rarement sensible.'}
          </div>
        </div>
      </label>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;cursor:pointer;padding:10px;border:1px solid var(--border);border-radius:6px;background:${s.cacheResults ? 'rgba(0,255,136,0.06)' : 'transparent'};">
        <input type="checkbox" id="set-cache-results" ${s.cacheResults !== false ? 'checked' : ''} style="margin-top:3px;" />
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">⚡ ${getLocale() === 'en' ? 'Cache results 24h (skip duplicate analyses)' : 'Cache des résultats 24h (évite les analyses doublons)'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;line-height:1.4;">
            ${getLocale() === 'en'
              ? 'Same input within 24h → reuse the cached result with a "Re-run" button. Saves 30-40% in real usage.'
              : 'Même input dans les 24h → réutilise le résultat caché avec un bouton "Re-lancer". Économie 30-40% en usage réel.'}
          </div>
        </div>
      </label>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;cursor:pointer;padding:10px;border:1px solid var(--border);border-radius:6px;background:${s.promptCaching !== false ? 'rgba(0,255,136,0.06)' : 'transparent'};">
        <input type="checkbox" id="set-prompt-caching" ${s.promptCaching !== false ? 'checked' : ''} style="margin-top:3px;" />
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">💾 ${getLocale() === 'en' ? 'Anthropic prompt caching (-90% on cached tokens)' : 'Prompt caching Anthropic (-90% sur tokens cachés)'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;line-height:1.4;">
            ${getLocale() === 'en'
              ? 'Caches the system prompt + wealth context on Anthropic. Repeated analyses cost 10× less on Claude.'
              : 'Cache le system prompt + contexte patrimoine côté Anthropic. Analyses répétées coûtent 10× moins sur Claude.'}
          </div>
        </div>
      </label>
      <div class="field" style="margin-top:14px;">
        <label class="field-label">💰 ${getLocale() === 'en' ? 'Budget cap per analysis ($)' : 'Plafond de coût par analyse ($)'}</label>
        <input id="set-budget-cap" class="input" type="number" step="0.01" min="0" value="${s.budgetCapUSD || ''}" placeholder="${getLocale() === 'en' ? '0 = no cap' : '0 = pas de plafond'}" style="max-width:160px;" />
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
          ${getLocale() === 'en'
            ? 'Aborts an analysis if its cost exceeds this threshold. Recommended: $0.50.'
            : 'Annule une analyse si son coût dépasse ce seuil. Recommandé : $0,50.'}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">${t('settings.adv.title')}</div>
      <div class="field"><label class="field-label">${t('settings.adv.max_tokens')}</label><input id="set-maxtok" class="input" type="number" min="256" max="16000" step="256" value="${s.maxTokens}" /></div>
      <div class="field"><label class="field-label">${t('settings.adv.temp')}</label><input id="set-temp" class="input" type="number" min="0" max="1" step="0.1" value="${s.temperature}" /></div>
      <label style="display:flex;gap:8px;align-items:center;margin:12px 0;">
        <input type="checkbox" id="set-fb" ${s.autoFallback ? 'checked' : ''} /> ${t('settings.adv.fallback')}
      </label>
      <button id="set-save" class="btn-primary">${t('common.save')}</button>
    </div>
    <div class="card">
      <div class="card-title">${t('settings.adv.backup_title')}</div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;">${t('settings.adv.backup_desc')}</p>
      <div id="set-backup-stats" style="font-size:11.5px;color:var(--text-secondary);font-family:var(--font-mono);background:var(--bg-tertiary);padding:8px 12px;border-radius:4px;margin-bottom:12px;">${t('settings.adv.backup_loading')}</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button id="set-backup-full" class="btn-primary">📦 ${t('settings.adv.backup_full')}</button>
        <button id="set-backup-copy" class="btn-ghost" style="font-size:12.5px;" title="${t('settings.adv.backup_copy_tip')}">📋 ${t('settings.adv.backup_copy')}</button>
        <label class="btn-secondary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          📥 ${t('settings.adv.restore_full')}
          <input id="set-restore-full" type="file" accept=".atb,.json,application/json,application/octet-stream" hidden />
        </label>
        <button id="set-restore-paste" class="btn-secondary" style="display:inline-flex;align-items:center;gap:6px;" title="Coller un JSON copié pour restaurer">📋 Coller un backup</button>
        <button id="set-backup-diag" class="btn-ghost" style="font-size:12px;" title="Inspecter la DB locale pour vérifier ce qui sera exporté">🔍 Diagnostic</button>
      </div>

      <details style="margin-top:14px;">
        <summary style="cursor:pointer;font-size:12px;color:var(--text-muted);">⚙️ ${t('settings.adv.backup_options')}</summary>
        <div style="margin-top:10px;font-size:12px;color:var(--text-secondary);">
          <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <input type="radio" name="restore-mode" value="merge" checked />
            <span><strong>${t('settings.adv.restore_merge')}</strong> — ${t('settings.adv.restore_merge_desc')}</span>
          </label>
          <label style="display:flex;gap:8px;align-items:center;">
            <input type="radio" name="restore-mode" value="replace" />
            <span><strong>${t('settings.adv.restore_replace')}</strong> — ${t('settings.adv.restore_replace_desc')}</span>
          </label>
        </div>
      </details>

      <hr style="border:0;border-top:1px solid var(--border);margin:18px 0 12px;" />
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="set-clear-history" class="btn-ghost" style="font-size:12px;">${t('settings.adv.clear_history')}</button>
        <button id="set-wipe-all" class="btn-danger" style="font-size:12px;">⚠️ ${t('settings.adv.wipe_all')}</button>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">${t('settings.adv.wipe_warning')}</p>
    </div>
    <div class="card">
      <div class="card-title">${t('tour.replay')}</div>
      <button id="set-replay-tour" class="btn-secondary">${t('tour.replay')}</button>
      <button id="set-onboarding-redo" class="btn-secondary" style="margin-left:8px;">⭐ ${getLocale() === 'en' ? 'Redo profile questionnaire' : 'Refaire le questionnaire profil'}</button>
    </div>
    <div class="card">
      <div class="card-title">${t('settings.adv.shortcuts')}</div>
      <div style="font-size:12.5px;color:var(--text-secondary);line-height:2;">
        <kbd>⌘K</kbd> · ${t('settings.adv.shortcut_palette')} · &nbsp; <kbd>esc</kbd> · ${t('settings.adv.shortcut_close')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">${t('settings.adv.about')}</div>
      <p style="font-size:12.5px;color:var(--text-secondary);line-height:1.7;">
        Alpha · v2.1.0 · multi-LLM · 100% client-side · BYOK
      </p>
    </div>
  `;
  $('#set-save').addEventListener('click', () => {
    setSettings({
      ecoMode: $('#set-eco-mode')?.checked || false,
      cacheResults: $('#set-cache-results')?.checked !== false,
      promptCaching: $('#set-prompt-caching')?.checked !== false,
      budgetCapUSD: parseFloat($('#set-budget-cap')?.value) || 0,
      maxTokens: parseInt($('#set-maxtok').value, 10) || 4096,
      temperature: parseFloat($('#set-temp').value) || 1.0,
      autoFallback: $('#set-fb').checked
    });
    toast('Sauvegardé', 'success');
  });
  // Stats display
  refreshBackupStats();
  async function refreshBackupStats() {
    const el = $('#set-backup-stats');
    if (!el) return;
    try {
      const s = await getLocalDataStats();
      el.innerHTML = `
        ${s.analyses} ${t('settings.adv.stat_analyses')}
        · ${s.wealth} ${t('settings.adv.stat_holdings')}
        · ${s.wealth_snapshots} ${t('settings.adv.stat_snapshots')}
        · ${s.knowledge} ${t('settings.adv.stat_kb')}
        · ${s.transcripts} ${t('settings.adv.stat_transcripts')}
        · ${s.localStorageKeys} ${t('settings.adv.stat_settings')}
        ${s.hasVault ? ' · 🔒 ' + t('settings.adv.stat_vault') : ''}
      `;
    } catch (e) {
      el.textContent = 'Erreur stats: ' + e.message;
    }
  }

  $('#set-backup-full').addEventListener('click', async () => {
    const btn = $('#set-backup-full');
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ ' + t('settings.adv.exporting');
    try {
      const result = await downloadFullBackup();
      const { payload, method, json, filename } = result;
      const c = payload.counts || {};
      // Breakdown complet pour que l'utilisateur voie que tout est sauvé (pas que les analyses)
      const breakdown = [
        c.analyses ? `${c.analyses} analyses` : null,
        c.wealth ? `${c.wealth} holdings` : null,
        c.wealth_snapshots ? `${c.wealth_snapshots} snapshots` : null,
        c.knowledge ? `${c.knowledge} KB` : null,
        c.transcripts ? `${c.transcripts} transcripts` : null,
        c.budget_entries ? `${c.budget_entries} budget` : null,
        c.dividends_history ? `${c.dividends_history} divs` : null,
        c.insights_state ? `${c.insights_state} insights` : null,
        c.writingStyles ? `${c.writingStyles} styles` : null,
        c.localStorageKeys ? `${c.localStorageKeys} settings` : null
      ].filter(Boolean).join(' · ') || 'aucune donnée';

      if (method === 'failed') {
        // Aucune méthode n'a marché — on bascule sur la modale "show JSON" pour copy manuel
        showBackupFallbackModal(json, filename);
        toast(t('settings.adv.backup_failed_show_modal'), 'info');
      } else if (method === 'cancelled') {
        // Utilisateur a fermé la dialog system du picker — pas un succès, pas une erreur
        // (ne rien afficher)
      } else if (method === 'capacitor') {
        toast(`📦 Backup mobile : ${breakdown}`, 'success');
      } else {
        toast(`📦 Backup : ${breakdown}`, 'success');
      }
    } catch (err) {
      console.error(err);
      toast('Backup : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  $('#set-backup-copy').addEventListener('click', async () => {
    const btn = $('#set-backup-copy');
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ ' + t('settings.adv.exporting');
    try {
      const r = await copyBackupToClipboard();
      btn.disabled = false; btn.textContent = old;
      if (r.ok) {
        const c = r.payload.counts || {};
        const breakdown = [
          c.analyses ? `${c.analyses} analyses` : null,
          c.wealth ? `${c.wealth} holdings` : null,
          c.wealth_snapshots ? `${c.wealth_snapshots} snapshots` : null,
          c.knowledge ? `${c.knowledge} KB` : null,
          c.transcripts ? `${c.transcripts} transcripts` : null,
          c.writingStyles ? `${c.writingStyles} styles` : null
        ].filter(Boolean).join(' · ') || 'aucune donnée';
        toast(`📋 Copié : ${breakdown}`, 'success');
      }
      else { showBackupFallbackModal(r.json, ''); toast(t('settings.adv.backup_failed_show_modal'), 'info'); }
    } catch (err) {
      btn.disabled = false; btn.textContent = old;
      toast('Copy : ' + err.message, 'error');
    }
  });

  function showBackupFallbackModal(json, filename) {
    // Affiche le JSON dans une textarea pour copy-paste manuel
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    w.innerHTML = `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:680px;width:100%;max-height:80vh;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${t('settings.adv.backup_fallback_title')}</strong>
          <button class="btn-ghost" id="bfm-close">×</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin:0;">${t('settings.adv.backup_fallback_desc')}${filename ? '<br>📄 <code>' + filename + '</code>' : ''}</p>
        <textarea readonly style="flex:1;min-height:300px;font-family:monospace;font-size:11px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:10px;">${json.replace(/</g,'&lt;')}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn-secondary" id="bfm-copy">📋 ${t('common.copy')}</button>
          <button class="btn-primary" id="bfm-close-2">${t('common.close')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(w);
    const ta = w.querySelector('textarea');
    ta.focus();
    ta.select();
    w.querySelector('#bfm-copy').addEventListener('click', async () => {
      ta.select();
      try { await navigator.clipboard.writeText(ta.value); toast('Copié', 'success'); }
      catch { document.execCommand('copy'); toast('Copié', 'success'); }
    });
    const close = () => document.body.removeChild(w);
    w.querySelector('#bfm-close').addEventListener('click', close);
    w.querySelector('#bfm-close-2').addEventListener('click', close);
    w.addEventListener('click', (e) => { if (e.target === w) close(); });
  }

  $('#set-restore-full').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const mode = document.querySelector('input[name="restore-mode"]:checked')?.value || 'merge';
    if (mode === 'replace') {
      if (!confirm(t('settings.adv.restore_replace_confirm'))) { e.target.value = ''; return; }
    }
    try {
      const counts = await importBackupFromFile(file, { mode });
      const breakdown = formatRestoreBreakdown(counts);
      toast(`📥 Restauré : ${breakdown}`, 'success');
      if (counts.missingStores && counts.missingStores.length) {
        toast(`⚠️ Stores impossibles à créer : ${counts.missingStores.join(', ')} — recharge la page puis réessaie`, 'error');
      }
      await refreshBackupStats();
      // Reload soft : invite l'utilisateur à recharger pour appliquer
      setTimeout(() => {
        if (confirm(t('settings.adv.restore_reload_prompt'))) location.reload();
      }, 800);
    } catch (err) {
      toast('Import : ' + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  });

  function formatRestoreBreakdown(counts) {
    const a = counts.added || {};
    const parts = [
      a.analyses ? `${a.analyses} analyses` : null,
      a.wealth ? `${a.wealth} holdings` : null,
      a.wealth_snapshots ? `${a.wealth_snapshots} snapshots` : null,
      a.knowledge ? `${a.knowledge} KB` : null,
      a.transcripts ? `${a.transcripts} transcripts` : null,
      a.writingStyles ? `${a.writingStyles} styles` : null,
      counts.localStorageKeys ? `${counts.localStorageKeys} settings` : null
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'aucune donnée';
  }

  // Diagnostic : montre exactement ce qui est dans la DB (utile pour comprendre si le backup
  // contient bien les holdings, snapshots, etc., ou si ces données ont disparu côté DB)
  $('#set-backup-diag').addEventListener('click', async () => {
    const btn = $('#set-backup-diag');
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Inspection…';
    try {
      const r = await diagnosticBackup();
      showDiagnosticModal(r);
    } catch (e) {
      toast('Diagnostic : ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  function showDiagnosticModal(r) {
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    const storesRows = r.storesInDb.length === 0
      ? '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:10px;">⚠️ Aucun store dans la DB</td></tr>'
      : r.storesInDb.map(name => {
          const info = r.perStore[name] || {};
          const known = r.storesExpected.includes(name);
          const sampleStr = info.sample && info.sample.length
            ? '<details><summary style="cursor:pointer;color:var(--text-muted);font-size:11px;">Voir échantillon</summary><pre style="margin:4px 0 0;padding:6px;background:var(--bg-tertiary);border-radius:3px;font-size:10px;overflow:auto;max-height:200px;">'
              + JSON.stringify(info.sample, null, 2).replace(/</g,'&lt;') + '</pre></details>'
            : '';
          return `<tr>
            <td style="padding:6px;font-family:monospace;font-size:12px;">${known ? '✅' : '⚠️'} ${name}</td>
            <td style="padding:6px;font-family:monospace;font-size:12px;text-align:right;color:${info.count > 0 ? 'var(--accent-green)' : 'var(--text-muted)'};">${info.count ?? 0}</td>
            <td style="padding:6px;font-size:11px;">${sampleStr}</td>
          </tr>`;
        }).join('');

    const missingWarn = r.storesMissing.length
      ? `<div style="background:#7a3a00;color:#ffe;padding:8px 10px;border-radius:4px;font-size:12px;margin:8px 0;">
          ⚠️ <strong>Stores attendus mais absents :</strong> ${r.storesMissing.join(', ')}.<br>
          Si la DB existait à une version inférieure, certains stores n'ont pas été créés.
          <strong>Solution</strong> : ouvre une fois le module concerné (ex. Patrimoine) pour forcer la création, puis relance le backup.
        </div>` : '';
    const unexpectedWarn = r.storesUnexpected.length
      ? `<div style="background:#005577;color:#fff;padding:8px 10px;border-radius:4px;font-size:12px;margin:8px 0;">
          ℹ️ <strong>Stores trouvés mais non listés dans le backup :</strong> ${r.storesUnexpected.join(', ')}.<br>
          Ces données ne seront <strong>pas</strong> incluses dans le backup actuel.
        </div>` : '';

    w.innerHTML = `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:760px;width:100%;max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>🔍 Diagnostic de la base locale</strong>
          <button class="btn-ghost" id="diag-close">×</button>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);font-family:monospace;background:var(--bg-tertiary);padding:8px 10px;border-radius:4px;">
          DB : <strong>${r.dbName}</strong>
          · version réelle : <strong>${r.actualVersion ?? 'erreur'}</strong>
          · attendue : ${r.requestedVersion}
          ${r.error ? `<br>❌ ${r.error}` : ''}
        </div>
        ${missingWarn}
        ${unexpectedWarn}
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="border-bottom:1px solid var(--border);text-align:left;">
            <th style="padding:6px;">Store</th>
            <th style="padding:6px;text-align:right;">Records</th>
            <th style="padding:6px;">Échantillon</th>
          </tr></thead>
          <tbody>${storesRows}</tbody>
        </table>
        <div style="margin-top:6px;font-size:12px;color:var(--text-secondary);">
          📦 <strong>localStorage</strong> : ${r.localStorage.kept} clés app conservées sur ${r.localStorage.total} totales.
          ${r.localStorage.sampleKeys.length ? `<details><summary style="cursor:pointer;font-size:11px;color:var(--text-muted);">Voir clés</summary><pre style="margin:4px 0 0;padding:6px;background:var(--bg-tertiary);border-radius:3px;font-size:10px;overflow:auto;">${r.localStorage.sampleKeys.join('\n').replace(/</g,'&lt;')}</pre></details>` : ''}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button class="btn-secondary" id="diag-copy">📋 Copier le rapport</button>
          <button class="btn-primary" id="diag-close-2">Fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(w);
    const close = () => { try { document.body.removeChild(w); } catch {} };
    w.querySelector('#diag-close').addEventListener('click', close);
    w.querySelector('#diag-close-2').addEventListener('click', close);
    w.addEventListener('click', (e) => { if (e.target === w) close(); });
    w.querySelector('#diag-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(r, null, 2)); toast('Rapport copié', 'success'); }
      catch { toast('Copy refusé', 'error'); }
    });
  }

  // Paste-and-restore : ouvre une modale pour coller un JSON et restaurer directement
  $('#set-restore-paste').addEventListener('click', () => {
    showPasteRestoreModal();
  });

  function showPasteRestoreModal() {
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    w.innerHTML = `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>📥 Restaurer depuis un JSON collé</strong>
          <button class="btn-ghost" id="prm-close">×</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin:0;">Colle ici le contenu d'un backup Alpha (JSON). Utile si tu as récupéré le backup via copy-paste plutôt que via un fichier <code>.atb</code>.</p>
        <textarea id="prm-textarea" placeholder='{"app":"alpha-terminal", ...}' style="flex:1;min-height:280px;font-family:monospace;font-size:11px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:10px;resize:vertical;"></textarea>
        <div style="display:flex;gap:14px;align-items:center;font-size:12px;color:var(--text-secondary);flex-wrap:wrap;">
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="radio" name="prm-mode" value="merge" checked />
            <span><strong>Fusionner</strong></span>
          </label>
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="radio" name="prm-mode" value="replace" />
            <span><strong>Remplacer</strong> (efface le state local)</span>
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;">
          <button class="btn-ghost" id="prm-paste-clipboard" style="font-size:12px;">📋 Coller depuis le presse-papier</button>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary" id="prm-cancel">Annuler</button>
            <button class="btn-primary" id="prm-restore">📥 Restaurer</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(w);
    const ta = w.querySelector('#prm-textarea');
    const close = () => { try { document.body.removeChild(w); } catch {} };
    setTimeout(() => ta.focus(), 50);

    w.querySelector('#prm-close').addEventListener('click', close);
    w.querySelector('#prm-cancel').addEventListener('click', close);
    w.addEventListener('click', (e) => { if (e.target === w) close(); });

    w.querySelector('#prm-paste-clipboard').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) { ta.value = text; toast('Collé depuis le presse-papier', 'success'); }
        else toast('Presse-papier vide', 'info');
      } catch (e) {
        toast('Lecture du presse-papier refusée — colle manuellement (⌘V/Ctrl+V)', 'info');
      }
    });

    w.querySelector('#prm-restore').addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) { toast('Colle un JSON avant de restaurer', 'error'); return; }
      let payload;
      try { payload = JSON.parse(text); }
      catch (e) { toast('JSON invalide : ' + e.message, 'error'); return; }
      if (!payload || payload.app !== 'alpha-terminal') {
        toast('Pas un backup Alpha (champ "app" manquant)', 'error');
        return;
      }
      const mode = w.querySelector('input[name="prm-mode"]:checked')?.value || 'merge';
      if (mode === 'replace') {
        if (!confirm(t('settings.adv.restore_replace_confirm'))) return;
      }
      const btn = w.querySelector('#prm-restore');
      btn.disabled = true;
      btn.textContent = '⏳ Restauration…';
      try {
        const { importFullBackup } = await import('../core/backup.js');
        const counts = await importFullBackup(payload, { mode });
        const breakdown = formatRestoreBreakdown(counts);
        toast(`📥 Restauré : ${breakdown}`, 'success');
        if (counts.missingStores && counts.missingStores.length) {
          toast(`⚠️ Stores impossibles à créer : ${counts.missingStores.join(', ')} — recharge la page puis réessaie`, 'error');
        }
        close();
        await refreshBackupStats();
        setTimeout(() => {
          if (confirm(t('settings.adv.restore_reload_prompt'))) location.reload();
        }, 600);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '📥 Restaurer';
        toast('Import : ' + err.message, 'error');
      }
    });
  }

  $('#set-clear-history').addEventListener('click', async () => {
    if (confirm(t('settings.adv.clear_confirm'))) {
      await clearAnalyses();
      toast(t('settings.adv.clear_done'), 'success');
      await refreshBackupStats();
    }
  });

  $('#set-wipe-all').addEventListener('click', async () => {
    if (!confirm(t('settings.adv.wipe_confirm_1'))) return;
    if (!confirm(t('settings.adv.wipe_confirm_2'))) return;
    try {
      await wipeAllLocalData();
      toast(t('settings.adv.wipe_done'), 'success');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast('Wipe : ' + err.message, 'error'); }
  });
  const replayBtn = $('#set-replay-tour');
  if (replayBtn) replayBtn.addEventListener('click', () => { resetTour(); startTour(); });

  // Re-do onboarding questionnaire
  const onbBtn = $('#set-onboarding-redo');
  if (onbBtn) onbBtn.addEventListener('click', async () => {
    const { openOnboardingQuestionnaire } = await import('./onboarding-questionnaire.js');
    openOnboardingQuestionnaire({ onComplete: () => location.hash = '#home' });
  });
}

function moduleLabel(id) {
  return t('mod.' + id + '.label') || id;
}
