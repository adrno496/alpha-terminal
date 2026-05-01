// Modals : setup wizard 3 étapes (au lieu du welcome modal v1) + generic modal
import { $ } from '../core/utils.js';
import { hasVault, setApiKeys, unlockVault, forgetVault, vaultProviderNames, isLegacyVault } from '../core/crypto.js';
import { setRuntimeKeys, validateProviderKey, KNOWN_PROVIDERS } from '../core/api.js';
import { MODULE_ROUTING } from '../core/router.js';
import { t } from '../core/i18n.js';

const overlay = $('#lock-modal');
const body = $('#lock-modal-body');

const generic = {
  overlay: $('#generic-modal'),
  title:   $('#generic-modal-title'),
  body:    $('#generic-modal-body'),
  close:   $('#generic-modal-close')
};
generic.close.addEventListener('click', () => generic.overlay.classList.add('hidden'));
generic.overlay.addEventListener('click', (e) => { if (e.target === generic.overlay) generic.overlay.classList.add('hidden'); });

export function showGenericModal(title, htmlContent, { wide = false } = {}) {
  generic.title.textContent = title;
  generic.body.innerHTML = '';
  if (typeof htmlContent === 'string') generic.body.innerHTML = htmlContent;
  else generic.body.appendChild(htmlContent);
  generic.overlay.querySelector('.modal').classList.toggle('modal-wide', wide);
  generic.overlay.classList.remove('hidden');
}
export function closeGenericModal() { generic.overlay.classList.add('hidden'); }

// === Lock flow ===
export function openLockFlow() {
  overlay.classList.remove('hidden');
  if (hasVault()) renderUnlock();
  else renderWizardStep1();
}

// ---------- UNLOCK ----------
function renderUnlock() {
  const isLegacy = isLegacyVault();
  body.innerHTML = `
    <div class="wiz-stepper">
      <div class="wiz-step active">🔓 Déverrouillage</div>
    </div>
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;">
      Vault détecté${isLegacy ? ' (v1 — sera migré automatiquement vers v2 multi-LLM)' : ''}.
      Entre ton mot de passe.
    </p>
    <div class="field">
      <label class="field-label">Mot de passe</label>
      <input id="unlock-pwd" class="input" type="password" autofocus />
    </div>
    <div id="unlock-error" class="alert alert-danger hidden"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;">
      <button id="unlock-forget" class="btn-danger">Reset vault</button>
      <button id="unlock-submit" class="btn-primary">Déverrouiller</button>
    </div>
  `;
  $('#unlock-pwd').focus();
  $('#unlock-submit').addEventListener('click', handleUnlock);
  $('#unlock-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') handleUnlock(); });
  $('#unlock-forget').addEventListener('click', () => {
    if (confirm('Effacer le vault ? Toutes les clés API devront être ressaisies.')) {
      forgetVault(); renderWizardStep1();
    }
  });
}

