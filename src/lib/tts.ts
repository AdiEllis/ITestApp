/**
 * Server-side read-aloud (text-to-speech). The audio is generated once, when the teacher writes the
 * question, and stored like any other question audio. The teacher listens and approves it, and every
 * student then hears exactly the same file, whatever device they use.
 *
 * Providers (set one or more in the environment):
 *  - Google Gemini TTS: GEMINI_API_KEY (from aistudio.google.com). A voice built on a language model,
 *    so it reads whole sentences and picks the right pronunciation from context. Preferred.
 *  - Microsoft Azure Speech: AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (free tier: 500,000 characters a month).
 *  - Google Cloud Text-to-Speech: GOOGLE_TTS_API_KEY.
 *  - "fake" (TTS_PROVIDER=fake): a short tone, for automated tests only.
 *
 * Long texts (a reading passage) are split into parts, read part by part, and joined into one MP3.
 */

import { detectLanguage } from "./exam-types";

export type TtsProvider = "gemini" | "azure" | "google" | "fake";

export interface TtsResult {
  audio: Buffer;
  mimeType: string;
  /** The voice that actually read the text: another one when the chosen one is over its free quota. */
  provider: TtsProvider;
}

export const TTS_MAX_CHARS = 15000;

export const TTS_PROVIDER_LABELS: Record<TtsProvider, string> = {
  gemini: "קול חכם (Gemini)",
  azure: "קול רגיל (Microsoft)",
  google: "קול רגיל (Google)",
  fake: "קול בדיקה",
};

/** Why the voice service failed, so the teacher gets a message she can act on. */
export class TtsError extends Error {
  constructor(
    public reason: "key" | "region" | "timeout" | "quota" | "service",
    message: string,
    public provider?: TtsProvider,
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit, name: string, timeoutMs = 20_000): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    if (err.name === "TimeoutError" || err.name === "AbortError") throw new TtsError("timeout", `${name} timed out`);
    // An unknown host means the region name is wrong.
    if (err.cause?.code === "ENOTFOUND" || err instanceof TypeError) throw new TtsError("region", `${name}: ${err.message} ${err.cause?.code ?? ""}`);
    throw new TtsError("service", `${name}: ${err.message}`);
  }
  if (res.ok) return res;
  const body = (await res.text()).slice(0, 300);
  if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(body)) throw new TtsError("key", `${name} ${res.status}: ${body}`);
  if (res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(body)) throw new TtsError("quota", `${name} ${res.status}: ${body}`);
  throw new TtsError("service", `${name} ${res.status}: ${body}`);
}

/** Every configured provider, best first. */
export function ttsProviders(): TtsProvider[] {
  const forced = process.env.TTS_PROVIDER;
  if (forced === "fake") return ["fake"];
  const all: TtsProvider[] = [];
  if (process.env.GEMINI_API_KEY?.trim()) all.push("gemini");
  if (process.env.AZURE_SPEECH_KEY?.trim() && process.env.AZURE_SPEECH_REGION?.trim()) all.push("azure");
  if (process.env.GOOGLE_TTS_API_KEY?.trim()) all.push("google");
  if (forced === "gemini" || forced === "azure" || forced === "google") return [forced, ...all.filter((p) => p !== forced)];
  return all;
}

export function ttsProvider(): TtsProvider | null {
  return ttsProviders()[0] ?? null;
}

type Lang = ReturnType<typeof detectLanguage>;
const AZURE_VOICES: Record<Lang, string> = { "he-IL": "he-IL-HilaNeural", "ar-SA": "ar-SA-ZariyahNeural", "en-US": "en-US-JennyNeural" };
const GOOGLE_VOICES: Record<Lang, string> = { "he-IL": "he-IL-Wavenet-A", "ar-SA": "ar-XA-Wavenet-A", "en-US": "en-US-Wavenet-F" };
const SAMPLE_RATE = 24000;

