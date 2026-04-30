// CSV parser minimaliste — gère délimiteurs , ; \t, quotes, escaped quotes, multi-lignes.
// Aucune dep externe. Suffit pour les CSV bancaires FR (Boursorama, BNP, CA, etc.).

export function parseCSV(text, { delimiter = ',', skipRows = 0 } = {}) {
  if (typeof text !== 'string') return [];
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const len = text.length;

  // BOM strip
  if (text.charCodeAt(0) === 0xFEFF) i = 1;

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === delimiter) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  // Trailing field/row
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.slice(skipRows).filter(r => r.some(c => c && c.trim() !== ''));
}

// Convertit en tableau d'objets en utilisant la première ligne comme header.
export function parseCSVAsObjects(text, opts = {}) {
  const rows = parseCSV(text, opts);
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => (h || '').trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? row[idx] : ''; });
    return obj;
  });
}

// Parse un montant FR ("1 234,56") ou EN ("1,234.56") → number.
export function parseAmount(raw, { decimalSep = ',' } = {}) {
  if (raw == null) return NaN;
  const s = String(raw).trim().replace(/\s+/g, '').replace(/[€$£]/g, '');
  if (!s) return NaN;
  let normalized;
  if (decimalSep === ',') {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? NaN : n;
}

// Parse une date depuis un format donné (DD/MM/YYYY, YYYY-MM-DD, etc.) → ISO date 'YYYY-MM-DD'.
export function parseDate(raw, format = 'DD/MM/YYYY') {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m;
  if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY' || format === 'DD.MM.YYYY') {
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return null;
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (format === 'YYYY-MM-DD' || format === 'YYYY/MM/DD') {
    m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!m) return null;
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  if (format === 'MM/DD/YYYY') {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

// Auto-catégorise une description selon une map de keywords.
//   keywordsMap : { catId: { keywords: [...], type: 'fixe'|'variable'|'epargne'|'revenu', icon: '🏠' } }
//   description : string
//   amount     : number (signe utilisé pour départager epargne/revenu)
// Retourne { category, type } ou { category: 'autre', type: 'variable' }
export function autoCategorize(description, amount, keywordsMap) {
  if (!description) return { category: 'autre', type: amount > 0 ? 'revenu' : 'variable' };
  const desc = description.toLowerCase();
  for (const [catId, def] of Object.entries(keywordsMap)) {
    const kws = def.keywords || [];
    if (kws.some(k => desc.includes(k.toLowerCase()))) {
      return { category: catId, type: def.type, icon: def.icon || '·' };
    }
  }
  return { category: 'autre', type: amount > 0 ? 'revenu' : 'variable', icon: '·' };
}
