// Modal d'onboarding pour la sync cloud E2EE.
// Affiche un avertissement clair avant la première activation : passphrase IRRÉCUPÉRABLE.
// Permet de télécharger une "fiche de récupération" (HTML imprimable).

import { markCloudSyncOnboarded } from '../core/cloud-sync.js';

export function showCloudSyncOnboarding({ onAccept, onCancel } = {}) {
  // Crée overlay
  const overlay = document.createElement('div');
  overlay.id = 'cs-onboarding-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:24px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;">
      <h2 style="margin:0 0 14px;font-size:20px;color:var(--accent-green);">🔐 Activer la sync cloud chiffrée</h2>

      <div style="background:rgba(255,180,0,0.08);border-left:3px solid var(--accent-amber);padding:12px 14px;border-radius:4px;margin-bottom:16px;">
        <div style="font-weight:700;color:var(--accent-amber);margin-bottom:6px;">⚠️ TRÈS IMPORTANT — Lis attentivement</div>
        <div style="font-size:13px;line-height:1.6;color:var(--text-primary);">
          Tes données seront <strong>chiffrées sur ton appareil AVANT upload</strong>.<br>
          Personne (ni Alpha ni Supabase) ne peut les lire sans <strong>ta passphrase</strong>.
        </div>
      </div>

      <div style="font-size:13px;line-height:1.7;color:var(--text-secondary);margin-bottom:14px;">
        ✅ Tu peux récupérer tes backups sur n'importe quel autre device en te reconnectant.<br>
        ✅ Aucune donnée d'analyse n'est lisible côté serveur.<br>
        ❌ <strong style="color:var(--accent-red);">Si tu OUBLIES ta passphrase, tes données seront perdues définitivement.</strong>
        Aucun support, aucun reset password, aucune récupération possible. C'est le prix du chiffrement de bout en bout.
      </div>

      <div style="background:var(--bg-tertiary);padding:12px 14px;border-radius:6px;margin-bottom:16px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;">📋 Recommandations</div>
        <ol style="margin:0;padding-left:20px;font-size:12.5px;line-height:1.7;color:var(--text-secondary);">
          <li>Note ta passphrase dans un password manager (Bitwarden, 1Password)</li>
          <li>Imprime la fiche de récupération maintenant :</li>
        </ol>
        <button id="cs-download-recovery" class="btn-secondary" style="margin-top:10px;font-size:12px;">📄 Télécharger fiche de récupération</button>
      </div>

      <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.5;cursor:pointer;margin-bottom:16px;">
        <input type="checkbox" id="cs-confirm-checkbox" style="margin-top:3px;flex-shrink:0;" />
        <span>J'ai compris que ma passphrase est <strong>irrécupérable</strong> et je l'ai notée en sécurité ailleurs.</span>
      </label>

      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="cs-cancel" class="btn-ghost">Annuler</button>
        <button id="cs-continue" class="btn-primary" disabled style="opacity:0.5;">Continuer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const checkbox = overlay.querySelector('#cs-confirm-checkbox');
  const continueBtn = overlay.querySelector('#cs-continue');
  const cancelBtn = overlay.querySelector('#cs-cancel');
  const downloadBtn = overlay.querySelector('#cs-download-recovery');

  checkbox.addEventListener('change', () => {
    continueBtn.disabled = !checkbox.checked;
    continueBtn.style.opacity = checkbox.checked ? '1' : '0.5';
  });

  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    onCancel?.();
  });

  continueBtn.addEventListener('click', () => {
    markCloudSyncOnboarded();
    overlay.remove();
    onAccept?.();
  });

  downloadBtn.addEventListener('click', () => downloadRecoverySheet());

  // ESC pour fermer
  function escHandler(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
      onCancel?.();
    }
  }
  document.addEventListener('keydown', escHandler);
}

function downloadRecoverySheet() {
  const date = new Date().toLocaleDateString('fr-FR');
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Alpha Terminal — Fiche de récupération</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 40px auto; padding: 30px; color: #111; line-height: 1.6; }
  h1 { color: #00aa66; border-bottom: 2px solid #00aa66; padding-bottom: 8px; }
  .alert { background: #fff5e6; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
  .danger { background: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
  .field { background: #f3f4f6; padding: 14px; border-radius: 6px; margin: 12px 0; font-family: 'Courier New', monospace; }
  .field-label { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 6px; display: block; }
  .field-value { font-size: 16px; word-break: break-all; min-height: 24px; border-bottom: 1px dashed #999; padding-bottom: 6px; }
  ul { padding-left: 20px; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>🔐 Fiche de récupération Alpha Terminal</h1>
  <p>Cette fiche te permet de retrouver l'accès à tes données chiffrées sur le cloud.<br>
  <strong>Garde-la en lieu sûr (coffre, classeur, password manager).</strong></p>

  <div class="alert">
    <strong>⚠️ Important :</strong> Sans ces deux informations, tes backups cloud sont <strong>impossibles à récupérer</strong>.
  </div>

  <div class="field">
    <span class="field-label">Email du compte (magic link)</span>
    <div class="field-value">_____________________________________________</div>
  </div>

  <div class="field">
    <span class="field-label">Passphrase du vault</span>
    <div class="field-value">_____________________________________________</div>
    <div style="font-size:11px;color:#666;margin-top:6px;">⚠️ Ne tape pas ta passphrase sur un écran. Note-la à la main, à l'encre indélébile.</div>
  </div>

  <h2>📱 Comment restaurer sur un nouveau device</h2>
  <ol>
    <li>Ouvre <strong>alpha-terminal.app</strong> sur le nouveau device</li>
    <li>Va dans <strong>Settings → ☁️ Sync Cloud</strong></li>
    <li>Clique <strong>"J'ai déjà un compte"</strong></li>
    <li>Entre l'<strong>email</strong> ci-dessus → reçois un magic link → connecte-toi</li>
    <li>La liste des backups distants s'affiche → choisis le plus récent</li>
    <li>Entre la <strong>passphrase</strong> ci-dessus → tes données sont restaurées ✓</li>
  </ol>

  <div class="danger">
    <strong>❌ Si tu perds la passphrase :</strong> aucun support, aucun reset, aucune récupération possible. C'est le prix du chiffrement de bout en bout (E2EE) qui garantit que personne — pas même Alpha — ne peut lire tes données.
  </div>

  <h2>🔒 Pourquoi c'est conçu comme ça</h2>
  <ul>
    <li>Tes données financières sont <strong>chiffrées sur ton appareil AVANT</strong> d'être uploadées</li>
    <li>Le serveur ne reçoit que des octets opaques, illisibles sans la passphrase</li>
    <li>Ni Alpha, ni Supabase, ni un attaquant qui pirate la base ne peut lire ton patrimoine, tes analyses, etc.</li>
    <li>Le coût : la passphrase doit absolument être préservée par toi seul</li>
  </ul>

  <footer>
    Alpha Terminal · Fiche générée le ${date}<br>
    https://alpha-terminal.app · support : savetheworldfr@gmail.com (récupération impossible mais on peut t'aider à comprendre)
  </footer>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alpha-terminal-fiche-recuperation-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