async function handleUnlock() {
  const pwd = $('#unlock-pwd').value;
  const err = $('#unlock-error');
  err.classList.add('hidden');
  const btn = $('#unlock-submit');
  btn.disabled = true; btn.textContent = 'Déverrouillage...';
  try {
    const keys = await unlockVault(pwd);
    setRuntimeKeys(keys);
    overlay.classList.add('hidden');
    // Si vault v1 migré, suggère d'ajouter d'autres providers
    const wasLegacy = isLegacyVault(); // après migration ce sera false
    const names = vaultProviderNames();
    if (names.length === 1) {
      // Pas un legacy mais user n'a qu'une clé : on lui dit qu'il peut en ajouter
      window.dispatchEvent(new CustomEvent('app:unlocked', { detail: { suggestMoreKeys: true } }));
    } else {
      window.dispatchEvent(new CustomEvent('app:unlocked'));
    }
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Déverrouiller';
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

// ---------- WIZARD ----------
const wizardState = {
  step: 1,
  password: '',
  passwordConfirm: '',
  keys: Object.fromEntries(KNOWN_PROVIDERS.map(p => [p.name, ''])),
  validation: {} // { claude: 'ok'|'bad'|'untested', ... }
};

function stepperHtml(active) {
  const steps = ['1 · Mot de passe', '2 · Clés API', '3 · Routage'];
  return `<div class="wiz-stepper">${steps.map((s, i) => `<div class="wiz-step ${i+1===active?'active':''} ${i+1<active?'done':''}">${s}</div>`).join('')}</div>`;
}

function renderWizardStep1() {
  body.innerHTML = `
    ${stepperHtml(1)}
    <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin-bottom:14px;">${t('wiz.password_intro')}</p>
    <div class="field">
      <label class="field-label">${t('wiz.password')}</label>
      <input id="wiz-pwd" class="input" type="password" placeholder="${t('wiz.password.placeholder')}" autocomplete="new-password" />
    </div>
    <div class="field">
      <label class="field-label">${t('wiz.password.confirm')}</label>
      <input id="wiz-pwd2" class="input" type="password" autocomplete="new-password" />
    </div>
    <div id="wiz-err" class="alert alert-danger hidden"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px;">
      <button id="wiz-browse" class="btn-ghost" style="font-size:12.5px;">👀 ${t('wiz.browse_first')}</button>
      <button id="wiz-next1" class="btn-primary">${t('wiz.next')}</button>
    </div>

    <div style="margin:18px 0 0;padding:14px;border:1px dashed var(--border);border-radius:6px;background:var(--bg-tertiary);">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">🔑 Tu as déjà un backup ?</div>
      <p style="font-size:12px;color:var(--text-secondary);margin:0 0 10px;line-height:1.5;">
        Importe un fichier <code>.atb</code> ou <code>.json</code> (ou colle le JSON) pour restaurer tes clés API, analyses, patrimoine et paramètres d'un autre appareil. Pas besoin de recréer un mot de passe.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <label class="btn-secondary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;">
          📥 Ajouter une clé d'accès (fichier)
          <input id="wiz-import-file" type="file" accept=".atb,.json,application/json,application/octet-stream" hidden />
        </label>
        <button id="wiz-import-paste" class="btn-ghost" style="font-size:12.5px;">📋 Coller un JSON</button>
      </div>
      <div id="wiz-import-status" style="margin-top:8px;font-size:12px;color:var(--text-muted);"></div>
    </div>
  `;
  ['wiz-pwd', 'wiz-pwd2'].forEach(id => {
    $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') next1(); });
  });
  $('#wiz-next1').addEventListener('click', next1);

  // Browse-first : permet à l'utilisateur d'explorer les modules sans configurer le vault.
  // Si plus tard il clique "Run" sur un module → on relance le lock flow.
  $('#wiz-browse').addEventListener('click', () => {
    overlay.classList.add('hidden');
    localStorage.setItem('alpha-terminal:browse-mode', '1');
    window.dispatchEvent(new CustomEvent('app:browse-mode-enabled'));
  });

  // === Import backup pendant l'onboarding ===
  $('#wiz-import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $('#wiz-import-status');
    status.textContent = '⏳ Import en cours…';
    try {
      const { importBackupFromFile } = await import('../core/backup.js');
      const counts = await importBackupFromFile(file, { mode: 'replace' });
      handleWizardImportSuccess(counts);
    } catch (err) {
      status.innerHTML = `<span style="color:var(--accent-red);">❌ ${err.message}</span>`;
    } finally {
      e.target.value = '';
    }
  });

  $('#wiz-import-paste').addEventListener('click', async () => {
    showWizardPasteImport();
  });

  function next1() {
    const p = $('#wiz-pwd').value, p2 = $('#wiz-pwd2').value;
    const err = $('#wiz-err');
    err.classList.add('hidden');
    if (p.length < 6) { err.textContent = 'Mot de passe trop court (min 6).'; err.classList.remove('hidden'); return; }
    if (p !== p2) { err.textContent = 'Les mots de passe ne correspondent pas.'; err.classList.remove('hidden'); return; }
    wizardState.password = p;
    renderWizardStep2();
  }
}

function handleWizardImportSuccess(counts) {
  const status = $('#wiz-import-status');
  const a = counts.added || {};
  const breakdown = [
    a.analyses ? `${a.analyses} analyses` : null,
    a.wealth ? `${a.wealth} holdings` : null,
    a.wealth_snapshots ? `${a.wealth_snapshots} snapshots` : null,
    a.knowledge ? `${a.knowledge} KB` : null,
    a.transcripts ? `${a.transcripts} transcripts` : null,
    counts.localStorageKeys ? `${counts.localStorageKeys} settings` : null
  ].filter(Boolean).join(' · ') || 'aucune donnée';

  const premiumLine = counts.licenseRestored
    ? `<br><span style="color:var(--accent-green);font-size:11px;">💎 Licence Premium restaurée — accès Pro débloqué après déverrouillage du vault.</span>`
    : `<br><span style="color:var(--accent-amber);font-size:11px;">⚠️ Pas de licence Premium dans ce backup. Si tu en avais une, ré-exporte un backup depuis l'appareil source (versions récentes uniquement).</span>`;
  if (status) {
    status.innerHTML = `<span style="color:var(--accent-green);">✓ Importé : ${breakdown}</span>${premiumLine}<br><span style="color:var(--text-muted);font-size:11px;">Rechargement dans 1.5s pour appliquer le vault…</span>`;
  }
  // Reload : permet au vault chiffré importé d'être lu par hasVault() et rebascule sur l'écran unlock
  setTimeout(() => location.reload(), 1500);
}

function showWizardPasteImport() {
  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;';
  w.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>📋 Coller le JSON du backup</strong>
        <button class="btn-ghost" id="wpi-close">×</button>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin:0;">Colle ici le contenu d'un backup Alpha pour restaurer tes données et tes clés API.</p>
      <textarea id="wpi-textarea" placeholder='{"app":"alpha-terminal", ...}' style="flex:1;min-height:260px;font-family:monospace;font-size:11px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:10px;resize:vertical;"></textarea>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;">
        <button class="btn-ghost" id="wpi-paste-clipboard" style="font-size:12px;">📋 Coller depuis le presse-papier</button>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary" id="wpi-cancel">Annuler</button>
          <button class="btn-primary" id="wpi-restore">📥 Restaurer</button>
        </div>
      </div>
      <div id="wpi-status" style="font-size:12px;color:var(--text-muted);"></div>
    </div>
  `;
  document.body.appendChild(w);
  const ta = w.querySelector('#wpi-textarea');
  const close = () => { try { document.body.removeChild(w); } catch {} };
  setTimeout(() => ta.focus(), 50);

  w.querySelector('#wpi-close').addEventListener('click', close);
  w.querySelector('#wpi-cancel').addEventListener('click', close);
  w.addEventListener('click', (e) => { if (e.target === w) close(); });

  w.querySelector('#wpi-paste-clipboard').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) ta.value = text;
    } catch {
      w.querySelector('#wpi-status').textContent = 'Lecture du presse-papier refusée — colle manuellement (⌘V/Ctrl+V).';
    }
  });

  w.querySelector('#wpi-restore').addEventListener('click', async () => {
    const status = w.querySelector('#wpi-status');
    const text = ta.value.trim();
    if (!text) { status.innerHTML = '<span style="color:var(--accent-red);">Colle un JSON avant de restaurer.</span>'; return; }
    let payload;
    try { payload = JSON.parse(text); }
    catch (e) { status.innerHTML = `<span style="color:var(--accent-red);">JSON invalide : ${e.message}</span>`; return; }
    if (!payload || payload.app !== 'alpha-terminal') {
      status.innerHTML = '<span style="color:var(--accent-red);">Pas un backup Alpha (champ "app" manquant).</span>';
      return;
    }
    const btn = w.querySelector('#wpi-restore');
    btn.disabled = true;
    btn.textContent = '⏳ Restauration…';
    try {
      const { importFullBackup } = await import('../core/backup.js');
      const counts = await importFullBackup(payload, { mode: 'replace' });
      close();
      handleWizardImportSuccess(counts);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '📥 Restaurer';
      status.innerHTML = `<span style="color:var(--accent-red);">❌ ${err.message}</span>`;
    }
  });
}

function renderWizardStep2() {
  const isEnLocal = document.documentElement.lang === 'en';
  body.innerHTML = `
    ${stepperHtml(2)}
    <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin-bottom:14px;">
      <strong style="color:var(--accent-green);">Au moins une clé suffit</strong> pour faire tourner les 60+ modules.
      Plus tu en mets, plus l'app sélectionne le meilleur modèle pour chaque tâche.
    </p>

    <!-- A5 : Banner free providers -->
    <div style="background:linear-gradient(135deg,rgba(0,255,136,0.08),rgba(0,255,136,0.02));border:1px solid var(--accent-green);border-radius:6px;padding:12px;margin-bottom:14px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">💡 ${isEnLocal ? 'Want to start free?' : 'Tu veux démarrer gratuitement ?'}</div>
      <p style="font-size:11.5px;color:var(--text-secondary);margin:0 0 8px;line-height:1.5;">
        ${isEnLocal
          ? 'These 3 providers offer a free tier (rate-limited but enough for casual usage, ~50 analyses/month):'
          : 'Ces 3 providers offrent un tier gratuit (rate-limit mais suffisant pour usage casual, ~50 analyses/mois) :'}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://github.com/settings/tokens" target="_blank" rel="noopener" style="text-decoration:none;padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;font-size:11.5px;color:var(--text-primary);">🐙 GitHub Models <span style="color:var(--accent-green);">${isEnLocal ? '(free with PAT)' : '(gratuit avec PAT)'}</span></a>
        <a href="https://cloud.cerebras.ai/?tab=api-keys" target="_blank" rel="noopener" style="text-decoration:none;padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;font-size:11.5px;color:var(--text-primary);">⚡ Cerebras <span style="color:var(--accent-green);">${isEnLocal ? '(free tier)' : '(tier gratuit)'}</span></a>
        <a href="https://console.mistral.ai/api-keys/" target="_blank" rel="noopener" style="text-decoration:none;padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;font-size:11.5px;color:var(--text-primary);">🇫🇷 Mistral <span style="color:var(--accent-green);">${isEnLocal ? '(free experimentation)' : '(expérimentation gratuite)'}</span></a>
      </div>
      <p style="font-size:10.5px;color:var(--text-muted);margin:6px 0 0;">${isEnLocal ? 'You can always add Claude / OpenAI / Gemini later for premium quality.' : 'Tu pourras toujours ajouter Claude / OpenAI / Gemini plus tard pour la qualité premium.'}</p>
    </div>

    <div style="display:flex;justify-content:center;margin-bottom:14px;">
      <button id="wiz-skip-keys" type="button" class="btn-ghost" style="font-size:12px;color:var(--text-secondary);">
        ${isEnLocal ? '👀 Access without API key (explore the app)' : '👀 Accéder sans clé (explorer l\'app)'}
      </button>
    </div>

    <div id="wiz-keys" class="wiz-keys"></div>
    <div id="wiz-err" class="alert alert-danger hidden"></div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;gap:8px;">
      <button id="wiz-back" class="btn-ghost">← Retour</button>
      <div style="display:flex;gap:8px;">
        <button id="wiz-test" class="btn-secondary">${t('wiz.test_action')}</button>
        <button id="wiz-next2" class="btn-primary">${t('wiz.continue')}</button>
      </div>
    </div>
  `;
  $('#wiz-keys').innerHTML = KNOWN_PROVIDERS.map(p => `
    <div class="wiz-key" data-provider="${p.name}">
      <div class="wiz-key-header">
        <span class="wiz-key-icon">${p.icon}</span>
        <span class="wiz-key-name">${p.displayName}</span>
        <span class="wiz-key-status" id="status-${p.name}"></span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="key-${p.name}" class="input" type="password" placeholder="${p.placeholder || 'API key'}" value="${wizardState.keys[p.name] || ''}" style="flex:1;" />
        <button type="button" class="btn-secondary wiz-key-test" data-test-key="${p.name}" title="Tester cette clé" style="font-size:11.5px;padding:6px 10px;white-space:nowrap;">⚡ ${t('common.test')}</button>
      </div>
      <div class="wiz-key-meta">
        <span style="color:var(--text-muted);font-size:11px;">${p.recommendedFor}</span>
        <a href="${p.linkKey}" target="_blank" rel="noopener" style="font-size:11px;">→ Créer une clé</a>
      </div>
    </div>
  `).join('');

  $('#wiz-back').addEventListener('click', renderWizardStep1);
  $('#wiz-test').addEventListener('click', testKeys);
  $('#wiz-next2').addEventListener('click', next2);
  const skipBtn = $('#wiz-skip-keys');
  if (skipBtn) skipBtn.addEventListener('click', skipKeysAndFinish);

  KNOWN_PROVIDERS.forEach(p => {
    $('#key-' + p.name).addEventListener('input', e => { wizardState.keys[p.name] = e.target.value.trim(); });
    // Test individuel par clé : permet de valider rapidement une seule clé sans
    // attendre le test global de toutes les clés.
    const testBtn = body.querySelector(`[data-test-key="${p.name}"]`);
    if (testBtn) testBtn.addEventListener('click', () => testSingleKey(p));
  });

  async function testSingleKey(p) {
    const btn = body.querySelector(`[data-test-key="${p.name}"]`);
    const statusEl = $('#status-' + p.name);
    const k = (wizardState.keys[p.name] || $('#key-' + p.name).value || '').trim();
    if (!k) {
      statusEl.innerHTML = '<span style="color:var(--accent-amber);font-size:11px;">⚠ vide</span>';
      wizardState.validation[p.name] = 'untested';
      return;
    }
    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = '⏳';
    statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;"></span>';
    try {
      const v = await validateProviderKey(p.name, k);
      if (v.ok) {
        statusEl.innerHTML = '<span style="color:var(--accent-green);">✓ OK</span>';
        wizardState.validation[p.name] = 'ok';
      } else {
        const safeErr = String(v.error || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        statusEl.innerHTML = `<span style="color:var(--accent-red);" title="${safeErr}">✗ invalide</span>`;
        wizardState.validation[p.name] = 'bad';
      }
    } catch (e) {
      statusEl.innerHTML = `<span style="color:var(--accent-red);">✗ ${(e.message || 'erreur').slice(0,40)}</span>`;
      wizardState.validation[p.name] = 'bad';
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  async function testKeys() {
    const btn = $('#wiz-test');
    btn.disabled = true; btn.textContent = '⏳ Tests en cours...';
    for (const p of KNOWN_PROVIDERS) {
      const k = wizardState.keys[p.name];
      const statusEl = $('#status-' + p.name);
      if (!k) { statusEl.innerHTML = ''; wizardState.validation[p.name] = 'untested'; continue; }
      statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;"></span>';
      const v = await validateProviderKey(p.name, k);
      if (v.ok) { statusEl.innerHTML = '<span style="color:var(--accent-green);">✓</span>'; wizardState.validation[p.name] = 'ok'; }
      else {
        const safeErr = String(v.error || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        statusEl.innerHTML = `<span style="color:var(--accent-red);" title="${safeErr}">✗</span>`;
        wizardState.validation[p.name] = 'bad';
      }
    }
    btn.disabled = false; btn.textContent = '⚡ Re-tester';
  }

  function next2() {
    const err = $('#wiz-err');
    err.classList.add('hidden');
    const filled = Object.values(wizardState.keys).filter(v => v && v.trim()).length;
    if (filled === 0) { err.textContent = 'Au moins une clé est nécessaire.'; err.classList.remove('hidden'); return; }
    renderWizardStep3();
  }

  // "Accéder sans clé" : créé un vault vide pour débloquer l'UI. Les modules
  // LLM afficheront leur état "missing-key" tant que rien n'est ajouté depuis
  // Settings. Les modules locaux (budget, watchlist, etc.) restent fonctionnels.
  async function skipKeysAndFinish() {
    const err = $('#wiz-err');
    err.classList.add('hidden');
    const btn = $('#wiz-skip-keys');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      await setApiKeys({}, wizardState.password);
      try { setRuntimeKeys({}); } catch {}
      overlay.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('app:unlocked'));
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = (document.documentElement.lang === 'en' ? '👀 Access without API key (explore the app)' : '👀 Accéder sans clé (explorer l\'app)'); }
      err.textContent = e.message;
      err.classList.remove('hidden');
    }
  }
}

function renderWizardStep3() {
  // Mock-orchestrator pour preview routing sans engager rien
  const available = Object.entries(wizardState.keys).filter(([, v]) => v && v.trim()).map(([k]) => k);
  // Simulation simple : pour chaque module on cherche le premier optimal disponible
  const previews = Object.entries(MODULE_ROUTING).map(([id, cfg]) => {
    let chosen = null, isOptimal = false;
    for (const p of cfg.optimalProviders) { if (available.includes(p)) { chosen = p; isOptimal = true; break; } }
    if (!chosen) for (const p of cfg.fallbackProviders) { if (available.includes(p)) { chosen = p; break; } }
    return { id, chosen, isOptimal, reason: cfg.reason };
  });
  const allOptimal = previews.every(p => p.isOptimal);
  const missing = computeMissing(available);

  body.innerHTML = `
    ${stepperHtml(3)}
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;">
      Voici quel modèle sera utilisé pour chaque module avec ta config actuelle :
    </p>
    <table class="wiz-routing">
      <thead><tr><th>Module</th><th>Provider</th><th>Status</th></tr></thead>
      <tbody>${previews.map(p => `
        <tr>
          <td>${labelOf(p.id)}</td>
          <td>${p.chosen ? icon(p.chosen) + ' ' + nameOf(p.chosen) : '—'}</td>
          <td>${p.isOptimal ? '<span style="color:var(--accent-green);">✓ Optimal</span>' : (p.chosen ? '<span style="color:var(--accent-amber);">⚠ Fallback</span>' : '<span style="color:var(--accent-red);">✗ Indisponible</span>')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${!allOptimal && missing.length ? `
      <div class="alert alert-warning" style="margin-top:14px;">
        ⚠️ Pour bénéficier du meilleur modèle pour chaque module, ajoute aussi : <strong>${missing.join(', ')}</strong>.
      </div>
    ` : `<div class="alert alert-success" style="margin-top:14px;">✓ Configuration optimale.</div>`}
    <div id="wiz-err" class="alert alert-danger hidden"></div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;gap:8px;">
      <button id="wiz-back3" class="btn-ghost">← Retour</button>
      <button id="wiz-finish" class="btn-primary">${t('wiz.launch')}</button>
    </div>
  `;
  $('#wiz-back3').addEventListener('click', renderWizardStep2);
  $('#wiz-finish').addEventListener('click', finishWizard);
}

async function finishWizard() {
  const btn = $('#wiz-finish');
  btn.disabled = true; btn.textContent = 'Sauvegarde...';
  const err = $('#wiz-err');
  err.classList.add('hidden');
  try {
    const keys = {};
    for (const [k, v] of Object.entries(wizardState.keys)) {
      if (v && v.trim()) keys[k] = v.trim();
    }
    await setApiKeys(keys, wizardState.password);
    try {
      setRuntimeKeys(keys);
    } catch (orchErr) {
      // Vault sauvé mais l'orchestrateur n'a pas pu démarrer (clé mal formée pour
      // un provider ?). On ne masque pas l'erreur, l'utilisateur peut réessayer
      // après avoir corrigé la clé invalide depuis Settings.
      throw new Error(`Vault sauvé mais init échouée : ${orchErr.message}`);
    }
    overlay.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('app:unlocked'));
  } catch (e) {
    btn.disabled = false; btn.textContent = t('wiz.launch');
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

function computeMissing(available) {
  // Scan les modules : si pour un module aucun optimal n'est dispo, on liste les optimaux manquants
  const missing = new Set();
  for (const cfg of Object.values(MODULE_ROUTING)) {
    if (!cfg.optimalProviders.length) continue;
    if (cfg.optimalProviders.some(p => available.includes(p))) continue;
    cfg.optimalProviders.forEach(p => { if (!available.includes(p)) missing.add(nameOf(p)); });
  }
  return Array.from(missing);
}
function labelOf(id) {
  // Best-effort : titre depuis MODULE_ROUTING ou conversion kebab → Title Case
  return ({
    'decoder-10k':'10-K Decoder','macro-dashboard':'Macro Dashboard','crypto-fundamental':'Crypto Fundamental',
    'earnings-call':'Earnings Call','portfolio-rebalancer':'Portfolio Rebalancer','tax-optimizer-fr':'Tax FR',
    'whitepaper-reader':'Whitepaper','sentiment-tracker':'Sentiment','newsletter-investor':'Newsletter',
    'position-sizing':'Position Sizing','quick-analysis':'Quick Analysis','wealth':'Patrimoine',
    'knowledge-base':'Knowledge Base','tax-international':'Tax International','dcf':'DCF',
    'pre-mortem':'Pre-Mortem','stock-screener':'Stock Screener','trade-journal':'Trade Journal',
    'investment-memo':'Investment Memo','fire-calculator':'FIRE','stress-test':'Stress Test',
    'battle-mode':'Battle Mode','watchlist':'Watchlist','portfolio-audit':'Portfolio Audit',
    'youtube-transcript':'YouTube Transcript','fees-analysis':'Fees Analysis','wealth-method':'Wealth Method',
    'insights-engine':'Insights','chatbot':'Chatbot','geopolitical-analysis':'Geopolitics',
    'research-agent':'Research Agent'
  })[id] || id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}
function nameOf(p) {
  return ({
    claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', grok: 'Grok',
    openrouter: 'OpenRouter', perplexity: 'Perplexity',
    mistral: 'Mistral', cerebras: 'Cerebras', github: 'GitHub', nvidia: 'NVIDIA',
    huggingface: 'HuggingFace', cloudflare: 'Cloudflare', together: 'Together', cohere: 'Cohere'
  })[p] || p;
}
function icon(p) {
  return ({
    claude: '🤖', openai: '🧠', gemini: '✨', grok: '🐦',
    openrouter: '🌀', perplexity: '🔎',
    mistral: '🇫🇷', cerebras: '⚡', github: '🐙', nvidia: '🟢',
    huggingface: '🤗', cloudflare: '☁️', together: '🟣', cohere: '🟦'
  })[p] || '';
}
