import type { MediaKind } from "@prisma/client";

/** Detected container/format from magic bytes. */
export type Sniffed = "webm" | "mp4" | "ogg" | "mp3" | "wav" | "aac" | "pdf" | "zip" | "ole" | "png" | "jpeg" | "webp" | "gif" | null;

export function sniff(head: Buffer): Sniffed {
  const b = head;
  const ascii = (start: number, len: number) => b.subarray(start, start + len).toString("latin1");
  if (b.length < 4) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (b.length >= 12 && ascii(4, 4) === "ftyp") return "mp4";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return "mp3";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "aac";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "ole";
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (ascii(0, 4) === "GIF8") return "gif";
  return null;
}

interface KindRule {
  maxBytes: number;
  /** mime type (without parameters) -> accepted sniffed formats */
  mimes: Record<string, Sniffed[]>;
  label: string;
}

const MB = 1024 * 1024;

export const KIND_RULES: Record<MediaKind, KindRule> = {
  RECORDING: {
    maxBytes: 30 * MB,
    label: "הקלטה",
    mimes: {
      "audio/webm": ["webm"],
      "audio/ogg": ["ogg"],
      "audio/mp4": ["mp4"],
      "audio/x-m4a": ["mp4"],
      "audio/aac": ["aac", "mp4"],
      "audio/wav": ["wav"],
      // Some browsers label audio-only recordings as video/*
      "video/webm": ["webm"],
      "video/mp4": ["mp4"],
    },
  },
  QUESTION_AUDIO: {
    maxBytes: 50 * MB,
    label: "קובץ שמע",
    mimes: {
      "audio/mpeg": ["mp3"],
      "audio/mp3": ["mp3"],
      "audio/mp4": ["mp4"],
      "audio/x-m4a": ["mp4"],
      "audio/m4a": ["mp4"],
      "audio/aac": ["aac", "mp4"],
      "audio/wav": ["wav"],
      "audio/x-wav": ["wav"],
      "audio/wave": ["wav"],
      "audio/webm": ["webm"],
      "audio/ogg": ["ogg"],
      "video/webm": ["webm"],
    },
  },
  QUESTION_VIDEO: {
    maxBytes: 400 * MB,
    label: "סרטון",
    mimes: {
      "video/mp4": ["mp4"],
      "video/quicktime": ["mp4"],
      "video/webm": ["webm"],
    },
  },
  QUESTION_IMAGE: {
    maxBytes: 10 * MB,
    label: "תמונה",
    mimes: { "image/png": ["png"], "image/jpeg": ["jpeg"], "image/webp": ["webp"], "image/gif": ["gif"] },
  },
  SOURCE_DOCUMENT: {
    maxBytes: 30 * MB,
    label: "מסמך",
    mimes: {
      "application/pdf": ["pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["zip"],
      "application/msword": ["ole"],
      // Teachers may also attach source media to an imported exam.
      "audio/mpeg": ["mp3"],
      "audio/mp4": ["mp4"],
      "audio/x-m4a": ["mp4"],
      "audio/wav": ["wav"],
      "audio/x-wav": ["wav"],
      "video/mp4": ["mp4"],
      "video/quicktime": ["mp4"],
      "video/webm": ["webm"],
      "image/png": ["png"],
      "image/jpeg": ["jpeg"],
    },
  },
};

export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function checkDeclared(kind: MediaKind, mimeType: string, sizeBytes: number): string | null {
  const rule = KIND_RULES[kind];
  const mime = baseMime(mimeType);
  if (!rule.mimes[mime]) return `סוג הקובץ אינו נתמך עבור ${rule.label}`;
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) return "הקובץ ריק";
  if (sizeBytes > rule.maxBytes) return `הקובץ גדול מדי (מקסימום ${Math.round(rule.maxBytes / MB)}MB)`;
  return null;
}

/** Verifies the stored bytes actually match the declared type. */
export function checkContent(kind: MediaKind, mimeType: string, head: Buffer): string | null {
  const allowed = KIND_RULES[kind].mimes[baseMime(mimeType)];
  const found = sniff(head);
  if (!allowed || !found || !allowed.includes(found)) return "תוכן הקובץ אינו תואם את סוג הקובץ";
  return null;
}

export function mediaCategory(mime: string): "audio" | "video" | "image" | "pdf" | "doc" {
  const m = baseMime(mime);
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  return "doc";
}

export function extensionFor(mime: string): string {
  const m = baseMime(mime);
  const map: Record<string, string> = {
    "audio/webm": "webm", "video/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
    "audio/aac": "aac", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
    "video/mp4": "mp4", "video/quicktime": "mov", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
    "application/pdf": "pdf", "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[m] ?? "bin";
}
