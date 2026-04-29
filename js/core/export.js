// Export d'une analyse : markdown, copy clipboard, print PDF
import { safeRender } from './safe-render.js';

export function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback : textarea
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    return true;
  }
}

// Print PDF (via dialogue navigateur) — utile sur desktop pour ajustements fins
export function printAnalysis({ title, module, createdAt, markdown }) {
  const view = document.getElementById('print-view');
  const html = safeRender(markdown || '');
  view.innerHTML = buildPrintHtml({ title, module, createdAt, html });
  view.classList.remove('hidden');
  setTimeout(() => {
    window.print();
    setTimeout(() => view.classList.add('hidden'), 300);
  }, 100);
}

function buildPrintHtml({ title, module, createdAt, html }) {
  return `
    <header style="border-bottom:1px solid #ccc;margin-bottom:18px;padding-bottom:12px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;">
        ALPHA TERMINAL · ${module}
      </div>
      <h1 style="margin:6px 0 4px;font-size:22px;color:#000;">${escapeHtml(title || 'Analyse')}</h1>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#888;">
        ${new Date(createdAt).toLocaleString('fr-FR')}
      </div>
    </header>
    <div class="printed-content">${html}</div>
  `;
}

// === Direct PDF download (one-click, no dialog) ===
// Lazy-load html2pdf.js from CDN. ~250KB, only fetched on first PDF export.

let _html2pdfPromise = null;

function loadHtml2Pdf() {
  if (_html2pdfPromise) return _html2pdfPromise;
  _html2pdfPromise = new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.integrity = 'sha384-Yv5O+t3uE3hunW8uyrbpPW3iw6/5/Y7HitWJBLgqfMoA36NogMmy+8wWZMpn3HWc';
    script.crossOrigin = 'anonymous';
    script.onload = () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error('html2pdf not loaded'));
    script.onerror = () => reject(new Error('Failed to load html2pdf from CDN'));
    document.head.appendChild(script);
  });
  return _html2pdfPromise;
}

export async function downloadAnalysisPdf({ title, module, createdAt, markdown, filename }) {
  const html = safeRender(markdown || '');

  // Build a clean, light-themed PDF view (avoid the dark theme of the app for readability)
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    background:#fff;color:#111;padding:30px 36px;width:760px;font-family:Inter,system-ui,-apple-system,sans-serif;
    line-height:1.55;font-size:13px;
  `;
  wrapper.innerHTML = `
    <div style="border-bottom:1px solid #ddd;margin-bottom:18px;padding-bottom:12px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.08em;">
        ALPHA TERMINAL · ${escapeHtml(module || '')}
      </div>
      <h1 style="margin:6px 0 4px;font-size:22px;color:#111;">${escapeHtml(title || 'Analyse')}</h1>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#888;">
        ${new Date(createdAt).toLocaleString('fr-FR')}
      </div>
    </div>
    <style>
      .pdf-content h1 { font-size:18px; margin:16px 0 8px; color:#111; }
      .pdf-content h2 { font-size:16px; margin:14px 0 6px; color:#111; border-bottom:1px solid #eee; padding-bottom:4px; }
      .pdf-content h3 { font-size:14px; margin:12px 0 4px; color:#222; }
      .pdf-content p  { margin:6px 0; }
      .pdf-content ul, .pdf-content ol { margin:6px 0 6px 22px; }
      .pdf-content table { border-collapse:collapse; margin:10px 0; font-size:11.5px; width:100%; }
      .pdf-content th, .pdf-content td { border:1px solid #ddd; padding:5px 8px; text-align:left; }
      .pdf-content th { background:#f5f5f5; font-weight:600; }
      .pdf-content code { background:#f5f5f5; padding:1px 5px; border-radius:3px; font-size:11px; }
      .pdf-content pre { background:#f5f5f5; padding:10px; border-radius:4px; overflow-x:auto; font-size:11px; }
      .pdf-content blockquote { border-left:3px solid #ccc; margin:8px 0; padding:4px 12px; color:#555; }
      .pdf-content strong { color:#000; font-weight:600; }
    </style>
    <div class="pdf-content">${html}</div>
    <footer style="margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center;">
      Généré par ALPHA TERMINAL · ${new Date().toLocaleDateString('fr-FR')}
    </footer>
  `;
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  document.body.appendChild(wrapper);

  try {
    const html2pdf = await loadHtml2Pdf();
    const safeTitle = (title || 'analyse').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
    const finalName = filename || `${module || 'analyse'}-${safeTitle}-${new Date().toISOString().slice(0,10)}.pdf`;

    await html2pdf().set({
      margin: [12, 10, 14, 10],
      filename: finalName,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(wrapper).save();
  } finally {
    document.body.removeChild(wrapper);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
