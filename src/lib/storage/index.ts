import { env } from "../env";
import { localDriver } from "./local";
import { s3Driver } from "./s3";
import type { StorageDriver } from "./types";

export function storage(): StorageDriver {
  if (env.storageDriver === "s3") return s3Driver;
  // Serverless disks are wiped between requests: refuse instead of silently losing recordings.
  if (process.env.VERCEL) throw new Error('STORAGE_DRIVER must be "s3" on Vercel');
  return localDriver;
}
export type { StorageDriver, UploadTarget } from "./types";
