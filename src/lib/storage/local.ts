import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { signToken } from "../crypto";
import type { StorageDriver } from "./types";

/** Resolves a storage key to an absolute path, refusing anything that escapes the storage root. */
export function localPath(key: string): string {
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  const root = path.resolve(env.storageLocalDir);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export const localDriver: StorageDriver = {
  async createUploadTarget(key, mimeType, sizeBytes, ttlSec) {
    const token = signToken({ k: key, op: "put", max: sizeBytes }, env.appSecret, ttlSec);
    return { url: `/api/storage/upload/${token}`, method: "PUT", headers: { "Content-Type": mimeType } };
  },
  async createDownloadUrl(key, { ttlSec, mimeType, downloadName }) {
    const token = signToken({ k: key, op: "get", m: mimeType, n: downloadName ?? null }, env.appSecret, ttlSec);
    return `/api/storage/file/${token}`;
  },
  async stat(key) {
    try {
      const s = await fs.stat(localPath(key));
      return { size: s.size };
    } catch {
      return null;
    }
  },
  async readHead(key, length) {
    const fh = await fs.open(localPath(key), "r");
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  },
  async put(key, body) {
    const p = localPath(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  },
  async copy(fromKey, toKey) {
    const to = localPath(toKey);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(localPath(fromKey), to);
  },
  async delete(key) {
    await fs.rm(localPath(key), { force: true });
  },
};

export function localReadStream(key: string, start?: number, end?: number) {
  return createReadStream(localPath(key), start !== undefined ? { start, end } : undefined);
}
