// Module 9 — Newsletter Investor (style cloning)
import { $, safeJsonParse, toast } from '../core/utils.js';
import { analyzeStream } from '../core/api.js';
import { saveStyle, getStyle } from '../core/storage.js';
import { SYSTEM_STYLE_EXTRACT, buildSystemNewsletter } from '../prompts/newsletter-investor.js';
import { moduleHeader, runAnalysis, wireProviderSelector, showApiError } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'newsletter-investor';
let cachedStyle = null;

export async function renderNewsletterInvestorView(viewEl) {
  cachedStyle = await getStyle('default');
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.newsletter-investor.label'), t('mod.newsletter-investor.desc'), { moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">${t('mod.newsletter-investor.style_title')}</div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:10px;">${t('mod.newsletter-investor.style_help')}</p>
      <div id="style-status" class="alert ${cachedStyle ? 'alert-success' : 'alert-warning'}" style="margin-bottom:12px;">
        ${cachedStyle ? `✓ Style guide ✓ (${cachedStyle.sourceTexts?.length || 0} texts).` : t('mod.newsletter-investor.no_style')}
      </div>
      <div id="style-texts">
        <textarea class="textarea sample" rows="4" placeholder="Texte 1..."></textarea>
        <textarea class="textarea sample" rows="4" placeholder="Texte 2..." style="margin-top:8px;"></textarea>
        <textarea class="textarea sample" rows="4" placeholder="Texte 3..." style="margin-top:8px;"></textarea>
      </div>
      <button id="add-sample" class="btn-secondary" style="margin-top:8px;">${t('common.add')}</button>
      <button id="train-style" class="btn-primary" style="margin-left:8px;">${t('mod.newsletter-investor.train')}</button>
      <pre id="style-preview" style="display:none;margin-top:12px;background:var(--bg-tertiary);padding:12px;border-radius:4px;font-family:var(--font-mono);font-size:11.5px;max-height:240px;overflow:auto;"></pre>
    </div>
    <div class="card">
      <div class="card-title">${t('mod.newsletter-investor.gen_title')}</div>
      <div class="field"><label class="field-label">Topic</label><input id="nl-subject" class="input" /></div>
      <div class="field"><label class="field-label">${t('mod.newsletter-investor.bullets')}</label><textarea id="nl-bullets" class="textarea" rows="6"></textarea></div>
      <button id="nl-generate" class="btn-primary" ${cachedStyle ? '' : 'disabled'}>${t('mod.newsletter-investor.run')}</button>
    </div>
    <div id="nl-output"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  if (cachedStyle) showStylePreview(cachedStyle);
  $('#add-sample').addEventListener('click', () => {
    const ta = document.createElement('textarea');
    ta.className = 'textarea sample'; ta.rows = 4; ta.placeholder = 'Texte ' + ($('#style-texts').children.length + 1) + '...';
    ta.style.marginTop = '8px';
    $('#style-texts').appendChild(ta);
  });
  $('#train-style').addEventListener('click', trainStyle);
  $('#nl-generate').addEventListener('click', generateNewsletter);
}

function showStylePreview(rec) {
  const pre = $('#style-preview');
  pre.textContent = JSON.stringify(rec.styleGuide, null, 2);
  pre.style.display = 'block';
}

async function trainStyle() {
  const samples = Array.from(document.querySelectorAll('.sample')).map(t => t.value.trim()).filter(Boolean);
  if (samples.length < 2) { alert('Au moins 2 textes requis.'); return; }
  const status = $('#style-status');
  status.className = 'alert alert-info'; status.textContent = 'Extraction du style…';
  try {
    const userMsg = samples.map((s, i) => `--- TEXTE ${i+1} ---\n${s}`).join('\n\n');
    const result = await analyzeStream(MODULE_ID, {
      system: SYSTEM_STYLE_EXTRACT,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 2000,
      temperature: 0.3
    }, {});
    const styleGuide = safeJsonParse(result.text);
    if (!styleGuide) { status.className = 'alert alert-danger'; status.textContent = 'Impossible de parser le JSON.'; return; }
    const record = { id: 'default', name: 'My voice', styleGuide, sourceTexts: samples, updatedAt: new Date().toISOString() };
    await saveStyle(record);
    cachedStyle = record;
    status.className = 'alert alert-success';
    status.textContent = `✓ Style entraîné sur ${samples.length} textes.`;
    showStylePreview(record);
    $('#nl-generate').disabled = false;
  } catch (e) {
    status.className = 'alert alert-danger'; status.textContent = 'Erreur : ' + e.message;
  }
}

async function generateNewsletter() {
  const out = $('#nl-output');
  if (!cachedStyle) { alert('Entraîne le style d\'abord.'); return; }
  const subject = $('#nl-subject').value.trim();
  const bullets = $('#nl-bullets').value.trim();
  if (!subject) { alert('Indique le sujet.'); return; }
  const sys = buildSystemNewsletter(cachedStyle.styleGuide);
  const userMsg = `Sujet : ${subject}\n\nPoints clés :\n${bullets || '(aucun fourni — improvise)'}`;
  try {
    await runAnalysis(MODULE_ID, {
      system: sys,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 6000,
      temperature: 0.85,
      recordInput: { subject, bullets }
    }, out, { onTitle: () => `Newsletter · ${subject}` });
    toast('Newsletter générée', 'success');
  } catch {}
}
