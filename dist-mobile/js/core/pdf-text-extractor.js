// Extraction texte d'un PDF côté client (fallback si provider ne supporte pas PDF natif)
// Utilise PDF.js déjà chargé en CDN dans index.html

const MAX_TEXT_LENGTH = 400000; // ~100K tokens grossier

export async function extractTextFromPDF(file, { pageLimit = 300, onProgress } = {}) {
  if (!window.pdfjsLib) throw new Error('PDF.js non chargé');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, pageLimit);
  let fullText = '';
  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress({ page: i, total: totalPages });
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    fullText += `\n\n--- PAGE ${i} ---\n${pageText}`;
    if (fullText.length > MAX_TEXT_LENGTH) break;
  }
  if (fullText.length > MAX_TEXT_LENGTH) {
    fullText = fullText.substring(0, MAX_TEXT_LENGTH) + '\n\n[...PDF tronqué — contenu trop long...]';
  }
  return fullText;
}
