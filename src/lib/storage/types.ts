export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface StorageDriver {
  /** URL the browser PUTs the raw file body to. */
  createUploadTarget(key: string, mimeType: string, sizeBytes: number, ttlSec: number): Promise<UploadTarget>;
  /** Short-lived URL to read a private object. */
  createDownloadUrl(key: string, opts: { ttlSec: number; mimeType: string; downloadName?: string }): Promise<string>;
  /** Size of the stored object, or null if missing. */
  stat(key: string): Promise<{ size: number } | null>;
  /** First `length` bytes, for content sniffing. */
  readHead(key: string, length: number): Promise<Buffer>;
  put(key: string, body: Buffer, mimeType: string): Promise<void>;
  copy(fromKey: string, toKey: string): Promise<void>;
  delete(key: string): Promise<void>;
}
