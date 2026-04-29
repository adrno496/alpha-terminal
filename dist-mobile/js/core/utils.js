// Utilitaires généraux
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function fmtRelative(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff/86400)}j`;
  return d.toLocaleDateString('fr-FR');
}

export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ----- base64 (chunked, async, non-bloquant) -----
export function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  // Chunk pour éviter le stack overflow sur gros fichiers
  const CHUNK = 32768;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Plus rapide pour gros fichiers : FileReader.readAsDataURL natif
export function fileToB64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const data = fr.result;
      // result = "data:application/pdf;base64,xxxx"
      const i = data.indexOf(',');
      resolve(i >= 0 ? data.slice(i + 1) : data);
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export function b64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ----- tokens & coût -----
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

const PRICING = {
  'claude-opus-4-5':   { in: 15.0, out: 75.0 },
  'claude-sonnet-4-5': { in:  3.0, out: 15.0 },
  'claude-haiku-4-5':  { in:  0.8, out:  4.0 },
};

export function estimateCostUSD({ model, inputTokens, outputTokens }) {
  const key = Object.keys(PRICING).find(k => (model || '').includes(k)) || 'claude-sonnet-4-5';
  const p = PRICING[key];
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

export function fmtUSD(n) {
  if (!n || n < 0.001) return '$' + (n || 0).toFixed(4);
  if (n < 0.01) return '$' + n.toFixed(4);
  if (n < 1) return '$' + n.toFixed(3);
  return '$' + n.toFixed(2);
}

// Parse JSON robuste
export function safeJsonParse(text) {
  try { return JSON.parse(text); } catch (_) {}
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (_) {}
  }
  return null;
}

// Sleep
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Toast simple
export function toast(msg, type = 'info', ms = 2400) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, ms);
}
