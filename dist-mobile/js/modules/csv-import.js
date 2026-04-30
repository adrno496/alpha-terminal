// F7 — Import CSV bancaire : wizard 4 étapes (banque → upload → mapping → validation)
import { $, toast } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';
import { parseCSV, parseCSVAsObjects, parseAmount, parseDate, autoCategorize } from '../core/csv-parser.js';
import { saveBudgetEntry } from './budget.js';

const MODULE_ID = 'csv-import';
const BANK_KEY = 'alpha-terminal:csv-import:bank-preset';

let _presetsCache = null;
let _keywordsCache = null;

async function loadPresets() {
  if (_presetsCache) return _presetsCache;
  try {
    const r = await fetch('data/csv-bank-presets.json');
    _presetsCache = await r.json();
  } catch {
    _presetsCache = { banks: { generic: { name: 'Format générique', delimiter: ';', decimalSep: ',', skipRows: 0, dateFormat: 'DD/MM/YYYY', columns: { date: 'date', description: 'description', amount: 'amount' }, amountStyle: 'signed' } } };
  }
  return _presetsCache;
}

async function loadKeywords() {
  if (_keywordsCache) return _keywordsCache;
  try {
    const r = await fetch('data/categorization-keywords.json');
    _keywordsCache = await r.json();
  } catch {
    _keywordsCache = { categories: { autre: { icon: '·', type: 'variable', keywords: [] } } };
  }
  return _keywordsCache;
}

// State du wizard
const state = {
  step: 1,
  bankId: null,
  preset: null,
  rawText: '',
  rows: [],
  filename: ''
};

export async function renderCsvImportView(viewEl) {
  const isEN = getLocale() === 'en';
  state.step = 1;
  state.bankId = localStorage.getItem(BANK_KEY) || 'boursorama';
  state.preset = null;
  state.rawText = '';
  state.rows = [];
  state.filename = '';

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.csv-import.label'), t('mod.csv-import.desc'), { moduleId: MODULE_ID })}
    <div id="csv-wizard"></div>
  `;
  await renderStep1(viewEl);
}

async function renderStep1(viewEl) {
  const isEN = getLocale() === 'en';
  const presets = await loadPresets();
  const banks = Object.entries(presets.banks);

  $('#csv-wizard').innerHTML = `
    <div class="card">
      <div class="card-title">📋 ${isEN ? 'Step 1 — Pick your bank' : 'Étape 1 — Choisis ta banque'}</div>
      <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 12px;">
        ${isEN ? 'Select the bank that exported your CSV. The format will be auto-detected.' : 'Sélectionne la banque qui a exporté ton CSV. Le format sera détecté automatiquement.'}
      </p>
      <div class="field">
        <label class="field-label">${isEN ? 'Bank' : 'Banque'}</label>
        <select id="csv-bank" class="input">
          ${banks.map(([id, p]) => `<option value="${id}" ${id === state.bankId ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div id="csv-preset-info" style="font-size:11.5px;color:var(--text-muted);margin-top:8px;padding:8px;background:var(--bg-tertiary);border-radius:4px;font-family:var(--font-mono);"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button id="csv-step1-next" class="btn-primary">${isEN ? 'Next →' : 'Suivant →'}</button>
      </div>
    </div>
  `;

  const sel = $('#csv-bank');
  const updateInfo = () => {
    const id = sel.value;
    const preset = presets.banks[id];
    $('#csv-preset-info').innerHTML = `
      <strong>${preset.name}</strong><br>
      ${isEN ? 'Delimiter' : 'Délimiteur'} : <code>${preset.delimiter === '\t' ? 'TAB' : preset.delimiter}</code> ·
      ${isEN ? 'Decimal' : 'Décimal'} : <code>${preset.decimalSep}</code> ·
      ${isEN ? 'Header' : 'En-tête'} : <code>${preset.exampleHeader || '—'}</code>
    `;
    state.bankId = id;
    state.preset = preset;
    localStorage.setItem(BANK_KEY, id);
  };
  sel.addEventListener('change', updateInfo);
  updateInfo();
  $('#csv-step1-next').addEventListener('click', () => { state.step = 2; renderStep2(viewEl); });
}

function renderStep2(viewEl) {
  const isEN = getLocale() === 'en';
  $('#csv-wizard').innerHTML = `
    <div class="card">
      <div class="card-title">📤 ${isEN ? 'Step 2 — Upload your CSV file' : 'Étape 2 — Upload ton fichier CSV'}</div>
      <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 12px;">
        ${isEN ? 'Drag your CSV file here or click to select.' : 'Glisse ton CSV ici ou clique pour sélectionner.'} (${state.preset?.name})
      </p>
      <label id="csv-drop" style="display:block;border:2px dashed var(--border);border-radius:8px;padding:30px;text-align:center;cursor:pointer;background:var(--bg-tertiary);">
        <div style="font-size:36px;">📥</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">${isEN ? 'Click or drop CSV file' : 'Clique ou dépose ton fichier CSV'}</div>
        <input id="csv-file" type="file" accept=".csv,.txt,text/csv,text/plain" hidden />
      </label>
      <div id="csv-step2-status" style="margin-top:10px;font-size:12px;"></div>
      <div style="display:flex;justify-content:space-between;margin-top:14px;">
        <button id="csv-step2-back" class="btn-ghost">${isEN ? '← Back' : '← Retour'}</button>
        <button id="csv-step2-next" class="btn-primary" disabled>${isEN ? 'Next →' : 'Suivant →'}</button>
      </div>
    </div>
  `;

  const drop = $('#csv-drop');
  const file = $('#csv-file');
  const status = $('#csv-step2-status');
  const next = $('#csv-step2-next');

  drop.addEventListener('click', () => file.click());
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = 'var(--accent-green)'; }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => { drop.style.borderColor = 'var(--border)'; }));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) await loadFile(f);
  });
  file.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) await loadFile(f);
  });

  async function loadFile(f) {
    state.filename = f.name;
    try {
      // Try utf-8 first, fallback iso-8859-1 for legacy banks
      let text = await f.text();
      // Heuristic : if text contains replacement char, decode as iso-8859-1
      if (text.includes('�') && state.preset?.encoding === 'iso-8859-1') {
        const buffer = await f.arrayBuffer();
        text = new TextDecoder('iso-8859-1').decode(buffer);
      }
      state.rawText = text;
      const rows = parseCSV(text, { delimiter: state.preset.delimiter, skipRows: state.preset.skipRows });
      state.rows = rows;
      status.innerHTML = `<span style="color:var(--accent-green);">✓ ${rows.length} ${isEN ? 'rows detected' : 'lignes détectées'} (${state.filename})</span>`;
      next.disabled = false;
    } catch (err) {
      status.innerHTML = `<span style="color:var(--accent-red);">❌ ${err.message}</span>`;
    }
  }

  $('#csv-step2-back').addEventListener('click', () => { state.step = 1; renderStep1(viewEl); });
  next.addEventListener('click', () => { state.step = 3; renderStep3(viewEl); });
}

