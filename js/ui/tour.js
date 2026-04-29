// Onboarding tour : overlay + spotlight + tooltip — vanilla JS, zéro dépendance
import { t } from '../core/i18n.js';

const KEY = 'alpha-terminal:tour-completed';

export function isTourCompleted() { return localStorage.getItem(KEY) === '1'; }
export function markTourCompleted() { localStorage.setItem(KEY, '1'); }
export function resetTour() { localStorage.removeItem(KEY); }

const STEPS = [
  { target: null, titleKey: 'tour.welcome.title', bodyKey: 'tour.welcome.body' },
  { target: 'a[href*="console.anthropic.com"], #set-lock, [data-route="settings"]', titleKey: 'tour.keys.title', bodyKey: 'tour.keys.body' },
  { target: '[data-route="quick-analysis"], .qa-big-input, .quick-input-card', titleKey: 'tour.quick.title', bodyKey: 'tour.quick.body' },
  { target: '.demo-link, [data-action="demo"]', titleKey: 'tour.demo.title', bodyKey: 'tour.demo.body' },
  { target: '.sidebar-adv-toggle, [data-action="toggle-adv"]', titleKey: 'tour.advanced.title', bodyKey: 'tour.advanced.body' },
  { target: '.qa-score-ring, .qa-verdict-banner', titleKey: 'tour.score.title', bodyKey: 'tour.score.body' }
];

let host = null;
let cursor = 0;
let onCompleteCb = null;

export function startTour({ onComplete } = {}) {
  cursor = 0;
  onCompleteCb = onComplete;
  if (host) host.remove();
  host = document.createElement('div');
  host.className = 'tour-host';
  host.innerHTML = `
    <div class="tour-overlay">
      <div class="tour-spotlight"></div>
    </div>
    <div class="tour-card">
      <div class="tour-progress"><span id="tour-progress-text"></span></div>
      <h3 id="tour-title"></h3>
      <p id="tour-body"></p>
      <div class="tour-actions">
        <button class="btn-ghost" id="tour-skip">${t('tour.skip')}</button>
        <span class="tour-nav">
          <button class="btn-ghost" id="tour-back">${t('tour.back')}</button>
          <button class="btn-primary" id="tour-next">${t('tour.next')}</button>
        </span>
      </div>
      <button class="tour-close" id="tour-close" aria-label="close">×</button>
    </div>
  `;
  document.body.appendChild(host);
  document.getElementById('tour-skip').addEventListener('click', finish);
  document.getElementById('tour-close').addEventListener('click', finish);
  document.getElementById('tour-back').addEventListener('click', () => goto(cursor - 1));
  document.getElementById('tour-next').addEventListener('click', () => goto(cursor + 1));
  render();
  window.addEventListener('resize', render);
}

function goto(i) {
  if (i >= STEPS.length) { finish(true); return; }
  if (i < 0) i = 0;
  cursor = i;
  render();
}

function render() {
  if (!host) return;
  const step = STEPS[cursor];
  document.getElementById('tour-title').textContent = t(step.titleKey);
  document.getElementById('tour-body').innerHTML = t(step.bodyKey);
  document.getElementById('tour-progress-text').textContent = `${cursor + 1} / ${STEPS.length}`;
  document.getElementById('tour-back').disabled = cursor === 0;
  document.getElementById('tour-next').textContent = cursor === STEPS.length - 1 ? t('tour.finish') : t('tour.next');

  // Position spotlight + card
  const spotlight = host.querySelector('.tour-spotlight');
  const card = host.querySelector('.tour-card');
  let target = null;
  if (step.target) {
    const sels = step.target.split(',').map(s => s.trim());
    for (const sel of sels) {
      target = document.querySelector(sel);
      if (target && target.offsetParent !== null) break;
    }
  }
  if (target) {
    const r = target.getBoundingClientRect();
    spotlight.style.cssText = `top:${r.top - 8}px;left:${r.left - 8}px;width:${r.width + 16}px;height:${r.height + 16}px;opacity:1;`;
    // Position card below or above target
    const cardW = 360, cardH = 160;
    let top = r.bottom + 14;
    let left = r.left + r.width/2 - cardW/2;
    if (top + cardH > window.innerHeight - 20) top = r.top - cardH - 14;
    if (left < 16) left = 16;
    if (left + cardW > window.innerWidth - 16) left = window.innerWidth - cardW - 16;
    card.style.cssText = `top:${top}px;left:${left}px;width:${cardW}px;`;
  } else {
    spotlight.style.opacity = '0';
    spotlight.style.cssText = 'opacity:0;width:0;height:0;';
    card.style.cssText = `top:50%;left:50%;transform:translate(-50%,-50%);width:420px;`;
  }
}

function finish(completed) {
  if (host) host.remove();
  host = null;
  window.removeEventListener('resize', render);
  if (completed) markTourCompleted();
  if (onCompleteCb) onCompleteCb();
}
