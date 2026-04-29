// Lecture d'un fichier PDF côté client (texte + base64)
import { fileToB64 } from './utils.js';

// Renvoie { text, base64, name, size, pages }
export async function parsePdf(file, { withText = true, withBase64 = true, pageLimit = 200, onProgress } = {}) {
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

  if (withText && window.pdfjsLib) {
    if (onProgress) onProgress({ stage: 'parsing' });
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