/** Mono 16-bit PCM at SAMPLE_RATE. */
type Pcm = Int16Array;

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function lines(text: string) {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Line breaks become short pauses, so follow-up questions are read one by one. */
function toSsml(text: string, lang: string, voice: string, rate: number) {
  const body = lines(text).map(escapeXml).join('<break time="700ms"/>');
  const pct = Math.round((rate - 1) * 100);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${pct}%">${body}</prosody></voice></speak>`;
}

/** The samples of a WAV file (or raw PCM when there is no header). */
export function wavToPcm(buf: Buffer): { pcm: Pcm; sampleRate: number } {
  if (buf.length < 12 || buf.toString("latin1", 0, 4) !== "RIFF") {
    const even = buf.subarray(0, buf.length - (buf.length % 2));
    return { pcm: new Int16Array(even.buffer.slice(even.byteOffset, even.byteOffset + even.length)), sampleRate: SAMPLE_RATE };
  }
  let sampleRate = SAMPLE_RATE;
  let channels = 1;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("latin1", pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(pos + 10);
      sampleRate = buf.readUInt32LE(pos + 12);
    } else if (id === "data") {
      // Streams sometimes leave the size at 0 or 0xFFFFFFFF; take the rest of the file.
      if (size === 0 || pos + 8 + size > buf.length) size = buf.length - pos - 8;
      size -= size % 2;
      const all = new Int16Array(buf.buffer.slice(buf.byteOffset + pos + 8, buf.byteOffset + pos + 8 + size));
      if (channels <= 1) return { pcm: all, sampleRate };
      const mono = new Int16Array(Math.floor(all.length / channels));
      for (let i = 0; i < mono.length; i++) mono[i] = all[i * channels];
      return { pcm: mono, sampleRate };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error("WAV without audio data");
}

function resample(pcm: Pcm, from: number): Pcm {
  if (from === SAMPLE_RATE) return pcm;
  const out = new Int16Array(Math.round((pcm.length * SAMPLE_RATE) / from));
  const step = from / SAMPLE_RATE;
  for (let i = 0; i < out.length; i++) out[i] = pcm[Math.min(pcm.length - 1, Math.floor(i * step))];
  return out;
}

async function azure(text: string, lang: Lang, rate: number): Promise<Pcm> {
  // Accept "North Europe" or "northeurope" as typed in the portal.
  const region = process.env.AZURE_SPEECH_REGION!.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z0-9]+$/.test(region)) throw new TtsError("region", `bad region "${region}"`);
  const voice = (lang === "he-IL" && process.env.AZURE_TTS_VOICE?.trim()) || AZURE_VOICES[lang];
  const res = await call(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!.trim(),
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
      "User-Agent": "oralprep",
    },
    body: toSsml(text, lang, voice, rate),
  }, "Azure TTS");
  const { pcm, sampleRate } = wavToPcm(Buffer.from(await res.arrayBuffer()));
  return resample(pcm, sampleRate);
}

async function google(text: string, lang: Lang, rate: number): Promise<Pcm> {
  const voice = (lang === "he-IL" && process.env.GOOGLE_TTS_VOICE?.trim()) || GOOGLE_VOICES[lang];
  const res = await call(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(process.env.GOOGLE_TTS_API_KEY!.trim())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml: toSsml(text, lang, voice, 1).replace(/<voice[^>]*>|<\/voice>/g, "") },
      voice: { languageCode: voice.slice(0, 5), name: voice },
      audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: SAMPLE_RATE, speakingRate: rate },
    }),
  }, "Google TTS");
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new TtsError("service", "Google TTS returned no audio");
  const { pcm, sampleRate } = wavToPcm(Buffer.from(json.audioContent, "base64"));
  return resample(pcm, sampleRate);
}

const GEMINI_STYLE: Record<Lang, string> = {
  "he-IL": "standard Israeli Hebrew",
  "ar-SA": "Modern Standard Arabic",
  "en-US": "clear American English",
};

/** How the Gemini voice should read: the words exactly as written, pronounced by their meaning. */
function geminiStyle(lang: Lang, rate: number) {
  const pace = rate < 0.9 ? "slowly" : rate > 1.1 ? "at a brisk pace" : "at a calm, slightly slow pace";
  return (
    `A teacher reading an exam question aloud to a student, in ${GEMINI_STYLE[lang]}. ` +
    `Speak clearly and warmly, ${pace}, with a short pause between lines. ` +
    "Pronounce every word correctly according to its meaning in the sentence. " +
    "Read the text exactly as written: do not add, skip, repeat or explain any words."
  );
}

/** The last base64 audio in a Gemini response, wherever the API version puts it. */
export function findGeminiAudio(json: unknown): string | null {
  let found: string | null = null;
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(visit);
    const o = v as Record<string, unknown>;
    // Interactions API: { type: "audio", data }. generateContent: { inlineData: { mimeType: "audio/...", data } }.
    if (typeof o.data === "string" && (o.type === "audio" || (typeof o.mimeType === "string" && o.mimeType.startsWith("audio/")) || (typeof o.mime_type === "string" && o.mime_type.startsWith("audio/"))))
      found = o.data;
    Object.values(o).forEach(visit);
  };
  visit(json);
  return found;
}

