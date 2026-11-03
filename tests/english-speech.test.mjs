import test from "node:test";
import assert from "node:assert/strict";
import { createEnglishSpeechController } from "../lib/english-speech.mjs";

function fakeSynthesis(initialVoices) {
  const listeners = new Set();
  return {
    voices: initialVoices,
    spoken: [],
    active: null,
    getVoices() { return this.voices; },
    speak(utterance) { this.spoken.push(utterance); this.active = utterance; },
    cancel() { this.active = null; },
    addEventListener(type, listener) { if (type === "voiceschanged") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "voiceschanged") listeners.delete(listener); },
    voicesChanged() { for (const listener of listeners) listener(); },
  };
}

class FakeUtterance {
  constructor(text) { this.text = text; }
}

test("waits for an English voice and speaks only the newest request", () => {
  const synthesis = fakeSynthesis([{ lang: "ru-RU", name: "Russian" }]);
  const controller = createEnglishSpeechController(synthesis, FakeUtterance, () => {}, { voiceWaitMs: 100, settleMs: 0 });
  controller.speak("First message");
  controller.speak("Second message");
  assert.equal(synthesis.spoken.length, 0);
  synthesis.voices.push({ lang: "en-US", name: "English" });
  synthesis.voicesChanged();
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(synthesis.active.text, "Second message");
  assert.equal(synthesis.active.voice.lang, "en-US");
  controller.stop();
  assert.equal(synthesis.active, null);
  controller.dispose();
});

test("never plays English text through a Russian voice", async () => {
  const synthesis = fakeSynthesis([{ lang: "ru-RU", name: "Russian" }]);
  let unavailable = 0;
  const controller = createEnglishSpeechController(synthesis, FakeUtterance, () => { unavailable += 1; }, { voiceWaitMs: 5, settleMs: 0 });
  controller.speak("Hello");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(synthesis.spoken.length, 0);
  assert.equal(unavailable, 1);
  controller.dispose();
});

test("rapid replies collapse into one utterance", async () => {
  const synthesis = fakeSynthesis([{ lang: "en-US", name: "English" }]);
  const controller = createEnglishSpeechController(synthesis, FakeUtterance, () => {}, { settleMs: 10 });
  controller.speak("Old reply");
  controller.speak("Latest reply");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(synthesis.active.text, "Latest reply");
  controller.dispose();
});
