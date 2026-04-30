// Estate Document Generator FR — templates testament olographe, mandat protection future, lettre instructions notaire
import { $ } from '../core/utils.js';
import { moduleHeader } from './_shared.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'estate-doc-generator';

function templateTestament(ctx) {
  return `Testament olographe

Je soussigné(e) ${ctx.name || '[Nom Prénom]'},
né(e) le ${ctx.birthDate || '[date de naissance]'} à ${ctx.birthPlace || '[lieu]'},
demeurant ${ctx.address || '[adresse complète]'},

sain(e) de corps et d'esprit, déclare faire mon testament dans les termes suivants.

Article 1 — Révocation
Je révoque expressément tout testament antérieur.

Article 2 — Désignation du ou des légataires
${ctx.heirs || `Je lègue l'ensemble de mes biens à parts égales à mes enfants ${ctx.children || '[noms]'}.`}

Article 3 — Legs particuliers
${ctx.particularGifts || '[Optionnel : lègue à X la somme de Y €, lègue à Z mon bien Y, etc.]'}

Article 4 — Exécuteur testamentaire
${ctx.executor ? `Je désigne ${ctx.executor} comme exécuteur testamentaire.` : '[Optionnel]'}

Article 5 — Volontés funéraires
${ctx.funeralWishes || '[Optionnel : crémation/inhumation, lieu, etc.]'}

Fait à ${ctx.signCity || '[ville]'}, le ${ctx.signDate || '[date]'}

Signature manuscrite : _____________________

⚠️ CE DOCUMENT DOIT ÊTRE INTÉGRALEMENT ÉCRIT À LA MAIN, DATÉ ET SIGNÉ par le testateur (article 970 du Code civil). Aucune impression, aucun ordinateur. À déposer chez un notaire pour inscription au Fichier Central des Dispositions de Dernières Volontés (FCDDV).`;
}

function templateMandatProtection(ctx) {
  return `Mandat de protection future

Je soussigné(e) ${ctx.name || '[Nom Prénom]'},
né(e) le ${ctx.birthDate || '[date]'} à ${ctx.birthPlace || '[lieu]'},
demeurant ${ctx.address || '[adresse]'},

en application des articles 477 et suivants du Code civil, désigne :

Mandataire principal :
${ctx.mandatary || '[Nom, Prénom, adresse, lien de parenté]'}

Mandataire suppléant (en cas d'empêchement) :
${ctx.subMandatary || '[Optionnel]'}

Étendue du mandat :
☐ Protection de ma personne (santé, logement, déplacements)
☐ Gestion de mes biens (comptes, immobilier, contrats)
☐ Les deux (recommandé)

Pouvoirs spécifiques accordés :
${ctx.specificPowers || '[Détailler : vente immobilière, gestion AV, ouverture de comptes, accès dossier médical, etc.]'}

Effet : ce mandat prendra effet lorsqu'il sera établi médicalement que je ne peux plus pourvoir seul(e) à mes intérêts (certificat médical d'un médecin inscrit sur la liste du procureur).

Fait à ${ctx.signCity || '[ville]'}, le ${ctx.signDate || '[date]'}

Signature : _____________________
Signature du mandataire (acceptation) : _____________________

⚠️ Forme : sous seing privé contresigné par avocat OU notarié (recommandé pour vente immobilière).`;
}

function templateLettreNotaire(ctx) {
  return `Lettre d'instructions au notaire

Maître,

Pour faciliter le règlement de ma succession, je consigne ci-dessous l'ensemble des informations utiles.

1. ÉTAT CIVIL
   Nom complet : ${ctx.name || '[…]'}
   Né(e) le : ${ctx.birthDate || '[…]'} à ${ctx.birthPlace || '[…]'}
   Domicile : ${ctx.address || '[…]'}
   Situation : ${ctx.maritalStatus || '[célibataire / marié(e) sous régime … / PACS / divorcé(e)]'}

2. HÉRITIERS PRÉSOMPTIFS
   ${ctx.heirsList || '[Conjoint, enfants, autres — nom, lien, adresse]'}

3. ACTIFS
   • Immobilier : ${ctx.realEstate || '[adresses, références cadastrales, copropriétés]'}
   • Comptes bancaires : ${ctx.bankAccounts || '[banques, IBAN, type de compte]'}
   • Assurances-vie : ${ctx.lifeInsurance || '[assureur, n° contrat, bénéficiaires]'}
   • Portefeuille titres : ${ctx.securities || '[broker, n° compte]'}
   • Autres : ${ctx.otherAssets || '[bijoux, objets d\'art, parts SCI/SCPI, crypto-actifs et clés associées, etc.]'}

4. DETTES
   ${ctx.debts || '[Crédits immobiliers, prêts personnels, dettes fiscales]'}

5. DOCUMENTS À RÉCUPÉRER
   ${ctx.documentsLocation || '[Coffre-fort à la banque X, classeur "Successoral" dans bureau, cloud privé : URL + accès]'}

6. CONTACTS UTILES
   • Notaire habituel : ${ctx.notary || '[…]'}
   • Conseiller patrimonial : ${ctx.advisor || '[…]'}
   • Comptable : ${ctx.accountant || '[…]'}
   • Médecin traitant : ${ctx.doctor || '[…]'}

7. VOLONTÉS PARTICULIÈRES
   ${ctx.specificWishes || '[Funérailles, dons, legs particuliers, instructions concernant les comptes numériques (Apple/Google legacy contact, etc.)]'}

Fait à ${ctx.signCity || '[ville]'}, le ${ctx.signDate || '[date]'}

Signature : _____________________

⚠️ Document non testamentaire — il complète mais ne remplace pas un testament olographe ou authentique.`;
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderEstateDocGeneratorView(viewEl) {
  const isEN = getLocale() === 'en';

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.estate-doc-generator.label'), t('mod.estate-doc-generator.desc'), { example: '', moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">📝 ${isEN ? 'Generate document' : 'Générer un document'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:13px;">
        <label>${isEN ? 'Document type' : 'Type de document'}
          <select id="ed-type">
            <option value="testament">Testament olographe</option>
            <option value="mandat">Mandat de protection future</option>
            <option value="lettre">Lettre d'instructions au notaire</option>
          </select>
        </label>
        <label>${isEN ? 'Full name' : 'Nom complet'}<input type="text" id="ed-name" /></label>
        <label>${isEN ? 'Birth date' : 'Date de naissance'}<input type="date" id="ed-birth" /></label>
        <label>${isEN ? 'Birth place' : 'Lieu de naissance'}<input type="text" id="ed-birthPlace" /></label>
        <label>${isEN ? 'Address' : 'Adresse'}<input type="text" id="ed-address" /></label>
        <label>${isEN ? 'Children (names)' : 'Enfants (noms)'}<input type="text" id="ed-children" /></label>
        <label>${isEN ? 'Sign city' : 'Ville signature'}<input type="text" id="ed-signCity" /></label>
        <label>${isEN ? 'Sign date' : 'Date signature'}<input type="date" id="ed-signDate" /></label>
      </div>
      <div style="margin-top:10px;">
        <button class="btn-primary" id="ed-generate">${isEN ? 'Generate' : 'Générer'}</button>
        <button class="btn-ghost" id="ed-download">${isEN ? 'Download .txt' : 'Télécharger .txt'}</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📄 ${isEN ? 'Preview' : 'Aperçu'}</div>
      <pre id="ed-preview" style="white-space:pre-wrap;font-size:12px;font-family:var(--font-mono);background:var(--bg-tertiary);padding:14px;border-radius:6px;max-height:600px;overflow:auto;">${isEN ? 'Click Generate to preview the document.' : 'Clique sur Générer pour prévisualiser.'}</pre>
    </div>
    <div class="card" style="border-color:var(--accent-orange);">
      <div class="card-title" style="color:var(--accent-orange);">⚠️ ${isEN ? 'Legal disclaimer' : 'Avertissement juridique'}</div>
      <div style="font-size:13px;">
        ${isEN ?
          'These templates are provided for educational purposes only. They are NOT a substitute for legal advice. The testament olographe must be ENTIRELY HANDWRITTEN, dated and signed by the testator (Article 970 French Civil Code). Always consult a notary or lawyer before signing any estate document.' :
          'Ces modèles sont fournis à titre éducatif uniquement et ne remplacent en aucun cas un conseil juridique. Le testament olographe DOIT ÊTRE INTÉGRALEMENT ÉCRIT À LA MAIN, daté et signé (article 970 Code civil). Consulte toujours un notaire ou un avocat avant de signer.'}
      </div>
    </div>
  `;

  function buildContext() {
    return {
      name: $('#ed-name', viewEl).value,
      birthDate: $('#ed-birth', viewEl).value,
      birthPlace: $('#ed-birthPlace', viewEl).value,
      address: $('#ed-address', viewEl).value,
      children: $('#ed-children', viewEl).value,
      signCity: $('#ed-signCity', viewEl).value,
      signDate: $('#ed-signDate', viewEl).value
    };
  }
  function getCurrentText() {
    const type = $('#ed-type', viewEl).value;
    const ctx = buildContext();
    if (type === 'testament') return templateTestament(ctx);
    if (type === 'mandat') return templateMandatProtection(ctx);
    return templateLettreNotaire(ctx);
  }

  $('#ed-generate', viewEl).addEventListener('click', () => {
    $('#ed-preview', viewEl).textContent = getCurrentText();
  });
  $('#ed-download', viewEl).addEventListener('click', () => {
    const type = $('#ed-type', viewEl).value;
    downloadText(`alpha-${type}-${new Date().toISOString().slice(0, 10)}.txt`, getCurrentText());
  });
}
