// Web Speech API : reconnaissance vocale (input) + synthèse vocale (output)
// Browser-native, zéro dépendance, gratuit.

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const supportsVoiceInput = !!SpeechRecognition;
export const supportsVoiceOutput = 'speechSynthesis' in window;

// Lance la reconnaissance vocale et écrit le résultat dans textarea/input
export function bindVoiceInputButton(button, targetEl, { lang = 'fr-FR' } = {}) {
  if (!supportsVoiceInput) {
    button.disabled = true;
    button.title = 'Reconnaissance vocale non supportée par ce navigateur';
    return;
  }
  let rec = null;
  let listening = false;

  button.addEventListener('click', () => {
    if (listening) {
      rec?.stop();
      return;
    }
    rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    let baseValue = targetEl.value || '';
    if (baseValue && !baseValue.endsWith('\n')) baseValue += '\n';

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      targetEl.value = baseValue + final + (interim ? '«' + interim + '»' : '');
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onend = () => {
      listening = false;
      button.classList.remove('recording');
      button.textContent = '🎤';
      button.title = 'Dicter';
      // Nettoyer les "interim" entre chevrons
      targetEl.value = targetEl.value.replace(/«[^»]*»/g, '').trim();
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = (e) => {
      listening = false;
      button.classList.remove('recording');
      button.textContent = '🎤';
      console.error('Speech error:', e.error);
    };
    rec.start();
    listening = true;
    button.classList.add('recording');
    button.textContent = '⏹ Stop';
    button.title = 'Arrêter';
  });
}

// Lit un texte à voix haute
export function speak(text, { lang = 'fr-FR', rate = 1.05, pitch = 1 } = {}) {
  if (!supportsVoiceOutput) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = rate;
  utt.pitch = pitch;
  // Choisir une voix matching la lang si dispo
  const voices = synth.getVoices();
  const match = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
  if (match) utt.voice = match;
  synth.speak(utt);
}

export function stopSpeaking() {
  if (supportsVoiceOutput) window.speechSynthesis.cancel();
}

// Crée un bouton micro flottant pour un textarea
export function makeMicButton(targetEl, opts = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mic-btn';
  btn.textContent = '🎤';
  btn.title = 'Dicter (Web Speech API)';
  bindVoiceInputButton(btn, targetEl, opts);
  return btn;
}

// Crée un bouton "lire à voix haute" pour un texte donné (md/plain)
export function makeSpeakButton(getText) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-ghost';
  btn.textContent = '🔊 Lire';
  let speaking = false;
  btn.addEventListener('click', () => {
    if (speaking) { stopSpeaking(); speaking = false; btn.textContent = '🔊 Lire'; return; }
    const txt = (typeof getText === 'function' ? getText() : getText) || '';
    // Strip markdown grossier
    const clean = txt.replace(/[#*`_>\-\|]/g, '').replace(/\s+/g, ' ');
    speak(clean);
    speaking = true; btn.textContent = '⏹ Stop';
    setTimeout(() => {
      const check = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          speaking = false; btn.textContent = '🔊 Lire';
          clearInterval(check);
        }
      }, 500);
    }, 300);
  });
  return btn;
}
