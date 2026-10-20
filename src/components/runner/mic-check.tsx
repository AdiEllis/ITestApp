"use client";
import { RecordingAudio } from "@/components/media/recording-audio";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, Play, RotateCcw, Square } from "lucide-react";
import { useRecorder, MIC_ERROR_TEXT, recordingSupported } from "@/lib/client/recorder";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LevelMeter } from "@/components/media/level-meter";
import { formatDuration } from "@/lib/format";

const TEST_SECONDS = 5;

/**
 * Pre-exam microphone check: permission → live level → short test recording → playback.
 * Calls onPassed once the student confirms they heard themselves.
 */
export function MicCheck({ onPassed, compact }: { onPassed?: () => void; compact?: boolean }) {
  const rec = useRecorder();
  const [stage, setStage] = useState<"start" | "live" | "recording" | "playback" | "passed">("start");
  const [url, setUrl] = useState<string | null>(null);
  const [silent, setSilent] = useState(false);
  const [unsupported, setUnsupported] = useState<ReturnType<typeof recordingSupported>>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => setUnsupported(recordingSupported()), []);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  async function enable() {
    if (await rec.prepare()) setStage("live");
  }
  async function record() {
    setSilent(false);
    const ok = await rec.start(TEST_SECONDS, (r) => r && done(r.blob, r.peak));
    if (ok) setStage("recording");
  }
  function done(blob: Blob, peak: number) {
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(blob));
    setSilent(peak < 0.02);
    setStage("playback");
    setTimeout(() => audioRef.current?.play().catch(() => undefined), 100);
  }
  async function stopNow() {
    const r = await rec.stop();
    if (r) done(r.blob, r.peak);
  }

  if (unsupported) {
    const t = MIC_ERROR_TEXT[unsupported];
    return <Alert tone="danger" title={t.title}>{t.body}</Alert>;
  }
  if (rec.state === "error" && rec.error) {
    const t = MIC_ERROR_TEXT[rec.error];
    return (
      <Alert tone="danger" title={t.title}>
        {t.body}
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={enable}>
            ניסיון חוזר
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {stage === "start" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">לפני שמתחילים נוודא שהמיקרופון עובד. הדפדפן יבקש אישור גישה למיקרופון — יש ללחוץ &quot;אפשר&quot;.</p>
          <Button onClick={enable} disabled={rec.state === "preparing"}>
            {rec.state === "preparing" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} הפעלת מיקרופון
          </Button>
        </div>
      )}
      {(stage === "live" || stage === "recording") && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-line bg-subtle px-4 py-3">
            <Mic className={`size-5 ${stage === "recording" ? "text-rec" : "text-ok"}`} />
            <LevelMeter level={rec.level} bars={20} />
            <span className="text-sm text-ink-2">{stage === "recording" ? `מקליט… ${formatDuration(rec.elapsed)}` : "דברו — הפסים אמורים לזוז"}</span>
          </div>
          {stage === "live" ? (
            <Button onClick={record}>
              <Mic className="size-4" /> הקלטת ניסיון ({TEST_SECONDS} שניות)
            </Button>
          ) : (
            <Button onClick={stopNow} className="bg-rec hover:bg-[#b82d31]">
              <Square className="size-3.5 fill-current" /> עצירה
            </Button>
          )}
          {stage === "recording" && <p lang="en" dir="ltr" className="text-left text-sm text-ink-2">Say: “Hello, my name is … and I am ready for the test.”</p>}
        </div>
      )}
      {stage === "playback" && url && (
        <div className="space-y-4">
          <p className="text-sm font-medium">האזינו להקלטת הניסיון:</p>
          <RecordingAudio ref={audioRef} src={url} className="w-full" />
          {silent && <Alert tone="warn" title="כמעט לא נקלט קול">בדקו שהמיקרופון אינו מושתק ושאתם מדברים קרוב למכשיר.</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setStage("passed");
                onPassed?.();
              }}
            >
              <CheckCircle2 className="size-4" /> שמעתי את עצמי — הכול תקין
            </Button>
            <Button variant="secondary" onClick={() => setStage("live")}>
              <RotateCcw className="size-4" /> ניסיון נוסף
            </Button>
            <Button variant="ghost" onClick={() => audioRef.current?.play()}>
              <Play className="size-4" /> השמעה
            </Button>
          </div>
        </div>
      )}
      {stage === "passed" && (
        <p className="flex items-center gap-2 text-sm font-medium text-ok">
          <CheckCircle2 className="size-4" /> המיקרופון תקין
        </p>
      )}
    </div>
  );
}
