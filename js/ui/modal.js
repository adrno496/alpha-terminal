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
    <div style="display:flex;justify-content:flex-end;margin-top:14px;">
      <button id="wiz-next1" class="btn-primary">${t('wiz.next')}</button>
    </div>
  `;
  ['wiz-pwd', 'wiz-pwd2'].forEach(id => {
    $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') next1(); });
  });
  $('#wiz-next1').addEventListener('click', next1);

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

function renderWizardStep2() {
  body.innerHTML = `
    ${stepperHtml(2)}
    <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin-bottom:14px;">
      <strong style="color:var(--accent-green);">Au moins une clé suffit</strong> pour faire tourner les 10 modules.
      Plus tu en mets, plus l'app sélectionne le meilleur modèle pour chaque tâche.
    </p>
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
      <input id="key-${p.name}" class="input" type="password" placeholder="${p.placeholder || 'API key'}" value="${wizardState.keys[p.name] || ''}" />
      <div class="wiz-key-meta">
        <span style="color:var(--text-muted);font-size:11px;">${p.recommendedFor}</span>
        <a href="${p.linkKey}" target="_blank" rel="noopener" style="font-size:11px;">→ Créer une clé</a>
      </div>
    </div>
  `).join('');

  $('#wiz-back').addEventListener('click', renderWizardStep1);
  $('#wiz-test').addEventListener('click', testKeys);
  $('#wiz-next2').addEventListener('click', next2);

  KNOWN_PROVIDERS.forEach(p => {
    $('#key-' + p.name).addEventListener('input', e => { wizardState.keys[p.name] = e.target.value.trim(); });
  });

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
      else { statusEl.innerHTML = `<span style="color:var(--accent-red);" title="${(v.error||'').replace(/"/g,'&quot;')}">✗</span>`; wizardState.validation[p.name] = 'bad'; }
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
    setRuntimeKeys(keys);
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
  return ({ 'decoder-10k':'10-K Decoder','macro-dashboard':'Macro Dashboard','crypto-fundamental':'Crypto Fundamental','earnings-call':'Earnings Call','portfolio-rebalancer':'Portfolio Rebalancer','tax-optimizer-fr':'Tax FR','whitepaper-reader':'Whitepaper','sentiment-tracker':'Sentiment','newsletter-investor':'Newsletter','position-sizing':'Position Sizing' })[id] || id;
}
function nameOf(p) { return ({ claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', grok: 'Grok' })[p] || p; }
function icon(p) {
  return ({
    claude: '🤖', openai: '🧠', gemini: '✨', grok: '🐦',
    openrouter: '🌀', perplexity: '🔎',
    mistral: '🇫🇷', cerebras: '⚡', github: '🐙', nvidia: '🟢',
    huggingface: '🤗', cloudflare: '☁️', together: '🟣', cohere: '🟦'
  })[p] || '';
}
