// Safe markdown renderer — sanitizes LLM/user output before injection in DOM.
// Combines marked.js (markdown → HTML) + DOMPurify (HTML sanitization).
// All `innerHTML = marked.parse(x)` MUST be replaced by `innerHTML = safeRender(x)`
// to prevent XSS via prompt injection or compromised LLM responses.

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
  'ul', 'ol', 'li',
  'blockquote',
  'code', 'pre', 'kbd', 'samp', 'var',
  'a', 'span', 'div',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'sup', 'sub',
  'img'
];

const ALLOWED_ATTR = [
  'href', 'title', 'alt', 'src', 'class', 'id',
  'colspan', 'rowspan', 'align',
  'target', 'rel'
];

// Forbidden attributes (defensive — Purify already strips these but explicit is clearer)
const FORBID_ATTR = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
  'onsubmit', 'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup',
  'onkeypress', 'oncontextmenu', 'oninput', 'onchange', 'onreset',
  'onabort', 'onbeforeunload', 'onunload', 'style' // inline style can carry url() exploits
];

const FORBID_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'meta', 'link', 'base', 'svg', 'math'
];

function purifyHtml(html) {
  if (!html) return '';
  const DOMPurify = window.DOMPurify;
  if (!DOMPurify) {
    // Fallback : strip <script>, on*= attrs, javascript: URLs si Purify pas chargé
    // (cas rare : CDN bloqué). Imparfait mais mieux que rien.
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR,
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_ATTR: ['target'],
    // Force tous les liens à s'ouvrir en _blank avec rel noopener noreferrer
    SANITIZE_DOM: true
  });
}

// Marked → DOMPurify pipeline. Use this for ALL markdown rendering.
export function safeRender(md) {
  if (md == null) return '';
  if (typeof md !== 'string') md = String(md);
  let rawHtml;
  try {
    rawHtml = window.marked ? window.marked.parse(md) : escapeHtml(md);
  } catch {
    rawHtml = escapeHtml(md);
  }
  const clean = purifyHtml(rawHtml);
  return clean;
}

// Pour les cas où on a déjà du HTML (pas du markdown) à sanitizer
export function safeHtml(html) {
  return purifyHtml(html);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Hook DOMPurify : tous les <a> sortants ouvrent en nouvel onglet sans referrer
if (typeof window !== 'undefined' && window.DOMPurify) {
  window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}
