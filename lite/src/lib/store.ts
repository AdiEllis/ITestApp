/**
 * Teacher data lives only in this browser (IndexedDB). No server, no accounts.
 * A backup file (export/import) protects against clearing the browser or changing computers.
 */
import type { Criterion, Exam, Submission } from "./types";

const DB_NAME = "oralprep-lite";
const VERSION = 1;
type StoreName = "exams" | "submissions" | "kv" | "studentDrafts";

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ["exams", "submissions", "kv", "studentDrafts"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function wrap<T>(r: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx(store: StoreName, mode: IDBTransactionMode) {
  return (await open()).transaction(store, mode).objectStore(store);
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  return wrap((await tx(store, "readonly")).get(key)) as Promise<T | undefined>;
}
export async function put(store: StoreName, key: string, value: unknown) {
  await wrap((await tx(store, "readwrite")).put(value, key));
  notify();
}
export async function del(store: StoreName, key: string) {
  await wrap((await tx(store, "readwrite")).delete(key));
  notify();
}
export async function all<T>(store: StoreName): Promise<T[]> {
  return wrap((await tx(store, "readonly")).getAll()) as Promise<T[]>;
}

// Simple change notification so screens refresh after writes.
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function notify() {
  listeners.forEach((f) => f());
}

export const exams = {
  list: async () => (await all<Exam>("exams")).sort((a, b) => b.updatedAt - a.updatedAt),
  get: (id: string) => get<Exam>("exams", id),
  save: (e: Exam) => put("exams", e.id, { ...e, updatedAt: Date.now() }),
  remove: (id: string) => del("exams", id),
};
export const submissions = {
  list: async () => (await all<Submission>("submissions")).sort((a, b) => b.submittedAt - a.submittedAt),
  get: (id: string) => get<Submission>("submissions", id),
  save: (s: Submission) => put("submissions", s.id, s),
  remove: (id: string) => del("submissions", id),
};
export const settings = {
  rubric: () => get<Criterion[]>("kv", "rubric"),
  setRubric: (r: Criterion[]) => put("kv", "rubric", r),
  teacherName: async () => (await get<string>("kv", "teacherName")) ?? "",
  setTeacherName: (n: string) => put("kv", "teacherName", n),
  classes: async () => (await get<string[]>("kv", "classes")) ?? [],
  setClasses: (c: string[]) => put("kv", "classes", c),
  lastBackup: () => get<number>("kv", "lastBackup"),
  setLastBackup: (t: number) => put("kv", "lastBackup", t),
};

/** Asks the browser not to evict this site's storage under pressure (best effort). */
export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
