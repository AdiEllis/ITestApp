"use client";
import { detectLanguage } from "@/lib/exam-types";

/**
 * Reads text aloud with the device's own voice (no audio file). Used only when the teacher allowed it
 * for questions without approved audio: the voice and its accuracy differ between devices.
 */
export function deviceVoiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  const base = lang.slice(0, 2);
  const matching = voices.filter((v) => v.lang?.replace("_", "-").toLowerCase().startsWith(base));
  return matching.find((v) => /natural|online|google/i.test(v.name)) ?? matching[0];
}

/** Whether this device has a voice for the text's language (voices load asynchronously in some browsers). */
export async function hasDeviceVoice(text: string): Promise<boolean> {
  if (!deviceVoiceSupported()) return false;
  const lang = detectLanguage(text);
  if (pickVoice(lang)) return true;
  await new Promise((r) => {
    speechSynthesis.addEventListener("voiceschanged", r, { once: true });
    setTimeout(r, 1500);
  });
  return !!pickVoice(lang);
}

export function speakWithDevice(text: string, onEnd?: () => void) {
  if (!deviceVoiceSupported()) return onEnd?.();
  speechSynthesis.cancel();
  const lang = detectLanguage(text);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.92;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}

export function stopDeviceVoice() {
  if (deviceVoiceSupported()) speechSynthesis.cancel();
}
