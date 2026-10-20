"use client";

export type UploadKind = "QUESTION_AUDIO" | "QUESTION_VIDEO" | "QUESTION_IMAGE" | "SOURCE_DOCUMENT" | "RECORDING";

export class UploadError extends Error {
  constructor(
    message: string,
    /** true when retrying could help (network / server hiccup) */
    public retryable: boolean,
  ) {
    super(message);
  }
}

async function postJson(url: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  } catch {
    throw new UploadError("אין חיבור לרשת", true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError(data.error ?? "השרת החזיר שגיאה", res.status >= 500 || res.status === 429);
  return data;
}

function put(url: string, body: Blob, headers: Record<string, string>, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError("העלאת הקובץ נכשלה", xhr.status >= 500 || xhr.status === 0)));
    xhr.onerror = () => reject(new UploadError("החיבור נקטע במהלך ההעלאה", true));
    xhr.ontimeout = () => reject(new UploadError("ההעלאה ארכה זמן רב מדי", true));
    xhr.send(body);
  });
}

/** init → PUT to storage → complete (server verifies size + content). Returns the media id. */
export async function uploadFile(
  file: Blob,
  opts: { kind: UploadKind; name?: string; attemptId?: string; questionId?: string; durationSec?: number | null; onProgress?: (f: number) => void },
): Promise<string> {
  const mimeType = (file.type || guessMime(opts.name) || "application/octet-stream").split(";")[0];
  const init = await postJson("/api/uploads", {
    kind: opts.kind,
    mimeType,
    sizeBytes: file.size,
    originalName: opts.name,
    attemptId: opts.attemptId,
    questionId: opts.questionId,
  });
  await put(init.upload.url, file, init.upload.headers, opts.onProgress);
  await postJson(`/api/uploads/${init.mediaId}/complete`, {
    attemptId: opts.attemptId,
    questionId: opts.questionId,
    durationSec: opts.durationSec ?? null,
  });
  return init.mediaId as string;
}

/** Retries retryable failures with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, onRetry?: (attempt: number, err: UploadError) => void, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!(e instanceof UploadError) || !e.retryable || i === attempts - 1) throw e;
      onRetry?.(i + 1, e);
      await new Promise((r) => setTimeout(r, Math.min(15000, 1000 * 2 ** i)));
    }
  }
  throw last;
}

const EXT_MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pdf: "application/pdf",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
/** Some OSes report an empty type for .docx/.m4a; fall back to the extension. */
export function guessMime(name?: string): string | undefined {
  const ext = name?.split(".").pop()?.toLowerCase();
  return ext ? EXT_MIME[ext] : undefined;
}
