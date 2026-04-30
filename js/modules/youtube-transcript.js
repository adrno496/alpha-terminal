// Module — YouTube Transcript + CEO Forensics + Memory
import { $, $$, toast, uuid } from '../core/utils.js';
import { SYSTEM_YOUTUBE_TRANSCRIPT, SYSTEM_YOUTUBE_TRANSCRIPT_EN } from '../prompts/youtube-transcript.js';
import { moduleHeader, runAnalysis, wireProviderSelector, bindDraft } from './_shared.js';
import {
  saveTranscript, listTranscripts, deleteTranscript, getTranscript,
  getActiveTranscriptId, setActiveTranscriptId,
  parseSRT, parseVTT, segmentsToText, extractYouTubeId,
  computeForensicsLocal, extractMemorySnapshot
} from '../core/transcripts.js';
import { t, getLocale } from '../core/i18n.js';

const MODULE_ID = 'youtube-transcript';

export function renderYoutubeTranscriptView(viewEl) {
  viewEl.innerHTML = `
    ${moduleHeader(t('mod.youtube-transcript.label'), t('mod.youtube-transcript.desc'), { moduleId: MODULE_ID })}

    <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;">
      <div>
        <div class="card">
          <div class="card-title">${t('mod.youtube-transcript.input_title')}</div>

          <div class="audit-tabs" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
            <button class="btn-ghost active" data-yt-tab="paste">${t('mod.youtube-transcript.tab_paste')}</button>
            <button class="btn-ghost" data-yt-tab="upload">${t('mod.youtube-transcript.tab_upload')}</button>
            <button class="btn-ghost" data-yt-tab="url">${t('mod.youtube-transcript.tab_url')}</button>
          </div>

          <div data-yt-pane="paste">
            <textarea id="yt-paste" class="input" rows="10" placeholder="${t('mod.youtube-transcript.paste_placeholder')}"></textarea>
          </div>

          <div data-yt-pane="upload" style="display:none;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">${t('mod.youtube-transcript.upload_help')}</p>
            <input id="yt-file" type="file" accept=".srt,.vtt,.txt" class="input" />
            <div id="yt-file-preview" style="margin-top:8px;font-size:12px;color:var(--text-secondary);"></div>
          </div>

          <div data-yt-pane="url" style="display:none;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">${t('mod.youtube-transcript.url_help')}</p>
            <input id="yt-url" class="input" placeholder="https://www.youtube.com/watch?v=..." />
            <button id="yt-fetch" class="btn-ghost" style="margin-top:8px;">${t('mod.youtube-transcript.fetch')}</button>
            <div id="yt-fetch-status" style="margin-top:8px;font-size:12px;"></div>
          </div>

          <div class="field-row" style="margin-top:12px;">
            <div class="field"><label class="field-label">${t('mod.youtube-transcript.title')}</label>
              <input id="yt-title" class="input" placeholder="Apple Q3 2024 Earnings Call" />
            </div>
            <div class="field"><label class="field-label">${t('mod.youtube-transcript.ticker')}</label>
              <input id="yt-ticker" class="input" placeholder="AAPL" />
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label class="field-label">${t('mod.youtube-transcript.kind')}</label>
              <select id="yt-kind" class="input">
                <option value="earnings">${t('mod.youtube-transcript.kind_earnings')}</option>
                <option value="conference">${t('mod.youtube-transcript.kind_conference')}</option>
                <option value="podcast">${t('mod.youtube-transcript.kind_podcast')}</option>
                <option value="interview">${t('mod.youtube-transcript.kind_interview')}</option>
                <option value="other">${t('mod.youtube-transcript.kind_other')}</option>
              </select>
            </div>
            <div class="field"><label class="field-label">${t('mod.youtube-transcript.speaker')}</label>
              <input id="yt-speaker" class="input" placeholder="Tim Cook (CEO)" />
            </div>
            <div class="field"><label class="field-label">${t('mod.youtube-transcript.date')}</label>
              <input id="yt-date" class="input" type="date" />
            </div>
          </div>

          <button id="yt-run" class="btn-primary" style="margin-top:12px;">${t('mod.youtube-transcript.run')}</button>
        </div>
        <div id="yt-output" style="margin-top:18px;"></div>
      </div>

      <aside class="card" style="height:fit-content;">
        <div class="card-title">${t('mod.youtube-transcript.library')}</div>
        <div id="yt-library" style="max-height:600px;overflow-y:auto;font-size:12px;"></div>
      </aside>
    </div>
  `;

  wireProviderSelector(viewEl, MODULE_ID);
  bindDraft(MODULE_ID, 'yt-paste');

  // Tabs
  viewEl.querySelectorAll('[data-yt-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      viewEl.querySelectorAll('[data-yt-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-yt-tab');
      viewEl.querySelectorAll('[data-yt-pane]').forEach(p => {
        p.style.display = p.getAttribute('data-yt-pane') === tab ? '' : 'none';
      });
    });
  });

  // File upload
  $('#yt-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    let segments = [];
    if (f.name.endsWith('.srt')) segments = parseSRT(text);
    else if (f.name.endsWith('.vtt')) segments = parseVTT(text);
    const fullText = segments.length ? segmentsToText(segments) : text;
    $('#yt-file-preview').innerHTML = `
      <strong>${f.name}</strong> · ${segments.length ? segments.length + ' segments' : 'plain text'} · ${fullText.length.toLocaleString()} chars
    `;
    $('#yt-file').dataset.parsed = JSON.stringify({ segments, fullText });
    if (!$('#yt-title').value) $('#yt-title').value = f.name.replace(/\.[^.]+$/, '');
  });

  // URL fetch (best-effort, often blocked by CORS)
  $('#yt-fetch').addEventListener('click', async () => {
    const url = $('#yt-url').value.trim();
    const status = $('#yt-fetch-status');
    const id = extractYouTubeId(url);
    if (!id) {
      status.innerHTML = `<span style="color:var(--accent-red);">${t('mod.youtube-transcript.invalid_url')}</span>`;
      return;
    }
    status.innerHTML = `<span style="color:var(--text-muted);">${t('mod.youtube-transcript.fetching')}</span>`;
    try {
      // Try YouTube's public timedtext (often CORS-blocked but worth trying)
      const tries = [`https://www.youtube.com/api/timedtext?v=${id}&lang=en`, `https://www.youtube.com/api/timedtext?v=${id}&lang=fr`];
      let xml = '';
      for (const u of tries) {
        try {
          const r = await fetch(u);
          if (r.ok) { xml = await r.text(); if (xml.length > 50) break; }
        } catch {}
      }
      if (!xml) {
        status.innerHTML = `<span style="color:var(--accent-amber);">${t('mod.youtube-transcript.cors_blocked')}</span>`;
        return;
      }
      // Parse <text start="..." dur="...">content</text>
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const nodes = [...doc.querySelectorAll('text')];
      if (!nodes.length) {
        status.innerHTML = `<span style="color:var(--accent-amber);">${t('mod.youtube-transcript.no_subs')}</span>`;
        return;
      }
      const segments = nodes.map(n => {
        const start = parseFloat(n.getAttribute('start') || '0');
        const dur = parseFloat(n.getAttribute('dur') || '0');
        return { timeStart: secsToTs(start), timeEnd: secsToTs(start + dur), text: decodeHtml(n.textContent) };
      });
      const fullText = segmentsToText(segments);
      $('#yt-paste').value = fullText;
      // Switch to paste tab so the user sees what was retrieved
      document.querySelector('[data-yt-tab="paste"]').click();
      status.innerHTML = `<span style="color:var(--accent-green);">✓ ${segments.length} segments · ${fullText.length.toLocaleString()} chars</span>`;
    } catch (e) {
      status.innerHTML = `<span style="color:var(--accent-red);">${e.message} · ${t('mod.youtube-transcript.fallback_paste')}</span>`;
    }
  });

  $('#yt-run').addEventListener('click', () => run(viewEl));

  refreshLibrary(viewEl);
}

