import { env } from "../env";
import { localDriver } from "./local";
import { s3Driver } from "./s3";
import type { StorageDriver } from "./types";

export function storage(): StorageDriver {
  return env.storageDriver === "s3" ? s3Driver : localDriver;
}
export type { StorageDriver, UploadTarget } from "./types";
