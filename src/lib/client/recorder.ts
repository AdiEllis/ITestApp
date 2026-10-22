"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type MicError = "denied" | "no-device" | "busy" | "insecure" | "unsupported" | "unknown";

export const MIC_ERROR_TEXT: Record<MicError, { title: string; body: string }> = {
  denied: {
    title: "הגישה למיקרופון נחסמה",
    body: "יש לאפשר גישה למיקרופון בהגדרות הדפדפן (סמל המנעול ליד כתובת האתר) ולרענן את הדף. באייפון: הגדרות ← Safari ← מיקרופון.",
  },
  "no-device": { title: "לא נמצא מיקרופון", body: "חברו מיקרופון או אוזניות עם מיקרופון ונסו שוב." },
  busy: { title: "המיקרופון בשימוש", body: "ייתכן שאפליקציה אחרת (שיחה, Zoom) משתמשת במיקרופון. סגרו אותה ונסו שוב." },
  insecure: { title: "חיבור לא מאובטח", body: "הקלטה אפשרית רק בחיבור מאובטח (https)." },
  unsupported: { title: "הדפדפן אינו תומך בהקלטה", body: "השתמשו בגרסה עדכנית של Chrome, Edge או Safari." },
  unknown: { title: "לא ניתן להפעיל את המיקרופון", body: "נסו לרענן את הדף או להשתמש בדפדפן אחר." },
};

function classify(err: unknown): MicError {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no-device";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  if (name === "SecurityError") return "insecure";
  return "unknown";
}

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", "audio/aac"];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

export function recordingSupported(): MicError | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "unsupported";
  return null;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  /** Peak input level 0..1 — near zero means silence (muted mic?) */
  peak: number;
}

/**
 * Microphone recorder with live level meter and hard max duration.
 * The stream is opened once (`prepare`) and kept for the session to avoid repeated permission prompts.
 */
export function useRecorder() {
  const [state, setState] = useState<"idle" | "preparing" | "ready" | "recording" | "error">("idle");
  const [error, setError] = useState<MicError | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const peakRef = useRef(0);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolve = useRef<((r: RecordingResult | null) => void) | null>(null);
  const autoStopRef = useRef<((r: RecordingResult | null) => void) | null>(null);

  /**
   * Drops a stream the system has taken away (iPhone does this when the student switches apps or
   * locks the screen). Not an error: the next "start recording" tap simply opens the mic again.
   */
  const dropDeadStream = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") {
      // Mid-recording: stop and keep what was recorded (delivered through onstop).
      try {
        recRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    analyserRef.current = null;
    setState((s) => (s === "error" ? s : "idle"));
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && streamRef.current && !streamRef.current.active) dropDeadStream();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [dropDeadStream]);

  const meter = useCallback(() => {
    const a = analyserRef.current;
    if (!a) return;
    const buf = new Uint8Array(a.fftSize);
    const loop = () => {
      a.getByteTimeDomainData(buf);
      let max = 0;
      for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i] - 128) / 128);
      setLevel((prev) => prev * 0.6 + max * 0.4);
      if (recRef.current?.state === "recording") peakRef.current = Math.max(peakRef.current, max);
      rafRef.current = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(rafRef.current);
    loop();
  }, []);

  const prepare = useCallback(async (): Promise<boolean> => {
    const unsupported = recordingSupported();
    if (unsupported) {
      setError(unsupported);
      setState("error");
      return false;
    }
    if (streamRef.current?.active) {
      // Must be resumed inside a user gesture on iOS.
      await ctxRef.current?.resume().catch(() => undefined);
      setState("ready");
      return true;
    }
    setState("preparing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        if (streamRef.current === stream) dropDeadStream();
      });
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        await ctx.resume().catch(() => undefined);
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        meter();
      } catch {
        // Level meter is optional; recording still works without it.
      }
      setError(null);
      setState("ready");
      return true;
    } catch (e) {
      setError(classify(e));
      setState("error");
      return false;
    }
  }, [meter, dropDeadStream]);

  const stop = useCallback((): Promise<RecordingResult | null> => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      stopResolve.current = resolve;
      try {
        rec.requestData?.();
      } catch {
        /* some Safari versions throw if no data yet */
      }
      rec.stop();
    });
  }, []);

  const start = useCallback(
    async (maxSec: number, onAutoStop?: (r: RecordingResult | null) => void) => {
      if (!(await prepare())) return false;
      const stream = streamRef.current!;
      const mimeType = pickMimeType();
      let rec: MediaRecorder;
      try {
        rec = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 }) : new MediaRecorder(stream);
      } catch {
        rec = new MediaRecorder(stream);
      }
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const durationSec = (performance.now() - startRef.current) / 1000;
        const type = (rec.mimeType || mimeType || chunks[0]?.type || "audio/webm").split(";")[0];
        const blob = new Blob(chunks, { type });
        const result: RecordingResult = { blob, mimeType: type, durationSec: Math.round(durationSec * 10) / 10, peak: peakRef.current };
        setState((s) => (s === "recording" ? (streamRef.current?.active ? "ready" : "idle") : s));
        recRef.current = null;
        if (stopResolve.current) {
          stopResolve.current(result);
          stopResolve.current = null;
        } else {
          // Stopped by the system (mic taken away): keep the recording.
          autoStopRef.current?.(result);
        }
      };
      rec.onerror = () => {
        setError("unknown");
        setState("error");
      };
      peakRef.current = 0;
      autoStopRef.current = onAutoStop ?? null;
      recRef.current = rec;
      // timeslice keeps data flowing so a crash mid-recording loses at most ~1s
      rec.start(1000);
      startRef.current = performance.now();
      setElapsed(0);
      setState("recording");
      timerRef.current = setInterval(async () => {
        const s = (performance.now() - startRef.current) / 1000;
        setElapsed(s);
        if (s >= maxSec) {
          if (timerRef.current) clearInterval(timerRef.current);
          const r = await stop();
          onAutoStop?.(r);
        }
      }, 200);
      return true;
    },
    [prepare, stop],
  );

  const release = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    analyserRef.current = null;
    setState("idle");
  }, []);

  useEffect(() => release, [release]);

  return { state, error, level, elapsed, prepare, start, stop, release };
}
