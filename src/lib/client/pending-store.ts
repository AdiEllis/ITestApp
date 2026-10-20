"use client";

/**
 * IndexedDB store for recordings that were made but not yet confirmed by the server.
 * A recording is written here BEFORE uploading and removed only after the server confirms,
 * so a dropped connection, closed tab or crash does not lose the student's answer.
 */
export interface PendingRecording {
  key: string; // `${attemptId}:${questionId}`
  attemptId: string;
  questionId: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  createdAt: number;
}

const DB = "oralprep";
const STORE = "pending-recordings";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePending(p: Omit<PendingRecording, "key">) {
  // Safari private mode may refuse Blob storage; failures are non-fatal (upload still proceeds).
  return tx("readwrite", (s) => s.put({ ...p, key: `${p.attemptId}:${p.questionId}` }));
}
export async function removePending(attemptId: string, questionId: string) {
  return tx("readwrite", (s) => s.delete(`${attemptId}:${questionId}`));
}
export async function listPending(attemptId: string): Promise<PendingRecording[]> {
  const all = (await tx<PendingRecording[]>("readonly", (s) => s.getAll() as IDBRequest<PendingRecording[]>)) ?? [];
  return all.filter((p) => p.attemptId === attemptId);
}
