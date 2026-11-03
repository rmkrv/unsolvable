const ENGLISH_VOICE_WAIT_MS = 2500;

function findEnglishVoice(voices) {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
  return english.find((voice) => /^en[-_]us$/i.test(voice.lang)) ?? english[0] ?? null;
}

export function createEnglishSpeechController(synthesis, Utterance, onUnavailable = () => {}, { voiceWaitMs = ENGLISH_VOICE_WAIT_MS, settleMs = 120 } = {}) {
  let generation = 0;
  let timer = null;
  let startTimer = null;
  let onVoicesChanged = null;
  let disposed = false;

  function clearWait() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (startTimer !== null) clearTimeout(startTimer);
    startTimer = null;
    if (onVoicesChanged) synthesis.removeEventListener("voiceschanged", onVoicesChanged);
    onVoicesChanged = null;
  }

  function stop() {
    generation += 1;
    clearWait();
    synthesis.cancel();
  }

  function speak(text) {
    stop();
    if (disposed || !text?.trim()) return;
    if ([...text].some((character) => /\p{L}/u.test(character) && !/\p{Script=Latin}/u.test(character))) return;

    const current = generation;
    const start = () => {
      if (disposed || current !== generation) return false;
      const voice = findEnglishVoice(synthesis.getVoices());
      if (!voice) return false;
      clearWait();
      const utterance = new Utterance(text.slice(0, 280));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 1.03;
      utterance.pitch = 0.98;
      synthesis.speak(utterance);
      return true;
    };

    const prepare = () => {
      startTimer = null;
      if (start() || disposed || current !== generation) return;
      onVoicesChanged = () => { start(); };
      synthesis.addEventListener("voiceschanged", onVoicesChanged);
      timer = setTimeout(() => {
        if (start() || disposed || current !== generation) return;
        clearWait();
        onUnavailable();
      }, voiceWaitMs);
    };
    if (settleMs > 0) startTimer = setTimeout(prepare, settleMs);
    else prepare();
  }

  return { speak, stop, dispose: () => { disposed = true; stop(); } };
}
