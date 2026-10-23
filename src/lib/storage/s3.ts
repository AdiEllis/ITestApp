import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageDriver } from "./types";

/** Values pasted into Vercel often carry spaces or miss "https://"; tidy them up. */
export function s3Settings(e: NodeJS.ProcessEnv = process.env) {
  let endpoint = e.S3_ENDPOINT?.trim().replace(/\/+$/, "") || undefined;
  if (endpoint && !/^https?:\/\//.test(endpoint)) endpoint = `https://${endpoint}`;
  // Backblaze endpoints name their region (s3.us-east-005.backblazeb2.com); a different region fails signing.
  const b2 = endpoint?.match(/^https:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com$/);
  return {
    endpoint,
    region: b2?.[1] ?? (e.S3_REGION?.trim() || "auto"),
    bucket: e.S3_BUCKET?.trim(),
    accessKeyId: e.S3_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: e.S3_SECRET_ACCESS_KEY?.trim() ?? "",
  };
}

/** A Hebrew hint for a failed storage call, with the service's error code for support. */
export function describeStorageError(err: unknown) {
  const e = err as { name?: string; Code?: string; code?: string; message?: string };
  const code = e?.Code ?? (e?.name && e.name !== "Error" ? e.name : e?.code) ?? "Error";
  const hint =
    /InvalidAccessKeyId|InvalidAccessKey|Unauthorized|InvalidToken/i.test(code)
      ? "המפתח של האחסון לא מוכר. בדקו ב-Vercel ש-S3_ACCESS_KEY_ID הוא ה-keyID מ-Backblaze."
      : /SignatureDoesNotMatch/i.test(code)
        ? "הסיסמה של האחסון לא נכונה. בדקו ב-Vercel ש-S3_SECRET_ACCESS_KEY הוא ה-applicationKey מ-Backblaze."
        : /AccessDenied|Forbidden/i.test(code)
          ? "למפתח של האחסון אין הרשאת כתיבה ל-bucket. ב-Backblaze צריך מפתח עם Read and Write ל-bucket הזה."
          : /NoSuchBucket/i.test(code)
            ? "ה-bucket לא נמצא. בדקו ב-Vercel ש-S3_BUCKET זהה בדיוק לשם ה-bucket ב-Backblaze."
            : /AuthorizationHeaderMalformed|IllegalLocationConstraint|PermanentRedirect/i.test(code)
              ? "האזור או הכתובת של האחסון לא נכונים. בדקו ב-Vercel את S3_ENDPOINT ו-S3_REGION."
              : /ENOTFOUND|EAI_AGAIN|Invalid URL|TypeError/i.test(code + (e?.message ?? ""))
                ? "כתובת האחסון לא נכונה. בדקו ב-Vercel ש-S3_ENDPOINT הוא ה-Endpoint מ-Backblaze."
                : "אחסון הקבצים החזיר שגיאה.";
  return `${hint} (קוד: ${code})`;
}

let client: S3Client | null = null;
function s3() {
  if (!client) {
    const c = s3Settings();
    client = new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      // Newer SDKs add CRC32 checksums to every upload by default, which S3-compatible services
      // such as Backblaze B2 and R2 can reject. Only send checksums where AWS requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
      },
    });
  }
  return client;
}
function bucket() {
  const b = s3Settings().bucket;
  if (!b) throw new Error("S3_BUCKET is not configured");
  return b;
}

export const s3Driver: StorageDriver = {
  async createUploadTarget(key, mimeType, sizeBytes, ttlSec) {
    const url = await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mimeType, ContentLength: sizeBytes }),
      { expiresIn: ttlSec, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    return { url, method: "PUT", headers: { "Content-Type": mimeType } };
  },
  async createDownloadUrl(key, { ttlSec, mimeType, downloadName }) {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ResponseContentType: mimeType,
        ResponseContentDisposition: downloadName
          ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
          : "inline",
      }),
      { expiresIn: ttlSec },
    );
  },
  async stat(key) {
    try {
      const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { size: Number(r.ContentLength ?? 0) };
    } catch {
      return null;
    }
  },
  async readHead(key, length) {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: `bytes=0-${length - 1}` }));
    const bytes = await r.Body!.transformToByteArray();
    return Buffer.from(bytes);
  },
  async put(key, body, mimeType) {
    // Upload through a signed URL, the same way browsers upload recordings. Sending the body through
    // the SDK made Backblaze B2 answer IncompleteBody.
    const target = await s3Driver.createUploadTarget(key, mimeType, body.length, 300);
    const res = await fetch(target.url, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`S3 PUT ${res.status}: ${text.slice(0, 300)}`) as Error & { Code?: string };
      err.Code = text.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? `HTTP${res.status}`;
      throw err;
    }
  },
  async copy(fromKey, toKey) {
    await s3().send(
      new CopyObjectCommand({ Bucket: bucket(), Key: toKey, CopySource: `${bucket()}/${encodeURIComponent(fromKey)}` }),
    );
  },
  async delete(key) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
};
