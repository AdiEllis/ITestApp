/** Reads English text aloud with the device's built-in voice (offline, free, no AI service). */
export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "en-US" && /natural|google|samantha|aria|jenny/i.test(v.name)) ?? voices.find((v) => v.lang?.startsWith("en"));
}

export function speak(text: string, onEnd?: () => void) {
  if (!ttsSupported()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.92;
  const v = englishVoice();
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}
export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}
