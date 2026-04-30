// C5 — Détection automatique des abonnements récurrents depuis le module Budget.
// Identifie : abonnements doublons (Netflix + Disney+ + Apple TV+), forfaits multiples, etc.
import { $ } from '../core/utils.js';
import { listBudgetEntries } from './budget.js';
import { moduleHeader } from './_shared.js';
import { getLocale } from '../core/i18n.js';

const MODULE_ID = 'subscriptions-detector';

// Group similaires : extrait le mot-clé principal d'une description et regroupe.
function normalizeName(desc) {
  if (!desc) return '';
  return desc.toLowerCase()
    .replace(/[0-9]+/g, '')
    .replace(/[\.\,\-_\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STREAMING_GROUPS = {
  video: ['netflix', 'disney+', 'disney plus', 'amazon prime', 'prime video', 'apple tv', 'canal+', 'canal plus', 'molotov', 'salto', 'paramount', 'hbo'],
  audio: ['spotify', 'apple music', 'deezer', 'amazon music', 'tidal', 'youtube music'],
  cloud: ['icloud', 'google one', 'dropbox', 'onedrive', 'box.com'],
  mobile: ['orange mobile', 'sosh', 'free mobile', 'b&you', 'red by sfr', 'bouygues telecom', 'lebara', 'lyca'],
  internet: ['orange', 'sfr', 'bouygues', 'free internet', 'freebox', 'sosh internet'],
  fitness: ['basic-fit', 'fitness park', 'on air', 'magic form', 'gigafit'],
  insurance: ['macif', 'maaf', 'matmut', 'axa', 'allianz', 'groupama', 'gmf', 'april mutuelle']
};

function detectGroup(name) {
  const n = name.toLowerCase();
  for (const [group, keywords] of Object.entries(STREAMING_GROUPS)) {
    if (keywords.some(k => n.includes(k))) return group;
  }
  return null;
}

const GROUP_LABELS_FR = { video: '📺 Vidéo streaming', audio: '🎵 Musique streaming', cloud: '☁️ Cloud storage', mobile: '📱 Forfaits mobiles', internet: '🌐 Internet box', fitness: '💪 Salles de sport', insurance: '🛡️ Assurances' };
const GROUP_LABELS_EN = { video: '📺 Video streaming', audio: '🎵 Music streaming', cloud: '☁️ Cloud storage', mobile: '📱 Mobile plans', internet: '🌐 Internet plans', fitness: '💪 Gym memberships', insurance: '🛡️ Insurance' };

export async function renderSubscriptionsDetectorView(viewEl) {
  const isEN = getLocale() === 'en';
  viewEl.innerHTML = `
    ${moduleHeader(
      isEN ? '🔍 Subscriptions Detector' : '🔍 Détecteur d\'abonnements',
      isEN ? 'Auto-detect recurring subscriptions across your budget. Spot duplicates (Netflix + Disney+ + Apple TV+) and obsolete charges.' : 'Détection automatique des abonnements récurrents dans ton budget. Repère les doublons (Netflix + Disney+ + Apple TV+) et les frais oubliés.',
      { moduleId: MODULE_ID })}
    <div id="sub-summary" class="card">${isEN ? '⏳ Scanning…' : '⏳ Scan en cours…'}</div>
    <div id="sub-list"></div>
    <div id="sub-orphans" class="card"></div>
  `;

  // Récupère les 6 derniers mois de budget
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const allEntries = [];
  for (const m of months) {
    const entries = await listBudgetEntries({ month: m }).catch(() => []);
    for (const e of entries) {
      if (e.type === 'fixe' || e.type === 'variable') {
        allEntries.push({ ...e, _month: m });
      }
    }
  }

  if (allEntries.length === 0) {
    $('#sub-summary').innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:30px;">${isEN ? 'No budget entries found. Use the CSV Import or Budget module first to populate your data.' : 'Aucune entrée budget trouvée. Utilise d\'abord l\'Import CSV ou le module Budget.'}</p>`;
    return;
  }

  // Agrège par description normalisée
  const byKey = {};
  for (const e of allEntries) {
    const key = normalizeName(e.description || e.category);
    if (!key) continue;
    byKey[key] = byKey[key] || { samples: [], occurrences: 0, totalAmount: 0, months: new Set(), name: (e.description || e.category) };
    byKey[key].samples.push(e);
    byKey[key].occurrences++;
    byKey[key].totalAmount += Math.abs(Number(e.amount) || 0);
    byKey[key].months.add(e._month);
  }

  // Identifie les "vraies" récurrences : ≥3 mois différents sur 6
  const recurring = [];
  for (const [key, data] of Object.entries(byKey)) {
    if (data.months.size >= 3) {
      const monthlyAvg = data.totalAmount / data.months.size;
      recurring.push({ key, ...data, monthlyAvg, group: detectGroup(key) });
    }
  }
  recurring.sort((a, b) => b.monthlyAvg - a.monthlyAvg);

  // Group par catégorie détectée
  const byGroup = {};
  for (const r of recurring) {
    const g = r.group || 'other';
    byGroup[g] = byGroup[g] || [];
    byGroup[g].push(r);
  }

  const totalMonthly = recurring.reduce((s, r) => s + r.monthlyAvg, 0);
  const totalAnnual = totalMonthly * 12;

  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

  $('#sub-summary').innerHTML = `
    <div class="card-title">📊 ${isEN ? 'Recurring spending detected' : 'Dépenses récurrentes détectées'}</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${isEN ? 'Recurring items' : 'Récurrences'}</div><div class="stat-value">${recurring.length}</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Total monthly' : 'Total mensuel'}</div><div class="stat-value">${fmt(totalMonthly)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Annualized' : 'Annualisé'}</div><div class="stat-value red">${fmt(totalAnnual)} €</div></div>
      <div class="stat"><div class="stat-label">${isEN ? 'Months scanned' : 'Mois scannés'}</div><div class="stat-value">${months.length}</div></div>
    </div>
  `;

  // Render par groupe
  const labels = isEN ? GROUP_LABELS_EN : GROUP_LABELS_FR;
  const groupHtml = Object.entries(byGroup).map(([group, items]) => {
    const groupTotal = items.reduce((s, r) => s + r.monthlyAvg, 0);
    const isMulti = items.length > 1;
    const flag = isMulti && ['video', 'audio', 'mobile', 'internet'].includes(group);
    return `
      <div class="card" ${flag ? 'style="border-left:3px solid var(--accent-orange);"' : ''}>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong>${labels[group] || (isEN ? '· Other' : '· Autres')}</strong>
            ${flag ? ` <span style="font-size:10px;padding:2px 6px;background:var(--accent-orange);color:#000;border-radius:8px;">${isEN ? 'POSSIBLE DUPLICATES' : 'DOUBLONS POSSIBLES'}</span>` : ''}
          </div>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600;">${fmt(groupTotal)} €/${isEN ? 'mo' : 'mois'} · ${fmt(groupTotal * 12)} €/${isEN ? 'yr' : 'an'}</span>
        </div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:8px;">
          <thead><tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:5px;">${isEN ? 'Subscription' : 'Abonnement'}</th>
            <th style="text-align:right;padding:5px;">${isEN ? 'Avg/mo' : 'Moy/mois'}</th>
            <th style="text-align:right;padding:5px;">${isEN ? 'Months' : 'Mois actifs'}</th>
            <th style="text-align:right;padding:5px;">${isEN ? '12mo' : '12 mois'}</th>
          </tr></thead>
          <tbody>
            ${items.map(r => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:5px;">${escape(r.name)}</td>
                <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${fmt(r.monthlyAvg)} €</td>
                <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${r.months.size} / ${months.length}</td>
                <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${fmt(r.monthlyAvg * 12)} €</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${flag ? `<p style="font-size:11.5px;color:var(--accent-orange);margin:8px 0 0;">💡 ${isEN ? 'You have multiple subscriptions in this category. Consider consolidating to save €' + fmt((groupTotal * 12) * 0.5) + '/year.' : 'Tu as plusieurs abonnements dans cette catégorie. Consolide pour économiser ~' + fmt((groupTotal * 12) * 0.5) + ' €/an.'}</p>` : ''}
      </div>
    `;
  }).join('');

  $('#sub-list').innerHTML = groupHtml || `<div class="card" style="text-align:center;color:var(--text-muted);padding:20px;">${isEN ? '🎉 No clear recurring subscription detected.' : '🎉 Aucune récurrence claire détectée.'}</div>`;

  // Récurrences orphelines (pas dans un groupe connu) avec montant > 5€/mois
  const orphans = recurring.filter(r => !r.group && r.monthlyAvg > 5);
  if (orphans.length > 0) {
    $('#sub-orphans').innerHTML = `
      <div class="card-title">🔎 ${isEN ? 'Other recurring charges (review needed)' : 'Autres récurrences (à vérifier)'}</div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">
        ${isEN ? 'These charges repeat across months but aren\'t in a known category. Make sure they\'re still useful.' : 'Ces dépenses se répètent chaque mois mais ne sont pas dans une catégorie connue. Vérifie qu\'elles te sont toujours utiles.'}
      </p>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:5px;">${isEN ? 'Description' : 'Description'}</th>
          <th style="text-align:right;padding:5px;">${isEN ? 'Avg/mo' : 'Moy/mois'}</th>
          <th style="text-align:right;padding:5px;">${isEN ? 'Months' : 'Mois actifs'}</th>
          <th style="text-align:right;padding:5px;">12mo</th>
        </tr></thead>
        <tbody>
          ${orphans.slice(0, 20).map(r => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:5px;">${escape(r.name)}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${fmt(r.monthlyAvg)} €</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);">${r.months.size} / ${months.length}</td>
              <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:var(--accent-red);">${fmt(r.monthlyAvg * 12)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    $('#sub-orphans').innerHTML = '';
  }
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
