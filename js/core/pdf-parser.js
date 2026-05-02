// Lecture d'un fichier PDF côté client (texte + base64)
import { fileToB64 } from './utils.js';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 Mo : au-delà, base64 ferait crasher l'onglet

// Renvoie { text, base64, name, size, pages }
export async function parsePdf(file, { withText = true, withBase64 = true, pageLimit = 200, onProgress } = {}) {
  if (!file) throw new Error('Fichier PDF manquant');
  if (file.size > MAX_PDF_SIZE) {
    throw new Error(`PDF trop volumineux (${(file.size/1024/1024).toFixed(1)} Mo). Limite : 50 Mo.`);
  }

  const result = {
    name: file.name,
    size: file.size,
    pages: 0,
    text: '',
    base64: ''
  };

  // Base64 via FileReader (rapide, non-bloquant)
  if (withBase64) {
    if (onProgress) onProgress({ stage: 'encoding' });
    result.base64 = await fileToB64(file);
  }

  if (withText) {
    // Lazy-load PDF.js si pas encore chargé (~1.7MB économisé au boot)
    if (!window.pdfjsLib && window.AlphaLazy && window.AlphaLazy.pdf) {
      await window.AlphaLazy.pdf();
    }
  }
  if (withText && window.pdfjsLib) {
    if (onProgress) onProgress({ stage: 'parsing' });
    const arrayBuffer = await file.arrayBuffer();
    let pdf;
    try {
      pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      // PDF.js jette PasswordException pour les PDFs chiffrés ; reword pour l'UI.
      if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) {
        throw new Error('PDF protégé par mot de passe — non supporté.');
      }
      if (e && /invalid pdf/i.test(e.message || '')) {
        throw new Error('PDF invalide ou corrompu.');
      }
      throw e;
    }
    result.pages = pdf.numPages;
    const max = Math.min(pdf.numPages, pageLimit);
    const chunks = [];
    for (let i = 1; i <= max; i++) {
      if (onProgress) onProgress({ stage: 'parsing', page: i, total: max });
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');
      chunks.push(text);
    }
    result.text = chunks.join('\n\n');
  }

  return result;
}

// Construit un bloc message "document" pour Claude (PDF natif)
export function asDocumentBlock(base64, title) {
  return {
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: base64
    },
    title: title || undefined
  };
}