async function renderStep3(viewEl) {
  const isEN = getLocale() === 'en';
  const keywords = await loadKeywords();
  const preset = state.preset;
  const headerRow = state.rows[0];
  const dataRows = state.rows.slice(1);

  // Auto-detect column indices from preset or fallback to first row matching
  const colIdx = {};
  for (const [field, headerName] of Object.entries(preset.columns)) {
    let idx = headerRow.findIndex(h => (h || '').trim().toLowerCase() === (headerName || '').toLowerCase());
    if (idx === -1) idx = headerRow.findIndex(h => (h || '').trim().toLowerCase().includes((headerName || '').toLowerCase()));
    colIdx[field] = idx;
  }

  // Build preview transactions
  const transactions = [];
  for (const row of dataRows) {
    const dateRaw = colIdx.date >= 0 ? row[colIdx.date] : '';
    const desc = colIdx.description >= 0 ? row[colIdx.description] : '';
    let amount;
    if (preset.amountStyle === 'split') {
      const debit = colIdx.debit >= 0 ? parseAmount(row[colIdx.debit], { decimalSep: preset.decimalSep }) : 0;
      const credit = colIdx.credit >= 0 ? parseAmount(row[colIdx.credit], { decimalSep: preset.decimalSep }) : 0;
      amount = (isNaN(credit) ? 0 : credit) - (isNaN(debit) ? 0 : debit);
    } else {
      amount = colIdx.amount >= 0 ? parseAmount(row[colIdx.amount], { decimalSep: preset.decimalSep }) : NaN;
    }
    if (isNaN(amount) || !desc) continue;
    const isoDate = parseDate(dateRaw, preset.dateFormat);
    if (!isoDate) continue;
    const cat = autoCategorize(desc, amount, keywords.categories);
    transactions.push({ date: isoDate, description: (desc || '').trim(), amount, category: cat.category, type: cat.type, icon: cat.icon || '·' });
  }

  $('#csv-wizard').innerHTML = `
    <div class="card">
      <div class="card-title">🔍 ${isEN ? 'Step 3 — Mapping & Preview' : 'Étape 3 — Mapping & Preview'}</div>
      <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 12px;">
        ${transactions.length} ${isEN ? 'transactions ready to import.' : 'transactions prêtes à importer.'} ${isEN ? 'Review categories below (you can change them).' : 'Vérifie les catégories (modifiables).'}
      </p>
      <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;">
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <thead style="position:sticky;top:0;background:var(--bg-secondary);">
            <tr>
              <th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);">${isEN ? 'Date' : 'Date'}</th>
              <th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);">${isEN ? 'Description' : 'Description'}</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--border);">${isEN ? 'Amount' : 'Montant'}</th>
              <th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);">${isEN ? 'Category' : 'Catégorie'}</th>
            </tr>
          </thead>
          <tbody id="csv-tx-tbody">
            ${transactions.map((tx, i) => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:5px;font-family:var(--font-mono);">${tx.date}</td>
                <td style="padding:5px;">${escape(tx.description.slice(0, 60))}</td>
                <td style="padding:5px;text-align:right;font-family:var(--font-mono);color:${tx.amount < 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${tx.amount.toFixed(2)} €</td>
                <td style="padding:5px;">
                  <select class="csv-tx-cat" data-idx="${i}" style="font-size:11px;padding:2px 4px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:3px;">
                    ${Object.entries(keywords.categories).map(([cid, c]) => `<option value="${cid}" ${cid === tx.category ? 'selected' : ''}>${c.icon} ${cid}</option>`).join('')}
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:14px;">
        <button id="csv-step3-back" class="btn-ghost">${isEN ? '← Back' : '← Retour'}</button>
        <button id="csv-step3-next" class="btn-primary">${isEN ? 'Validate & Import →' : 'Valider & Importer →'}</button>
      </div>
    </div>
  `;

  // Allow user to change category
  document.querySelectorAll('.csv-tx-cat').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const newCat = e.target.value;
      const def = keywords.categories[newCat];
      transactions[idx].category = newCat;
      transactions[idx].type = def.type;
      transactions[idx].icon = def.icon || '·';
    });
  });

  $('#csv-step3-back').addEventListener('click', () => { state.step = 2; renderStep2(viewEl); });
  $('#csv-step3-next').addEventListener('click', async () => {
    state.step = 4;
    await renderStep4(viewEl, transactions);
  });
}