async function gemini(text: string, lang: Lang, rate: number): Promise<Pcm> {
  const model = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
  const voice = process.env.GEMINI_TTS_VOICE?.trim() || "Kore";
  const res = await call(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: geminiStyle(lang, rate) }] }] }],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice }] },
      }),
    },
    "Gemini TTS",
    90_000,
  );
  const data = findGeminiAudio(await res.json());
  if (!data) throw new TtsError("service", "Gemini TTS returned no audio");
  const { pcm, sampleRate } = wavToPcm(Buffer.from(data, "base64"));
  return resample(pcm, sampleRate);
}

/** A real tone whose length follows the text, so tests exercise the whole flow. */
function fake(text: string): Pcm {
  const n = Math.round(SAMPLE_RATE * Math.min(5, 1 + text.length / 40));
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 8000);
  return pcm;
}

/**
 * Splits a long text into parts of at most `max` characters: by lines, then by sentences, then by
 * words. Each part is read on its own, so a long reading passage stays within the service's limits.
 */
export function splitForSpeech(text: string, max: number): string[] {
  const pieces: string[] = [];
  for (const line of lines(text)) {
    if (line.length <= max) {
      pieces.push(line);
      continue;
    }
    for (const sentence of line.match(/[^.!?;:׃]+[.!?;:׃]*\s*/g) ?? [line]) {
      if (sentence.length <= max) {
        pieces.push(sentence.trim());
        continue;
      }
      let cur = "";
      for (const word of sentence.split(/\s+/)) {
        if (cur && cur.length + word.length + 1 > max) {
          pieces.push(cur);
          cur = "";
        }
        cur = cur ? `${cur} ${word}` : word;
      }
      if (cur) pieces.push(cur);
    }
  }
  // Join neighbours back together while they fit; line breaks inside a part become pauses.
  const parts: string[] = [];
  for (const p of pieces.filter(Boolean)) {
    const last = parts[parts.length - 1];
    if (last !== undefined && last.length + p.length + 1 <= max) parts[parts.length - 1] = `${last}\n${p}`;
    else parts.push(p);
  }
  return parts;
}

const CHUNK_CHARS: Record<TtsProvider, number> = { gemini: 900, azure: 2500, google: 2000, fake: 2500 };

/** Runs the parts a few at a time, keeping their order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function encodeMp3(pcm: Pcm): Promise<Buffer> {
  // Loaded as an ES module: the package's CommonJS entry is a browser script that exports nothing.
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const enc = new Mp3Encoder(1, SAMPLE_RATE, 48);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152 * 64) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152 * 64)));
  chunks.push(enc.flush());
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.length)));
}

export async function synthesize(text: string, opts: { rate?: number; provider?: TtsProvider } = {}): Promise<TtsResult> {
  const available = ttsProviders();
  const provider = opts.provider && available.includes(opts.provider) ? opts.provider : available[0];
  if (!provider) throw new Error("No TTS provider configured");
  const clean = text.trim().slice(0, TTS_MAX_CHARS);
  const rate = Math.min(1.3, Math.max(0.6, opts.rate ?? 0.95));
  const lang = detectLanguage(clean);
  const speak = (part: string): Promise<Pcm> => {
    if (provider === "fake") return Promise.resolve(fake(part));
    if (provider === "gemini") return gemini(part, lang, rate);
    if (provider === "azure") return azure(part, lang, rate);
    return google(part, lang, rate);
  };
  let parts: Pcm[];
  try {
    parts = await mapLimit(splitForSpeech(clean, CHUNK_CHARS[provider]), 4, speak);
  } catch (e) {
    if (e instanceof TtsError) e.provider = provider;
    // The free daily quota of one voice ran out: read with the next voice instead of failing.
    const next = available[available.indexOf(provider) + 1];
    if (e instanceof TtsError && e.reason === "quota" && next) return synthesize(text, { ...opts, provider: next });
    throw e;
  }
  // A short silence between parts, like the pause between lines.
  const gap = new Int16Array(Math.round(SAMPLE_RATE * 0.6));
  const total = parts.reduce((n, p) => n + p.length, 0) + gap.length * (parts.length - 1);
  const pcm = new Int16Array(total);
  let at = 0;
  parts.forEach((p, i) => {
    if (i) at += gap.length;
    pcm.set(p, at);
    at += p.length;
  });
  return { audio: await encodeMp3(pcm), mimeType: "audio/mpeg", provider };
}
