"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadError, uploadFile, withRetry } from "@/lib/client/upload";
import { listPending, removePending, savePending } from "@/lib/client/pending-store";
import type { RecordingResult } from "@/lib/client/recorder";

export type UploadStatus =
  | { state: "uploading"; progress: number; retry?: number }
  | { state: "waiting-network" }
  | { state: "failed"; error: string; retryable: boolean }
  | { state: "done" };

export interface SavedAnswer {
  recordingId: string | null;
  recordingCount: number;
  durationSec: number | null;
  mimeType: string | null;
  /** typed answer, when the student chose the keyboard */
  textAnswer?: string | null;
  /** object URL for instant local playback after recording */
  localUrl?: string;
}

/**
 * Reliable recording uploads:
 * 1. the blob is stored in IndexedDB first,
 * 2. uploaded with retries/backoff (pauses while offline),
 * 3. removed locally only after the server confirmed it.
 * Pending recordings from an earlier session (crash, closed tab) are resumed on mount.
 */
export function useRecordingUploads(attemptId: string, preview: boolean, onSaved: (questionId: string, a: SavedAnswer) => void) {
  const [status, setStatus] = useState<Record<string, UploadStatus>>({});
  const [online, setOnline] = useState(true);
  const inflight = useRef(new Set<string>());
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const set = (qid: string, s: UploadStatus) => setStatus((cur) => ({ ...cur, [qid]: s }));

  const run = useCallback(
    async (questionId: string, blob: Blob, mimeType: string, durationSec: number, localUrl?: string) => {
      if (inflight.current.has(questionId)) return;
      inflight.current.add(questionId);
      try {
        if (!navigator.onLine) {
          set(questionId, { state: "waiting-network" });
          return;
        }
        set(questionId, { state: "uploading", progress: 0 });
        const file = new Blob([blob], { type: mimeType });
        const mediaId = await withRetry(
          () => uploadFile(file, { kind: "RECORDING", attemptId, questionId, durationSec, onProgress: (p) => set(questionId, { state: "uploading", progress: p }) }),
          (n) => set(questionId, { state: "uploading", progress: 0, retry: n }),
        );
        await removePending(attemptId, questionId);
        set(questionId, { state: "done" });
        onSavedRef.current(questionId, { recordingId: mediaId, recordingCount: -1, durationSec, mimeType, localUrl });
      } catch (e) {
        const retryable = e instanceof UploadError ? e.retryable : true;
        if (!retryable) await removePending(attemptId, questionId);
        set(questionId, retryable && !navigator.onLine ? { state: "waiting-network" } : { state: "failed", error: (e as Error).message, retryable });
      } finally {
        inflight.current.delete(questionId);
      }
    },
    [attemptId],
  );

  const enqueue = useCallback(
    async (questionId: string, r: RecordingResult) => {
      const localUrl = URL.createObjectURL(r.blob);
      if (preview) {
        onSavedRef.current(questionId, { recordingId: null, recordingCount: -1, durationSec: r.durationSec, mimeType: r.mimeType, localUrl });
        set(questionId, { state: "done" });
        return;
      }
      await savePending({ attemptId, questionId, blob: r.blob, mimeType: r.mimeType, durationSec: r.durationSec, createdAt: Date.now() });
      await run(questionId, r.blob, r.mimeType, r.durationSec, localUrl);
    },
    [attemptId, preview, run],
  );

  const retryAll = useCallback(async () => {
    if (preview) return;
    const pending = await listPending(attemptId);
    for (const p of pending) await run(p.questionId, p.blob, p.mimeType, p.durationSec, URL.createObjectURL(p.blob));
  }, [attemptId, preview, run]);

  useEffect(() => {
    if (preview) return;
    setOnline(navigator.onLine);
    void retryAll();
    const up = () => {
      setOnline(true);
      void retryAll();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const t = setInterval(() => navigator.onLine && void retryAll(), 30_000);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      clearInterval(t);
    };
  }, [preview, retryAll]);

  const busy = Object.values(status).some((s) => s.state === "uploading" || s.state === "waiting-network" || (s.state === "failed" && s.retryable));
  return { status, enqueue, retryAll, online, busy };
}