async function renderStep4(viewEl, transactions) {
  const isEN = getLocale() === 'en';
  $('#csv-wizard').innerHTML = `
    <div class="card">
      <div class="card-title">⏳ ${isEN ? 'Step 4 — Importing…' : 'Étape 4 — Import en cours…'}</div>
      <div id="csv-progress" style="font-size:12px;font-family:var(--font-mono);">0 / ${transactions.length}</div>
    </div>
  `;
  let imported = 0, skipped = 0;
  for (const tx of transactions) {
    try {
      const month = tx.date.slice(0, 7); // YYYY-MM
      await saveBudgetEntry({
        month,
        type: tx.type,
        category: tx.category,
        icon: tx.icon,
        amount: Math.abs(tx.amount),
        description: tx.description,
        source: 'csv',
        sourceDate: tx.date
      });
      imported++;
    } catch {
      skipped++;
    }
    if (imported % 10 === 0) {
      $('#csv-progress').textContent = `${imported} / ${transactions.length}`;
    }
  }

  $('#csv-wizard').innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="font-size:48px;">✅</div>
      <h3 style="margin:10px 0;">${isEN ? 'Import complete' : 'Import terminé'}</h3>
      <p style="color:var(--text-secondary);font-size:13px;">
        ${imported} ${isEN ? 'transactions imported' : 'transactions importées'}${skipped ? ` · ${skipped} ${isEN ? 'skipped' : 'ignorées'}` : ''}.
      </p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:14px;">
        ${isEN ? 'You can now go to the Budget module to review.' : 'Tu peux maintenant aller dans le module Budget pour vérifier.'}
      </p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
        <button id="csv-restart" class="btn-secondary">${isEN ? '+ Import another' : '+ Importer un autre'}</button>
        <a href="#budget" class="btn-primary" style="text-decoration:none;display:inline-block;">${isEN ? 'Go to Budget →' : 'Voir le Budget →'}</a>
      </div>
    </div>
  `;
  toast(`${isEN ? 'Imported' : 'Importé'} : ${imported}`, 'success');

  $('#csv-restart').addEventListener('click', () => { state.step = 1; renderStep1(viewEl); });
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
