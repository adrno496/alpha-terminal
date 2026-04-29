// Module 3 — Crypto Fundamental (auto-fetch CoinGecko + multi-LLM)
import { $, toast, fmtUSD } from '../core/utils.js';
import { parsePdf } from '../core/pdf-parser.js';
import { fetchCoinData } from '../core/coingecko.js';
import { SYSTEM_CRYPTO } from '../prompts/crypto-fundamental.js';
import { moduleHeader, runAnalysis, wireProviderSelector } from './_shared.js';
import { t } from '../core/i18n.js';

const MODULE_ID = 'crypto-fundamental';

export function renderCryptoFundamentalView(viewEl) {
  const state = { parsedPdf: null, file: null, cgData: null };

  viewEl.innerHTML = `
    ${moduleHeader(t('mod.crypto-fundamental.label'), t('mod.crypto-fundamental.desc'), { example: t('mod.crypto-fundamental.example'), moduleId: MODULE_ID })}
    <div class="card">
      <div class="card-title">Token <span style="float:right;"><button id="cf-fetch" class="btn-fetch">${t('mod.crypto-fundamental.fetch')}</button></span></div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Symbol</label><input id="cf-symbol" class="input" placeholder="ETH, SOL, LINK..." value="ETH" /></div>
        <div class="field"><label class="field-label">Name</label><input id="cf-name" class="input" /></div>
        <div class="field"><label class="field-label">${t('mod.crypto-fundamental.category')}</label><select id="cf-cat" class="input"><option>L1</option><option>L2</option><option>DeFi</option><option>Infra/Oracle</option><option>Gaming</option><option>RWA</option><option>AI</option><option>DePIN</option><option>Restaking</option><option>Stablecoin</option><option>Memecoin</option><option>Other</option></select></div>
      </div>
      <div id="cf-cg-status" class="alert" style="display:none;"></div>
    </div>
    <div class="card">
      <div class="card-title">${t('mod.crypto-fundamental.metrics')}</div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Prix ($)</label><input id="cf-price" class="input" type="number" step="0.0001" /></div>
        <div class="field"><label class="field-label">Market cap ($)</label><input id="cf-mcap" class="input" type="number" /></div>
        <div class="field"><label class="field-label">FDV ($)</label><input id="cf-fdv" class="input" type="number" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">Supply circ.</label><input id="cf-circ" class="input" type="number" /></div>
        <div class="field"><label class="field-label">Supply max</label><input id="cf-max" class="input" type="number" /></div>
        <div class="field"><label class="field-label">Inflation %/an</label><input id="cf-infl" class="input" type="number" step="0.1" /></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="field-label">TVL ($)</label><input id="cf-tvl" class="input" type="number" /></div>
        <div class="field"><label class="field-label">${t('mod.crypto-fundamental.fees')}</label><input id="cf-fees" class="input" type="number" /></div>
        <div class="field"><label class="field-label">DAU</label><input id="cf-dau" class="input" type="number" /></div>
      </div>
      <div class="field"><label class="field-label">Vesting / unlocks</label><textarea id="cf-vesting" class="textarea" rows="3"></textarea></div>
    </div>
    <div class="card">
      <div class="card-title">${t('mod.crypto-fundamental.whitepaper_optional')}</div>
      <div class="dropzone" id="cf-drop"><div class="dropzone-title">PDF whitepaper</div><div class="dropzone-hint">drag & drop</div><div id="cf-file" class="dropzone-file"></div><input id="cf-input" type="file" accept="application/pdf" hidden /></div>
    </div>
    <button id="cf-run" class="btn-primary">${t('mod.crypto-fundamental.run')}</button>
    <div id="cf-output" style="margin-top:18px;"></div>
  `;
  wireProviderSelector(viewEl, MODULE_ID);
  $('#cf-fetch').addEventListener('click', () => doFetch(state));
  const drop = $('#cf-drop'), input = $('#cf-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) await handle(state, f); });
  input.addEventListener('change', async e => { const f = e.target.files[0]; if (f) await handle(state, f); });
  $('#cf-run').addEventListener('click', () => run(state));
  const ex = viewEl.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => { $('#cf-symbol').value = 'ETH'; doFetch(state); });
}

