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

let client: S3Client | null = null;
function s3() {
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}
function bucket() {
  const b = process.env.S3_BUCKET;
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
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: mimeType }));
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
