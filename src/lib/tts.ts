/**
 * Server-side read-aloud (text-to-speech). The audio is generated once, when the teacher writes the
 * question, and stored like any other question audio. The teacher listens and approves it, and every
 * student then hears exactly the same file, whatever device they use.
 *
 * Providers (set one in the environment):
 *  - Microsoft Azure Speech: AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (free tier: 500,000 characters a month).
 *  - Google Cloud Text-to-Speech: GOOGLE_TTS_API_KEY.
 *  - "fake" (TTS_PROVIDER=fake): a short tone, for automated tests only.
 */

import { detectLanguage } from "./exam-types";

export type TtsProvider = "azure" | "google" | "fake";

export interface TtsResult {
  audio: Buffer;
  mimeType: string;
}

export const TTS_MAX_CHARS = 3000;

export function ttsProvider(): TtsProvider | null {
  const forced = process.env.TTS_PROVIDER;
  if (forced === "fake" || forced === "azure" || forced === "google") return forced;
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) return "azure";
  if (process.env.GOOGLE_TTS_API_KEY) return "google";
  return null;
}

const AZURE_VOICES = { "he-IL": "he-IL-HilaNeural", "ar-SA": "ar-SA-ZariyahNeural", "en-US": "en-US-JennyNeural" };
const GOOGLE_VOICES = { "he-IL": "he-IL-Wavenet-A", "ar-SA": "ar-XA-Wavenet-A", "en-US": "en-US-Wavenet-F" };

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Line breaks become short pauses, so follow-up questions are read one by one. */
function toSsml(text: string, lang: string, voice: string, rate: number) {
  const body = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(escapeXml)
    .join('<break time="700ms"/>');
  const pct = Math.round((rate - 1) * 100);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${pct}%">${body}</prosody></voice></speak>`;
}

async function azure(text: string, lang: keyof typeof AZURE_VOICES, rate: number): Promise<TtsResult> {
  const region = process.env.AZURE_SPEECH_REGION!;
  const voice = (lang === "he-IL" && process.env.AZURE_TTS_VOICE) || AZURE_VOICES[lang];
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "oralprep",
    },
    body: toSsml(text, lang, voice, rate),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { audio: Buffer.from(await res.arrayBuffer()), mimeType: "audio/mpeg" };
}

async function google(text: string, lang: keyof typeof GOOGLE_VOICES, rate: number): Promise<TtsResult> {
  const voice = (lang === "he-IL" && process.env.GOOGLE_TTS_VOICE) || GOOGLE_VOICES[lang];
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(process.env.GOOGLE_TTS_API_KEY!)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml: toSsml(text, lang, voice, 1).replace(/<voice[^>]*>|<\/voice>/g, "") },
      voice: { languageCode: voice.slice(0, 5), name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: rate },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error("Google TTS returned no audio");
  return { audio: Buffer.from(json.audioContent, "base64"), mimeType: "audio/mpeg" };
}

/** A real, playable WAV tone whose length follows the text, so tests exercise the whole flow. */
function fake(text: string): TtsResult {
  const sampleRate = 8000;
  const seconds = Math.min(5, 1 + text.length / 40);
  const n = Math.round(sampleRate * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0, "latin1");
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8, "latin1");
  buf.write("fmt ", 12, "latin1");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "latin1");
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), 44 + i * 2);
  return { audio: buf, mimeType: "audio/wav" };
}

export async function synthesize(text: string, opts: { rate?: number } = {}): Promise<TtsResult> {
  const provider = ttsProvider();
  if (!provider) throw new Error("No TTS provider configured");
  const clean = text.trim().slice(0, TTS_MAX_CHARS);
  const rate = Math.min(1.3, Math.max(0.6, opts.rate ?? 0.95));
  const lang = detectLanguage(clean);
  if (provider === "fake") return fake(clean);
  if (provider === "azure") return azure(clean, lang, rate);
  return google(clean, lang, rate);
}