async function doFetch(state) {
  const sym = $('#cf-symbol').value.trim();
  if (!sym) { toast('Indique un symbole', 'warning'); return; }
  const btn = $('#cf-fetch'), status = $('#cf-cg-status');
  btn.disabled = true; btn.textContent = '⏳ Fetching...';
  status.style.display = 'block'; status.className = 'alert alert-info';
  status.textContent = `Fetching ${sym} sur CoinGecko...`;
  try {
    const cg = await fetchCoinData(sym);
    state.cgData = cg;
    $('#cf-name').value = cg.name || '';
    $('#cf-price').value = cg.price_usd ?? '';
    $('#cf-mcap').value = Math.round(cg.market_cap_usd || 0);
    $('#cf-fdv').value = Math.round(cg.fdv_usd || 0);
    $('#cf-circ').value = Math.round(cg.circulating_supply || 0);
    $('#cf-max').value = Math.round(cg.max_supply || cg.total_supply || 0);
    status.className = 'alert alert-success';
    status.innerHTML = `✓ ${cg.name} (${cg.symbol}) · ${fmtUSD(cg.price_usd)} · 24h ${cg.price_change_24h_pct?.toFixed(2)}% · 7d ${cg.price_change_7d_pct?.toFixed(2)}% · ATH $${cg.ath_usd}`;
    toast(`${cg.symbol} chargé`, 'success');
  } catch (e) {
    status.className = 'alert alert-danger';
    status.textContent = '✗ ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = '⚡ Auto-fetch CoinGecko';
  }
}

async function handle(state, file) {
  if (file.type !== 'application/pdf') return;
  $('#cf-file').textContent = `📄 ${file.name} · parsing...`;
  try {
    state.parsedPdf = await parsePdf(file, { withText: true, withBase64: true });
    state.file = file;
    $('#cf-file').textContent = `✓ ${state.parsedPdf.name}`;
  } catch (e) { $('#cf-file').textContent = '✗ ' + e.message; state.parsedPdf = null; }
}

async function run(state) {
  const out = $('#cf-output');
  const data = {
    symbol: $('#cf-symbol').value.trim(), name: $('#cf-name').value.trim(), cat: $('#cf-cat').value,
    price: $('#cf-price').value, mcap: $('#cf-mcap').value, fdv: $('#cf-fdv').value,
    circ: $('#cf-circ').value, max: $('#cf-max').value, infl: $('#cf-infl').value,
    tvl: $('#cf-tvl').value, fees: $('#cf-fees').value, dau: $('#cf-dau').value,
    vesting: $('#cf-vesting').value.trim()
  };
  if (!data.symbol) { out.innerHTML = '<div class="alert alert-danger">Indique au moins le symbole.</div>'; return; }

  let cgExtras = '';
  if (state.cgData) {
    const cg = state.cgData;
    cgExtras = `\nDonnées CoinGecko temps-réel (${new Date().toLocaleString('fr-FR')}) :
- Prix : $${cg.price_usd} · 24h: ${cg.price_change_24h_pct?.toFixed(2)}% · 7d: ${cg.price_change_7d_pct?.toFixed(2)}% · 30d: ${cg.price_change_30d_pct?.toFixed(2)}%
- ATH : $${cg.ath_usd} (${cg.ath_change_pct?.toFixed(1)}% vs ATH du ${cg.ath_date})
- Volume 24h : $${Math.round(cg.total_volume_usd || 0).toLocaleString()}
- Catégories CG : ${(cg.categories || []).slice(0, 4).join(', ')}`;
  }
  const userMsg = `Token à analyser : **${data.symbol}** (${data.name || '-'}) — catégorie ${data.cat}

Données fournies :
- Prix : $${data.price || '?'} · MC : $${data.mcap || '?'} · FDV : $${data.fdv || '?'}
- Supply circ : ${data.circ || '?'} · max : ${data.max || '?'} · inflation : ${data.infl || '?'}%/an
- TVL : $${data.tvl || '?'} · Fees ann. : $${data.fees || '?'} · DAU : ${data.dau || '?'}

Vesting / unlocks : ${data.vesting || 'aucune info'}
${cgExtras}
${state.parsedPdf ? '\nLe whitepaper est joint.' : ''}

Génère l'analyse complète selon ton format.`;

  const files = state.parsedPdf ? [{ type: 'pdf', base64: state.parsedPdf.base64, name: state.parsedPdf.name, file: state.file, extractedText: state.parsedPdf.text }] : [];
  try {
    await runAnalysis(MODULE_ID, {
      system: SYSTEM_CRYPTO,
      messages: [{ role: 'user', content: userMsg }],
      files,
      maxTokens: 5000,
      recordInput: { ...data, hasPdf: !!state.parsedPdf, hadCg: !!state.cgData }
    }, out, { onTitle: () => `Crypto · ${data.symbol}${data.name ? ' (' + data.name + ')' : ''}` });
    toast('Analyse terminée', 'success');
  } catch {}
}
