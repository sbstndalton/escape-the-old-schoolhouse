// A stand-in for the browser's speech (speechSynthesis), for tests. Headless browsers have no usable voices, so the
// game's Read aloud buttons would never appear; this gives them voices and records what is spoken.
//
//   await page.addInitScript(speechMock, { voices: [...], late: 0, ms: 30 });
//
// voices: [{ name, lang, localService, default }]  (default: one online English voice, two local ones)
// late:   milliseconds before the voices appear (0 = at once); then "voiceschanged" fires
// ms:     how long each utterance "speaks" (window.__speakMs can change it later)
// window.__spoken lists what was spoken: { text, voice, lang, rate }. window.__speech has the queue state.
module.exports = function speechMock(opts = {}) {
  const voices = (opts.voices || [
    { name: "Google US English", lang: "en-US", localService: false, default: true },
    { name: "Local English (UK)", lang: "en-GB", localService: true, default: false },
    { name: "Local Deutsch", lang: "de-DE", localService: true, default: false },
  ]).map(v => ({ voiceURI: v.name, ...v }));
  let ready = !opts.late, q = [], cur = null;
  window.__spoken = []; window.__speakMs = opts.ms == null ? 30 : opts.ms;
  const et = new EventTarget();
  const synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: () => (ready ? voices.slice() : []),
    speak(u) { q.push(u); synth.pending = true; pump(); },
    cancel() { const all = [cur, ...q].filter(Boolean); q = []; cur = null; synth.speaking = synth.pending = false;
      all.forEach(u => { try { u.onerror && u.onerror({ error: "interrupted", utterance: u }); } catch (e) {} }); },
    pause() { synth.paused = true; }, resume() { synth.paused = false; },
    addEventListener: (t, f) => et.addEventListener(t, f), removeEventListener: (t, f) => et.removeEventListener(t, f),
  };
  function pump() {
    if (cur || !q.length) return;
    const u = cur = q.shift(); synth.pending = q.length > 0; synth.speaking = true;
    setTimeout(() => {
      if (cur !== u) return;
      window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, lang: u.lang, rate: u.rate });
      u.onstart && u.onstart({ utterance: u });
      setTimeout(() => { if (cur !== u) return; cur = null; synth.speaking = false; u.onend && u.onend({ utterance: u }); pump(); }, window.__speakMs);
    }, 5);
  }
  class Utterance { constructor(text) { this.text = String(text); this.voice = null; this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; } }
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true, writable: true });
  window.__speech = synth;
  if (opts.late) setTimeout(() => { ready = true; et.dispatchEvent(new Event("voiceschanged")); synth.onvoiceschanged && synth.onvoiceschanged(); }, opts.late);
};
