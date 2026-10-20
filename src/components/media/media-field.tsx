"use client";
import { useRef, useState } from "react";
import { Loader2, Mic, Paperclip, Square, Trash2, Upload } from "lucide-react";
import { uploadFile, type UploadKind } from "@/lib/client/upload";
import { useRecorder, MIC_ERROR_TEXT } from "@/lib/client/recorder";
import { mediaCategory } from "@/lib/files";
import type { MediaMeta } from "@/lib/builder-state";
import { Button } from "@/components/ui/button";
import { MediaPlayer } from "./media-player";
import { ProgressBar } from "./progress-bar";
import { LevelMeter } from "./level-meter";
import { formatDuration } from "@/lib/format";

type Accept = "audio" | "video" | "image" | "audio-video";

const ACCEPT: Record<Accept, string> = {
  audio: "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg,.mp3,.m4a,.wav",
  video: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
  image: "image/png,image/jpeg,image/webp,image/gif",
  "audio-video": "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,video/mp4,video/quicktime,video/webm,.mp3,.m4a,.wav,.mp4,.mov",
};

function kindFor(file: Blob, accept: Accept): UploadKind {
  const cat = mediaCategory(file.type);
  if (accept === "image") return "QUESTION_IMAGE";
  if (cat === "video") return "QUESTION_VIDEO";
  return "QUESTION_AUDIO";
}

/**
 * Attach a media file to a question/section: upload from disk, record with the microphone (audio),
 * or pick one of the exam's imported source files.
 */
export function MediaField({
  label,
  accept,
  value,
  media,
  onChange,
  sourceFiles,
  allowRecord,
  disabled,
}: {
  label: string;
  accept: Accept;
  value: string | null;
  media: MediaMeta;
  onChange: (id: string | null, meta?: MediaMeta[string]) => void;
  sourceFiles?: { id: string; name: string | null; mimeType: string; sizeBytes: number }[];
  allowRecord?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRecorder();
  const [recording, setRecording] = useState(false);

  const cats = accept === "audio-video" ? ["audio", "video"] : [accept];
  const matchingSources = (sourceFiles ?? []).filter((f) => cats.includes(mediaCategory(f.mimeType)));

  async function upload(file: Blob, name: string, durationSec?: number) {
    setError(null);
    setProgress(0);
    try {
      const id = await uploadFile(file, { kind: kindFor(file, accept), name, onProgress: setProgress, durationSec });
      onChange(id, { mimeType: file.type.split(";")[0], name, sizeBytes: file.size });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function toggleRecord() {
    if (!recording) {
      setError(null);
      const ok = await rec.start(300, async (r) => {
        setRecording(false);
        if (r) await finishRecording(r.blob, r.durationSec);
      });
      setRecording(ok);
      return;
    }
    const r = await rec.stop();
    setRecording(false);
    if (r) await finishRecording(r.blob, r.durationSec);
  }
  async function finishRecording(blob: Blob, durationSec: number) {
    if (blob.size < 1000 || durationSec < 0.8) {
      setError("ההקלטה קצרה מדי או ריקה");
      return;
    }
    rec.release();
    await upload(blob, `recorded-question.${blob.type.includes("mp4") ? "m4a" : "webm"}`, durationSec);
  }

  const meta = value ? media[value] : undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        {value && !disabled && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} aria-label={`הסרת ${label}`}>
            <Trash2 className="size-4" /> הסרה
          </Button>
        )}
      </div>
      {value && meta ? (
        <MediaPlayer id={value} mimeType={meta.mimeType} name={meta.name} className={mediaCategory(meta.mimeType) === "video" ? "aspect-video w-full max-w-md rounded-lg bg-black" : undefined} />
      ) : value ? (
        <p className="text-sm text-ink-3">קובץ מצורף</p>
      ) : null}
      {!value && !disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPT[accept]}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, f.name);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={progress !== null || recording}>
            <Upload className="size-4" /> העלאת קובץ
          </Button>
          {allowRecord && (
            <Button variant={recording ? "primary" : "secondary"} size="sm" onClick={toggleRecord} disabled={progress !== null} className={recording ? "bg-rec hover:bg-rec" : ""}>
              {recording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
              {recording ? `עצירה ${formatDuration(rec.elapsed)}` : "הקלטה במיקרופון"}
            </Button>
          )}
          {recording && <LevelMeter level={rec.level} bars={10} />}
          {matchingSources.length > 0 && (
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-2">
              <Paperclip className="size-4" />
              <select
                className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-sm"
                value=""
                onChange={(e) => {
                  const f = matchingSources.find((s) => s.id === e.target.value);
                  if (f) onChange(f.id, { mimeType: f.mimeType, name: f.name, sizeBytes: f.sizeBytes });
                }}
              >
                <option value="">מהקבצים שהועלו…</option>
                {matchingSources.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name ?? f.id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {progress !== null && (
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <Loader2 className="size-3.5 animate-spin" /> מעלה… <ProgressBar value={progress} />
        </div>
      )}
      {rec.error && <p className="text-sm text-danger">{MIC_ERROR_TEXT[rec.error].title}: {MIC_ERROR_TEXT[rec.error].body}</p>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
