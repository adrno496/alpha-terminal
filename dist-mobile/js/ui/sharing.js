// Partage public via URL hash compressée — zéro backend
// On encode { title, module, output, createdAt } en base64 + deflate (CompressionStream natif si dispo)

import { showGenericModal } from './modal.js';
import { copyToClipboard } from '../core/export.js';
import { toast } from '../core/utils.js';
import { getModuleById } from './sidebar.js';

const PREFIX = '#share=';

async function compress(str) {
  if (!('CompressionStream' in window)) {
    // Fallback : juste base64 sans compression
    return btoa(unescape(encodeURIComponent(str)));
  }
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(new TextEncoder().encode(str));
  w.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.dz';
}

async function decompress(s) {
  let isDeflate = false;
  if (s.endsWith('.dz')) { isDeflate = true; s = s.slice(0, -3); }
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  if (!isDeflate) return decodeURIComponent(escape(bin));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes);
  w.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}

export async function buildShareLink(record) {
  const payload = {
    t: record.title,
    m: record.module,
    o: record.output,
    c: record.createdAt,
    u: record.usage ? { i: record.usage.input, o: record.usage.output, c: record.usage.costUSD, mo: record.usage.model, p: record.usage.provider } : null,
    v: 1
  };
  const json = JSON.stringify(payload);
  const compressed = await compress(json);
  const url = location.origin + location.pathname + PREFIX + compressed;
  return url;
}

export async function tryLoadSharedFromHash() {
  if (!location.hash.startsWith(PREFIX)) return null;
  try {
    const enc = location.hash.slice(PREFIX.length);
    const json = await decompress(enc);
    const p = JSON.parse(json);
    return {
      id: 'shared-' + Date.now(),
      title: p.t,
      module: p.m,
      output: p.o,
      createdAt: p.c,
      usage: p.u ? { input: p.u.i, output: p.u.o, costUSD: p.u.c, model: p.u.mo, provider: p.u.p } : null,
      _shared: true
    };
  } catch (e) {
    console.error('Bad share hash:', e);
    return null;
  }
}

export async function showShareModal(record) {
  const url = await buildShareLink(record);
  const m = getModuleById(record.module);
  const html = `
    <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin-bottom:12px;">
      Lien partageable de cette analyse. <strong style="color:var(--accent-green);">100% client-side</strong> :
      le contenu est encodé directement dans l'URL (compressé), aucun serveur n'est impliqué.
    </p>
    <div class="share-meta">
      ${m?.label || record.module} · ${record.usage?.model || ''}
    </div>
    <div class="share-url-wrap">
      <input id="share-url" class="input" readonly value="${url}" />
      <button id="share-copy" class="btn-primary">Copier</button>
    </div>
    <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">
      Lien long (~${Math.round(url.length / 1024 * 10) / 10} Ko). Compatible avec Bitly / TinyURL si tu veux raccourcir.
    </p>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Mon analyse via ALPHA TERMINAL :')}&url=${encodeURIComponent(url)}" target="_blank" class="btn-secondary">𝕏 Tweet</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" class="btn-secondary">LinkedIn</a>
      <a href="mailto:?subject=${encodeURIComponent('Analyse ALPHA TERMINAL')}&body=${encodeURIComponent(url)}" class="btn-secondary">Email</a>
    </div>
  `;
  showGenericModal('🔗 Partager cette analyse', html);
  document.getElementById('share-url').focus();
  document.getElementById('share-url').select();
  document.getElementById('share-copy').addEventListener('click', async () => {
    await copyToClipboard(url);
    toast('Lien copié', 'success');
  });
}
