// Settings v3 — onglets : keys / routing / costs / models / advanced
import { $, toast, fmtUSD } from '../core/utils.js';
import { getSettings, setSettings, clearAnalyses, listAnalyses, saveAnalysis } from '../core/storage.js';
import { hasVault, vaultProviderNames, setApiKeys, removeProviderKey, forgetVault, unlockVault } from '../core/crypto.js';
import { isConnected, clearRuntimeKeys, setRuntimeKeys, validateProviderKey, KNOWN_PROVIDERS, getOrchestrator, MODULE_ROUTING } from '../core/api.js';
import { getCost, resetTotalCost } from '../core/cost-tracker.js';
import { MODEL_CATALOG } from '../core/models-catalog.js';
import { t } from '../core/i18n.js';
import { DATA_PROVIDERS, KEYLESS_DATA_SOURCES, getDataKey, setDataKey, getDataKeyStatus } from '../core/data-keys.js';
import { resetTour, startTour } from './tour.js';
import { downloadFullBackup, importBackupFromFile, getLocalDataStats, wipeAllLocalData, copyBackupToClipboard } from '../core/backup.js';

let currentTab = 'keys';

export function renderSettingsView(viewEl) {
  viewEl.innerHTML = `
    <div class="module-header"><h2>${t('settings.title')}</h2><div class="module-desc">${t('settings.desc')}</div></div>
    <div class="tabs-bar">
      ${['keys','data_keys','routing','costs','models','advanced'].map(tab => `<button class="tab ${tab===currentTab?'active':''}" data-tab="${tab}">${tabLabel(tab)}</button>`).join('')}
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
  else if (tab === 'advanced') renderAdvancedTab(c);
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
          <span class="data-key-status">${status === 'set' ? '✅' : '⏳'}</span>
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
}

// === KEYS ===
function renderKeysTab(c) {
  const present = vaultProviderNames();
  c.innerHTML = `
    <div class="card">
      <div class="card-title">${t('settings.keys.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">
        ${isConnected() ? `<span style="color:var(--accent-green);">${t('settings.keys.unlocked')}</span>` : `<span style="color:var(--accent-red);">${t('settings.keys.locked')}</span>`}
        ${hasVault() ? ' · ' + t('settings.keys.has_vault') : ' · ' + t('settings.keys.no_vault')}
      </p>
      <div id="keys-list"></div>
      <p style="color:var(--text-muted);font-size:11.5px;margin-top:12px;">
        ${t('settings.keys.add_help')}
      </p>
      <details>
        <summary style="cursor:pointer;color:var(--accent-blue);font-size:12px;margin-bottom:8px;">${t('settings.keys.add_modify')}</summary>
        <div class="field"><label class="field-label">${t('settings.keys.current_password')}</label><input id="keys-pwd" class="input" type="password" /></div>
        ${KNOWN_PROVIDERS.map(p => `
          <div class="field">
            <label class="field-label">${p.icon} ${p.displayName}</label>
            <input id="keys-set-${p.name}" class="input" type="password" placeholder="${present.includes(p.name) ? '••• (' + t('common.optional') + ')' : 'sk-...'}" />
            <div class="field-hint">${p.recommendedFor} · <a href="${p.linkKey}" target="_blank">${t('settings.keys.create')}</a></div>
          </div>
        `).join('')}
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
    return `
      <div class="key-row">
        <span style="font-size:18px;">${p?.icon || '🔑'}</span>
        <span style="flex:1;">${p?.displayName || name} <span style="color:var(--text-muted);font-size:11px;">· ${t('settings.keys.encrypted')}</span></span>
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
    const v = await provider.validate();
    b.disabled = false;
    b.textContent = v.ok ? '✓ OK' : '✗ ' + (v.error || '').slice(0, 40);
    setTimeout(() => b.textContent = 'Test', 2500);
  }));

  $('#set-lock').addEventListener('click', () => { clearRuntimeKeys(); location.reload(); });
  $('#set-forget').addEventListener('click', () => {
    if (confirm('Effacer le vault chiffré ? Toutes les clés API devront être ressaisies.')) {
      forgetVault(); clearRuntimeKeys(); location.reload();
    }
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
}

// === ROUTING ===
function renderRoutingTab(c) {
  if (!isConnected()) { c.innerHTML = '<div class="alert alert-warning">Vault verrouillé.</div>'; return; }
  const preview = getOrchestrator().getRoutingPreview();
  const settings = getSettings();
  const overrides = settings.moduleOverrides || {};
  const avail = getOrchestrator().getProviderNames();

  c.innerHTML = `
    <div class="card">
      <div class="card-title">${t('settings.routing.title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">${t('settings.routing.desc')}</p>
      <table class="wiz-routing">
        <thead><tr><th>${t('settings.routing.col_module')}</th><th>${t('settings.routing.col_auto')}</th><th>${t('settings.routing.col_status')}</th><th>${t('settings.routing.col_override')}</th></tr></thead>
        <tbody>
          ${Object.entries(preview).map(([id, sel]) => {
            const ov = overrides[id]?.provider || 'auto';
            return `
              <tr>
                <td><strong>${moduleLabel(id)}</strong><br><span style="font-size:11px;color:var(--text-muted);">${sel.reason || ''}</span></td>
                <td>${sel.error ? '<span style="color:var(--accent-red);">' + sel.error + '</span>' : sel.icon + ' ' + sel.providerDisplay + '<br><code style="font-size:10.5px;">' + sel.model + '</code>'}</td>
                <td>${sel.isOptimal ? `<span style="color:var(--accent-green);">${t('settings.routing.optimal')}</span>` : (sel.error ? '—' : `<span style="color:var(--accent-amber);">${t('settings.routing.fallback')}</span>`)}</td>
                <td>
                  <select class="input route-override" data-mod="${id}" style="font-size:11px;padding:4px 8px;max-width:140px;">
                    <option value="auto" ${ov==='auto'?'selected':''}>🎯 Auto</option>
                    ${avail.map(n => `<option value="${n}" ${ov===n?'selected':''}>${({claude:'🤖 Claude',openai:'🧠 OpenAI',gemini:'✨ Gemini',grok:'🐦 Grok'})[n]}</option>`).join('')}
                  </select>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
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
}

// === COSTS ===
function renderCostsTab(c) {
  const cost = getCost();
  const byP = cost.byProvider || {};
  c.innerHTML = `
    <div class="card">
      <div class="card-title">${t('settings.costs.title')}</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-label">${t('home.cost_total')}</div><div class="stat-value green">${fmtUSD(cost.total || 0)}</div></div>
        <div class="stat"><div class="stat-label">${t('settings.costs.session')}</div><div class="stat-value">${fmtUSD(cost.session?.total || 0)}</div></div>
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
  `;
  $('#cost-reset').addEventListener('click', () => {
    if (confirm('Reset le compteur de coût ?')) { resetTotalCost(); toast('Reset', 'success'); renderTab('costs'); }
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
        ALPHA TERMINAL · v2.1.0 · multi-LLM · 100% client-side · BYOK
      </p>
    </div>
  `;
  $('#set-save').addEventListener('click', () => {
    setSettings({
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
      const n = payload.counts.analyses;
      if (method === 'failed') {
        // Aucune méthode n'a marché — on bascule sur la modale "show JSON" pour copy manuel
        showBackupFallbackModal(json, filename);
        toast(t('settings.adv.backup_failed_show_modal'), 'info');
      } else if (method === 'cancelled') {
        // Utilisateur a fermé la dialog system du picker — pas un succès, pas une erreur
        // (ne rien afficher)
      } else if (method === 'capacitor') {
        toast(t('settings.adv.backup_done_mobile').replace('{n}', n), 'success');
      } else {
        toast(t('settings.adv.backup_done').replace('{n}', n), 'success');
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
      if (r.ok) toast(t('settings.adv.backup_copied').replace('{n}', r.payload.counts.analyses), 'success');
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
      const total = Object.values(counts.added || {}).reduce((s, n) => s + n, 0);
      toast(t('settings.adv.restore_done').replace('{n}', total), 'success');
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
        <p style="font-size:12px;color:var(--text-secondary);margin:0;">Colle ici le contenu d'un backup ALPHA TERMINAL (JSON). Utile si tu as récupéré le backup via copy-paste plutôt que via un fichier <code>.atb</code>.</p>
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
        toast('Pas un backup ALPHA TERMINAL (champ "app" manquant)', 'error');
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
        const total = Object.values(counts.added || {}).reduce((s, n) => s + n, 0);
        toast(t('settings.adv.restore_done').replace('{n}', total), 'success');
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
}

function moduleLabel(id) {
  return t('mod.' + id + '.label') || id;
}