function secsToTs(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function decodeHtml(s) {
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  return ta.value;
}

async function refreshLibrary(viewEl) {
  const lib = viewEl.querySelector('#yt-library');
  if (!lib) return;
  const items = await listTranscripts();
  const activeId = getActiveTranscriptId();
  if (!items.length) {
    lib.innerHTML = `<div style="color:var(--text-muted);font-size:11px;">${t('mod.youtube-transcript.empty')}</div>`;
    return;
  }
  lib.innerHTML = items.map(i => `
    <div class="yt-lib-item${i.id === activeId ? ' active' : ''}" data-id="${i.id}" style="padding:8px;border-bottom:1px solid var(--border);${i.id === activeId ? 'background:var(--bg-tertiary);' : ''}">
      <div style="font-weight:500;font-size:12px;">${escape(i.title || '(untitled)')}</div>
      <div style="font-size:10.5px;color:var(--text-muted);">
        ${i.ticker || '–'} · ${i.kind || '–'} · ${new Date(i.createdAt).toLocaleDateString()}
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;">
        <button class="btn-ghost" data-act="toggle-active" data-id="${i.id}" style="font-size:10px;padding:2px 6px;">
          ${i.id === activeId ? '✓ ' + t('mod.youtube-transcript.active') : t('mod.youtube-transcript.activate')}
        </button>
        <button class="btn-ghost" data-act="del" data-id="${i.id}" style="font-size:10px;padding:2px 6px;">${t('common.delete')}</button>
      </div>
    </div>
  `).join('');

  lib.querySelectorAll('[data-act="toggle-active"]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-id');
      setActiveTranscriptId(id === getActiveTranscriptId() ? null : id);
      refreshLibrary(viewEl);
      toast(t('mod.youtube-transcript.context_updated'), 'success');
    });
  });
  lib.querySelectorAll('[data-act="del"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm(t('mod.youtube-transcript.delete_confirm'))) return;
      const id = b.getAttribute('data-id');
      if (id === getActiveTranscriptId()) setActiveTranscriptId(null);
      await deleteTranscript(id);
      refreshLibrary(viewEl);
    });
  });
}

function escape(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function run(viewEl) {
  const out = $('#yt-output');
  const tab = document.querySelector('[data-yt-tab].active')?.getAttribute('data-yt-tab') || 'paste';

  let fullText = '';
  let segments = [];

  if (tab === 'upload') {
    const parsed = $('#yt-file').dataset.parsed;
    if (parsed) {
      const obj = JSON.parse(parsed);
      fullText = obj.fullText || '';
      segments = obj.segments || [];
    }
  } else {
    fullText = $('#yt-paste').value.trim();
  }

  if (!fullText || fullText.length < 100) {
    out.innerHTML = `<div class="alert alert-danger">${t('mod.youtube-transcript.text_required')}</div>`;
    return;
  }

  const meta = {
    title: $('#yt-title').value.trim(),
    ticker: $('#yt-ticker').value.trim().toUpperCase(),
    kind: $('#yt-kind').value,
    speaker: $('#yt-speaker').value.trim(),
    publishedAt: $('#yt-date').value,
    sourceUrl: $('#yt-url').value.trim() || null
  };

  // Local CEO Forensics
  const forensicsLocal = computeForensicsLocal(fullText);

  // Truncate full text if huge (~80K tokens budget = ~320K chars to be safe at 4 chars/token)
  const MAX_CHARS = 320000;
  let textForLLM = fullText;
  let truncated = false;
  if (textForLLM.length > MAX_CHARS) {
    textForLLM = textForLLM.slice(0, MAX_CHARS);
    truncated = true;
  }

  const userMsg = `## MÉTADONNÉES

- Titre : ${meta.title || '(non fourni)'}
- Ticker : ${meta.ticker || '–'}
- Type : ${meta.kind}
- Speaker : ${meta.speaker || '–'}
- Date : ${meta.publishedAt || '–'}
${truncated ? '- ⚠️ Transcription tronquée à 320K chars (taille originale : ' + fullText.length.toLocaleString() + ' chars)' : ''}

## STATS LOCALES (CEO FORENSICS)

${forensicsLocal ? `
- Total mots : ${forensicsLocal.totalWords.toLocaleString()}
- Mots de confiance : ${forensicsLocal.confidenceCount}
- Mots de prudence : ${forensicsLocal.cautionCount}
- Ratio confiance : ${forensicsLocal.confidenceRatio}%
- Hedging ("we won't" / "cannot") : ${forensicsLocal.hedgesCount}
- Affirmations ("we will" / "planning") : ${forensicsLocal.positivesCount}
- Top expressions répétées (≥3x) :
${forensicsLocal.topBigrams.map(b => `  - "${b.phrase}" (${b.count}x)`).join('\n') || '  (aucune)'}
` : '(non calculé)'}

## TRANSCRIPTION

${textForLLM}

---

Suis le format imposé. Termine OBLIGATOIREMENT par le bloc \`\`\`json MEMORY_SNAPSHOT.`;

  try {
    const isEn = getLocale() === 'en';
    const result = await runAnalysis(MODULE_ID, {
      system: isEn ? SYSTEM_YOUTUBE_TRANSCRIPT_EN : SYSTEM_YOUTUBE_TRANSCRIPT,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 4000,
      recordInput: { meta, forensicsLocal, length: fullText.length },
      fetchDataContext: false  // pas besoin d'injecter data — on a déjà le transcript
    }, out, { onTitle: () => `${meta.title || 'Transcript'}${meta.ticker ? ' · ' + meta.ticker : ''}` });

    // Extract memory snapshot from response
    const memorySnapshot = extractMemorySnapshot(result.text || '');

    // Save transcript
    const rec = {
      id: uuid(),
      sourceType: tab,
      sourceUrl: meta.sourceUrl,
      title: meta.title || '(untitled)',
      ticker: meta.ticker,
      kind: meta.kind,
      speaker: meta.speaker,
      publishedAt: meta.publishedAt,
      fullTranscript: fullText,
      segments,
      forensicsLocal,
      llmSummary: result.text || '',
      memorySnapshot,
      createdAt: new Date().toISOString()
    };
    await saveTranscript(rec);
    refreshLibrary(viewEl);

    if (memorySnapshot) toast(t('mod.youtube-transcript.toast_saved'), 'success');
    else toast(t('mod.youtube-transcript.toast_saved_no_mem'), 'info');

    // === Extract price alerts from the LLM output ===
    try {
      const { extractAlertsFromTranscript, bulkSaveAlerts } = await import('../core/price-alerts.js');
      const alerts = extractAlertsFromTranscript({
        transcriptId: rec.id,
        videoTitle: rec.title,
        ticker: rec.ticker,
        markdownOutput: rec.llmSummary
      });
      if (alerts.length > 0) {
        const n = await bulkSaveAlerts(alerts);
        toast(`🚨 ${n} ${getLocale() === 'en' ? 'price alert(s) extracted from transcript' : 'alerte(s) prix extraite(s) du transcript'}`, 'success');
        // Renvoie l'événement pour que le voyant rouge se mette à jour
        window.dispatchEvent(new CustomEvent('app:alerts-updated'));
      }
    } catch (e) { console.warn('[youtube] alert extraction failed:', e); }
  } catch {}
}
