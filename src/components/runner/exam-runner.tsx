"use client";
import { RecordingAudio } from "@/components/media/recording-audio";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  Hourglass,
  Loader2,
  Mic,
  RotateCcw,
  Send,
  Square,
  Timer,
  Volume2,
  WifiOff,
} from "lucide-react";
import type { ExamSnapshot, SnapshotQuestion, SnapshotSection } from "@/lib/exam-types";
import { spokenText } from "@/lib/exam-types";
import { speakWithDevice, stopDeviceVoice } from "@/lib/client/speech";
import { useRecorder, MIC_ERROR_TEXT, type RecordingResult } from "@/lib/client/recorder";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { En } from "@/components/ui/en";
import { cn } from "@/components/ui/cn";
import { LevelMeter } from "@/components/media/level-meter";
import { ProgressBar } from "@/components/media/progress-bar";
import { LimitedMedia } from "./limited-media";
import { VideoEmbed } from "@/components/media/video-embed";
import { parseVideo } from "@/lib/video";
import { useRecordingUploads, type SavedAnswer, type UploadStatus } from "./use-uploads";

type Progress = { plays?: Record<string, number>; prepStarted?: Record<string, string>; position?: number };

export interface RunnerProps {
  attemptId: string;
  snapshot: ExamSnapshot;
  initialAnswers: Record<string, SavedAnswer>;
  initialChoices: Record<string, string>;
  initialProgress: Progress;
  deadlineAt: string | null;
  serverNow: string;
  preview?: boolean;
  exitHref: string;
}

/** A runner step: one question, or a topic choice for CHOOSE_ONE sections. */
type Step = { section: SnapshotSection; sectionIndex: number; question: SnapshotQuestion | null };

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "אין חיבור לרשת" } };
  }
}

export function ExamRunner(props: RunnerProps) {
  const { snapshot, attemptId, preview = false } = props;
  const router = useRouter();
  const simulation = snapshot.mode === "SIMULATION";
  const canGoBack = snapshot.settings.allowBackNavigation;

  const [answers, setAnswers] = useState(props.initialAnswers);
  const [choices, setChoices] = useState(props.initialChoices);
  const [progress, setProgress] = useState<Progress>(props.initialProgress);
  const steps: Step[] = useMemo(
    () =>
      snapshot.sections.flatMap((section, sectionIndex) => {
        if (section.choiceMode === "CHOOSE_ONE") {
          const chosen = section.questions.find((q) => q.id === choices[section.id]) ?? null;
          return [{ section, sectionIndex, question: chosen }];
        }
        return section.questions.map((question) => ({ section, sectionIndex, question }));
      }),
    [snapshot, choices],
  );
  const [index, setIndex] = useState(Math.min(props.initialProgress.position ?? 0, Math.max(0, steps.length - 1)));
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);

  const recorder = useRecorder();
  const uploads = useRecordingUploads(attemptId, preview, (qid, a) =>
    setAnswers((cur) => ({ ...cur, [qid]: { ...a, recordingCount: a.recordingCount === -1 ? (cur[qid]?.recordingCount ?? 0) + 1 : a.recordingCount } })),
  );

  // ----- clock -----
  const clockOffset = useRef(new Date(props.serverNow).getTime() - Date.now());
  const deadline = props.deadlineAt ? new Date(props.deadlineAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now() + clockOffset.current);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset.current), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = deadline ? Math.max(0, (deadline - now) / 1000) : null;

  const report = useCallback(
    async (body: Record<string, unknown>) => {
      if (preview) return { ok: true, data: {} as Record<string, unknown> };
      const r = await post(`/api/attempts/${attemptId}/progress`, body);
      if (r.ok && r.data.progress) setProgress(r.data.progress as Progress);
      return r;
    },
    [attemptId, preview],
  );

  const goTo = useCallback(
    (i: number) => {
      if (recorder.state === "recording") return;
      setIndex(i);
      setReviewing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      void report({ type: "position", index: i });
    },
    [recorder.state, report],
  );

  const submit = useCallback(
    async (reason: "student" | "timeout") => {
      if (preview) {
        router.push(props.exitHref);
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      const r = await post(`/api/attempts/${attemptId}/submit`, { reason });
      if (!r.ok) {
        setSubmitting(false);
        setSubmitError((r.data.error as string) ?? "ההגשה נכשלה. נסו שוב.");
        return;
      }
      recorder.release();
      router.replace(`/s/attempts/${attemptId}?submitted=1`);
    },
    [attemptId, preview, props.exitHref, recorder, router],
  );

  // Time limit reached: stop any recording, wait for uploads, then auto-submit.
  useEffect(() => {
    if (remaining === null || remaining > 0 || timeUp) return;
    setTimeUp(true);
    void (async () => {
      if (recorder.state === "recording") {
        const r = await recorder.stop();
        const step = steps[index];
        if (r && step?.question) await uploads.enqueue(step.question.id, r);
      }
    })();
  }, [remaining, timeUp, recorder, steps, index, uploads]);
  useEffect(() => {
    if (timeUp && !uploads.busy && !submitting) void submit("timeout");
  }, [timeUp, uploads.busy, submitting, submit]);

  // Warn before leaving with a recording in progress or uploads pending.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (recorder.state === "recording" || uploads.busy) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [recorder.state, uploads.busy]);

  const step = steps[index];
  const answeredCount = steps.filter((s) => s.question && answers[s.question.id]?.recordingCount).length;

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Exam bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" dir="auto">
              {snapshot.title}
            </p>
            <p className="text-xs text-ink-3">
              {simulation ? "מבחן" : "תרגול"} · נענו {answeredCount} מתוך {steps.length}
            </p>
          </div>
          {remaining !== null && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-semibold tabular",
                remaining < 60 ? "bg-rec-soft text-rec" : remaining < 300 ? "bg-warn-soft text-warn" : "bg-subtle text-ink",
              )}
              role="timer"
              aria-label="זמן שנותר"
              dir="ltr"
            >
              <Timer className="size-4" /> {formatDuration(remaining)}
            </div>
          )}
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-2" aria-label="התקדמות">
          {steps.map((s, i) => {
            const done = s.question ? !!answers[s.question.id]?.recordingCount : false;
            const reachable = canGoBack || i >= index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => reachable && !reviewing && goTo(i)}
                disabled={!reachable || recorder.state === "recording"}
                aria-label={`שאלה ${i + 1}${done ? " – נענתה" : ""}`}
                aria-current={i === index && !reviewing ? "step" : undefined}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", done ? "bg-ok" : i === index && !reviewing ? "bg-brand" : "bg-line", reachable && "cursor-pointer")}
              />
            );
          })}
        </div>
      </header>

      {preview && (
        <div className="border-b border-brand-line bg-brand-soft px-4 py-2 text-center text-[13px] text-brand-strong">
          תצוגה מקדימה כפי שהתלמיד/ה יראה — ההקלטות נשמרות רק בדפדפן ולא נשלחות.
        </div>
      )}
      {!uploads.online && (
        <div className="flex items-center justify-center gap-2 border-b border-[#f1dcb5] bg-warn-soft px-4 py-2 text-[13px] text-warn" role="status">
          <WifiOff className="size-4" /> אין חיבור לאינטרנט. ההקלטות נשמרות במכשיר ויועלו אוטומטית כשהחיבור יחזור.
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-5">
        {timeUp ? (
          <TimeUpScreen busy={uploads.busy} error={submitError} onRetry={() => submit("timeout")} />
        ) : reviewing ? (
          <ReviewScreen
            steps={steps}
            answers={answers}
            uploadStatus={uploads.status}
            onGo={canGoBack ? goTo : undefined}
            onSubmit={() => submit("student")}
            submitting={submitting}
            error={submitError}
            busy={uploads.busy}
            preview={preview}
          />
        ) : step ? (
          <StepView
            key={`${index}:${step.question?.id ?? "choice"}`}
            step={step}
            snapshot={snapshot}
            answer={step.question ? answers[step.question.id] : undefined}
            uploadStatus={step.question ? uploads.status[step.question.id] : undefined}
            progress={progress}
            serverNow={() => Date.now() + clockOffset.current}
            recorder={recorder}
            simulation={simulation}
            preview={preview}
            onChoose={async (qid) => {
              const r = await report({ type: "choose", sectionId: step.section.id, questionId: qid });
              if (!r.ok) return (r.data.error as string) ?? "לא ניתן לבחור";
              setChoices((c) => ({ ...c, [step.section.id]: qid }));
              return null;
            }}
            onPrep={(qid) => void report({ type: "prep", questionId: qid })}
            onPlay={async (mediaKey) => {
              if (preview) return true;
              const r = await report({ type: "play", mediaKey });
              return r.ok;
            }}
            onRecorded={(qid, r) => uploads.enqueue(qid, r)}
            onRetryUpload={() => uploads.retryAll()}
          />
        ) : null}
      </main>

      {!reviewing && !timeUp && step && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0 || !canGoBack || recorder.state === "recording"}>
              <ArrowRight className="size-4" /> הקודם
            </Button>
            <span className="text-sm text-ink-3 tabular" dir="ltr">
              {index + 1} / {steps.length}
            </span>
            {index < steps.length - 1 ? (
              <Button onClick={() => goTo(index + 1)} disabled={recorder.state === "recording" || (!step.question && step.section.choiceMode === "CHOOSE_ONE")}>
                הבא <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setReviewing(true);
                  window.scrollTo({ top: 0 });
                }}
                disabled={recorder.state === "recording"}
              >
                סיום והגשה <ArrowLeft className="size-4" />
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepView(props: {
  step: Step;
  snapshot: ExamSnapshot;
  answer?: SavedAnswer;
  uploadStatus?: UploadStatus;
  progress: Progress;
  serverNow: () => number;
  recorder: ReturnType<typeof useRecorder>;
  simulation: boolean;
  preview: boolean;
  onChoose: (questionId: string) => Promise<string | null>;
  onPrep: (questionId: string) => void;
  onPlay: (mediaKey: string) => Promise<boolean>;
  onRecorded: (questionId: string, r: RecordingResult) => Promise<void>;
  onRetryUpload: () => void;
}) {
  const { step, progress } = props;
  const { section, question } = step;
  const plays = progress.plays ?? {};
  const [chooseError, setChooseError] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-brand" dir="auto" style={{ textAlign: "start" }}>
          {section.title}
        </p>
        {section.instructions && (
          <En className="mt-2 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink-2">{section.instructions}</En>
        )}
      </div>

      {parseVideo(section.videoUrl ?? "") && <VideoEmbed src={parseVideo(section.videoUrl ?? "")!} />}
      {section.mediaId && section.mediaMime && (
        <LimitedMedia
          src={`/api/media/${section.mediaId}`}
          mimeType={section.mediaMime}
          limit={section.maxMediaPlays}
          used={plays[`${section.id}:section`] ?? 0}
          onPlay={() => props.onPlay(`${section.id}:section`)}
          label="קטע הצפייה של החלק"
        />
      )}

      {!question ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">בחרו נושא אחד</h2>
          <p className="text-sm text-ink-2">לאחר שתתחילו להקליט לא ניתן יהיה להחליף נושא.</p>
          <div className="grid gap-3">
            {section.questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={async () => setChooseError(await props.onChoose(q.id))}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-start shadow-[var(--shadow-card)] transition-colors hover:border-brand"
              >
                <En as="p" className="text-xs font-medium text-ink-3">
                  {q.title || `נושא ${i + 1}`}
                </En>
                <En as="p" className="mt-1 text-[17px] font-medium leading-snug">
                  {q.prompt}
                </En>
              </button>
            ))}
          </div>
          {chooseError && <Alert tone="danger">{chooseError}</Alert>}
        </div>
      ) : (
        <QuestionView {...props} question={question} plays={plays} />
      )}
    </div>
  );
}

function QuestionView(props: Parameters<typeof StepView>[0] & { question: SnapshotQuestion; plays: Record<string, number> }) {
  const { question: q, snapshot, plays, step, answer } = props;
  const media = snapshot.media;
  const recorded = (answer?.recordingCount ?? 0) > 0;
  return (
    <div className="space-y-5">
      {q.audioId ? (
        <div className="rounded-[var(--radius-card)] border border-brand-line bg-brand-soft/50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-strong">
            <Volume2 className="size-4" /> האזינו לשאלה
          </p>
          <LimitedMedia
            src={`/api/media/${q.audioId}`}
            mimeType={media[q.audioId]?.mimeType ?? "audio/mpeg"}
            limit={q.maxMediaPlays}
            used={plays[`${q.id}:audio`] ?? 0}
            onPlay={() => props.onPlay(`${q.id}:audio`)}
            label="הקראת השאלה"
            autoPlay={!recorded}
          />
        </div>
      ) : snapshot.settings.deviceVoiceFallback && spokenText(q) ? (
        <DeviceVoiceButton text={spokenText(q)} />
      ) : null}
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        {step.section.choiceMode === "CHOOSE_ONE" && (
          <p className="mb-2 text-xs text-ink-3">
            בחרת: <span dir="auto">{q.title}</span>
          </p>
        )}
        <En as="h2" className="text-[19px] font-semibold leading-snug">
          {q.prompt || q.title}
        </En>
        {q.subQuestions.length > 0 && (
          <ol dir="auto" className="mt-4 list-decimal space-y-2 ps-6 text-start text-[16px] leading-relaxed text-ink">
            {q.subQuestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
        {q.instructions && (
          <En as="p" className="mt-4 text-sm italic text-ink-2">
            {q.instructions}
          </En>
        )}
        {(q.videoId || q.imageId || parseVideo(q.videoUrl ?? "")) && (
          <div className="mt-5 space-y-3">
            {q.imageId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${q.imageId}`} alt="" className="max-h-80 w-full rounded-xl border border-line object-contain" />
            )}
            {parseVideo(q.videoUrl ?? "") && <VideoEmbed src={parseVideo(q.videoUrl ?? "")!} />}
            {q.videoId && (
              <LimitedMedia src={`/api/media/${q.videoId}`} mimeType={media[q.videoId]?.mimeType ?? "video/mp4"} limit={q.maxMediaPlays} used={plays[`${q.id}:video`] ?? 0} onPlay={() => props.onPlay(`${q.id}:video`)} label="סרטון השאלה" />
            )}
          </div>
        )}
      </div>

      <RecordPanel
        question={q}
        recorded={recorded}
        answer={answer}
        uploadStatus={props.uploadStatus}
        recorder={props.recorder}
        simulation={props.simulation}
        allowReview={snapshot.settings.allowReviewOwnRecording}
        prepStartedAt={props.progress.prepStarted?.[q.id]}
        serverNow={props.serverNow}
        onPrep={() => props.onPrep(q.id)}
        onRecorded={(r) => props.onRecorded(q.id, r)}
        onRetryUpload={props.onRetryUpload}
      />
    </div>
  );
}

/** Reads the question with the device's own voice, when the teacher allowed questions without audio. */
function DeviceVoiceButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopDeviceVoice(), []);
  return (
    <div className="rounded-[var(--radius-card)] border border-brand-line bg-brand-soft/50 p-4">
      <Button
        variant="secondary"
        onClick={() => {
          if (speaking) {
            stopDeviceVoice();
            setSpeaking(false);
            return;
          }
          setSpeaking(true);
          speakWithDevice(text, () => setSpeaking(false));
        }}
      >
        {speaking ? <Square className="size-3.5 fill-current" /> : <Volume2 className="size-4" />} {speaking ? "עצירה" : "השמעת השאלה"}
      </Button>
    </div>
  );
}

function RecordPanel(props: {
  question: SnapshotQuestion;
  recorded: boolean;
  answer?: SavedAnswer;
  uploadStatus?: UploadStatus;
  recorder: ReturnType<typeof useRecorder>;
  simulation: boolean;
  allowReview: boolean;
  prepStartedAt?: string;
  serverNow: () => number;
  onPrep: () => void;
  onRecorded: (r: RecordingResult) => Promise<void>;
  onRetryUpload: () => void;
}) {
  const { question: q, recorder, answer, uploadStatus } = props;
  const [warning, setWarning] = useState<string | null>(null);
  const [confirmRe, setConfirmRe] = useState(false);
  const count = answer?.recordingCount ?? 0;
  const left = q.maxRecordings === null ? null : Math.max(0, q.maxRecordings - count);
  const canRecordAgain = q.allowReRecord && (left === null || left > 0);
  const isRecording = recorder.state === "recording";
  const uploading = uploadStatus?.state === "uploading" || uploadStatus?.state === "waiting-network";

  // Preparation time (simulation): starts when the question is shown, persists across reloads.
  const needsPrep = q.prepTimeSec > 0 && !props.recorded && count === 0;
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const prepDone = useRef(false);
  // Auto-start only when the student watched the countdown run out on this screen. If it ran out
  // while they were away (another app, locked phone), wait for their tap: iPhone refuses to open
  // the mic without one, and a recording that starts by surprise is useless anyway.
  const sawPrepRunning = useRef(false);
  useEffect(() => {
    if (prepLeft !== null && prepLeft > 0) sawPrepRunning.current = true;
  }, [prepLeft]);
  useEffect(() => {
    if (!needsPrep) return;
    if (!props.prepStartedAt) props.onPrep();
    const startedAt = props.prepStartedAt ? new Date(props.prepStartedAt).getTime() : props.serverNow();
    const tick = () => setPrepLeft(Math.max(0, q.prepTimeSec - (props.serverNow() - startedAt) / 1000));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPrep, q.id]);

  const finish = useCallback(
    async (r: RecordingResult | null) => {
      if (!r) return;
      if (r.blob.size < 800 || r.durationSec < 1) {
        setWarning("ההקלטה ריקה או קצרה מדי ולא נשמרה. נסו שוב.");
        return;
      }
      setWarning(r.peak < 0.02 ? "כמעט לא נקלט קול בהקלטה. בדקו שהמיקרופון לא מושתק. ההקלטה נשמרה — ניתן להקליט מחדש." : null);
      await props.onRecorded(r);
    },
    [props],
  );

  const start = useCallback(async () => {
    setWarning(null);
    setConfirmRe(false);
    await recorder.start(q.maxRecordSec, (r) => void finish(r));
  }, [recorder, q.maxRecordSec, finish]);

  // In simulation mode recording starts automatically when preparation time ends.
  useEffect(() => {
    if (props.simulation && needsPrep && prepLeft === 0 && sawPrepRunning.current && !prepDone.current && recorder.state !== "recording") {
      prepDone.current = true;
      void start();
    }
  }, [prepLeft, needsPrep, props.simulation, recorder.state, start]);

  const stop = async () => finish(await recorder.stop());

  if (recorder.state === "error" && recorder.error) {
    const t = MIC_ERROR_TEXT[recorder.error];
    return (
      <Alert tone="danger" title={t.title}>
        {t.body}
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => recorder.prepare()}>
            ניסיון חוזר
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <section aria-label="הקלטת תשובה" className={cn("rounded-[var(--radius-card)] border p-5 transition-colors", isRecording ? "border-[#f3c9ca] bg-rec-soft" : "border-line bg-surface shadow-[var(--shadow-card)]")}>
      {isRecording ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-rec" aria-live="polite">
            <span className="rec-pulse size-2.5 rounded-full bg-rec" /> מקליט
          </div>
          <p className="font-mono text-4xl font-semibold tabular text-ink" dir="ltr">
            {formatDuration(recorder.elapsed)}
            <span className="text-lg text-ink-3"> / {formatDuration(q.maxRecordSec)}</span>
          </p>
          <ProgressBar value={recorder.elapsed / q.maxRecordSec} tone="rec" label="זמן הקלטה" />
          <LevelMeter level={recorder.level} bars={24} />
          <Button size="lg" onClick={stop} className="w-full max-w-xs bg-rec hover:bg-[#b82d31]">
            <Square className="size-4 fill-current" /> סיום הקלטה
          </Button>
          <p className="text-xs text-ink-3">ענו על כל השאלות בהקלטה אחת רציפה. ההקלטה תיעצר אוטומטית בתום הזמן.</p>
        </div>
      ) : needsPrep && prepLeft !== null && prepLeft > 0 ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <Hourglass className="size-4" /> זמן הכנה
          </p>
          <p className="font-mono text-4xl font-semibold tabular" dir="ltr">
            {formatDuration(prepLeft)}
          </p>
          <ProgressBar value={1 - prepLeft / q.prepTimeSec} label="זמן הכנה" />
          <p className="text-sm text-ink-3">{props.simulation ? "ההקלטה תתחיל אוטומטית בסיום זמן ההכנה." : "התכוננו לתשובה."}</p>
          <Button size="lg" onClick={start} className="w-full max-w-xs">
            <Mic className="size-4" /> אני מוכן/ה — התחלת הקלטה
          </Button>
        </div>
      ) : count === 0 && !uploadStatus ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-ink-2">
            זמן הקלטה מרבי: <span className="font-medium tabular">{formatDuration(q.maxRecordSec)}</span>
          </p>
          <Button size="lg" onClick={start} disabled={recorder.state === "preparing"} className="w-full max-w-xs">
            {recorder.state === "preparing" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} התחלת הקלטה
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <UploadLine status={uploadStatus} saved={count > 0} onRetry={props.onRetryUpload} />
          {props.allowReview && answer?.localUrl ? (
            <RecordingAudio src={answer.localUrl} className="w-full" aria-label="ההקלטה שלך" />
          ) : props.allowReview && answer?.recordingId ? (
            <RecordingAudio src={`/api/media/${answer.recordingId}`} className="w-full" aria-label="ההקלטה שלך" />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-3">
            <span>
              {answer?.durationSec ? `אורך: ${formatDuration(answer.durationSec)}` : ""}
              {left !== null && q.allowReRecord ? ` · נותרו ${left} הקלטות חוזרות` : ""}
            </span>
            {canRecordAgain && !uploading ? (
              confirmRe ? (
                <span className="flex items-center gap-2">
                  <span className="text-ink-2">ההקלטה הקודמת תוחלף.</span>
                  <Button size="sm" variant="primary" onClick={start}>
                    הקלטה מחדש
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRe(false)}>
                    ביטול
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirmRe(true)}>
                  <RotateCcw className="size-4" /> הקלטה מחדש
                </Button>
              )
            ) : !q.allowReRecord ? (
              <span>לא ניתן להקליט מחדש בשאלה זו</span>
            ) : null}
          </div>
        </div>
      )}
      {warning && (
        <Alert tone="warn" className="mt-4">
          {warning}
        </Alert>
      )}
    </section>
  );
}

function UploadLine({ status, saved, onRetry }: { status?: UploadStatus; saved: boolean; onRetry: () => void }) {
  if (status?.state === "uploading")
    return (
      <div className="space-y-1.5" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <CloudUpload className="size-4 text-brand" /> שומר את ההקלטה…{status.retry ? ` (ניסיון ${status.retry + 1})` : ""}
        </p>
        <ProgressBar value={status.progress} />
      </div>
    );
  if (status?.state === "waiting-network")
    return (
      <p className="flex items-center gap-2 text-sm text-warn" aria-live="polite">
        <WifiOff className="size-4" /> ההקלטה שמורה במכשיר וממתינה לחיבור לאינטרנט
      </p>
    );
  if (status?.state === "failed")
    return (
      <Alert tone="danger" title="ההקלטה לא נשמרה בשרת">
        {status.error}
        {status.retryable && (
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={onRetry}>
              ניסיון חוזר
            </Button>
          </div>
        )}
      </Alert>
    );
  if (saved)
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-ok" aria-live="polite">
        <CheckCircle2 className="size-4" /> התשובה נשמרה
      </p>
    );
  return null;
}

function ReviewScreen(props: {
  steps: Step[];
  answers: Record<string, SavedAnswer>;
  uploadStatus: Record<string, UploadStatus>;
  onGo?: (i: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  busy: boolean;
  preview: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const missing = props.steps.filter((s) => !s.question || !props.answers[s.question.id]?.recordingCount).length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">סיום והגשה</h1>
        <p className="mt-1 text-sm text-ink-2">בדקו שכל התשובות נשמרו. לאחר ההגשה לא ניתן לשנות את ההקלטות.</p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {props.steps.map((s, i) => {
          const a = s.question ? props.answers[s.question.id] : undefined;
          const st = s.question ? props.uploadStatus[s.question.id] : undefined;
          const done = !!a?.recordingCount;
          return (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", done ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
                {done ? <Check className="size-4" /> : <AlertTriangle className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" dir="auto" style={{ textAlign: "start" }}>
                  {s.section.title} · {s.question?.title || s.question?.prompt || "בחירת נושא"}
                </p>
                <p className="text-xs text-ink-3">
                  {st?.state === "uploading" ? "מעלה…" : st?.state === "waiting-network" ? "ממתין לחיבור" : st?.state === "failed" ? "שגיאה בשמירה" : done ? `נשמר · ${formatDuration(a?.durationSec)}` : "לא נענתה"}
                </p>
              </div>
              {props.onGo && (
                <Button size="sm" variant="ghost" onClick={() => props.onGo!(i)}>
                  מעבר
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {missing > 0 && (
        <Alert tone="warn" title={`${missing} שאלות ללא תשובה`}>
          שאלה ללא הקלטה תקבל 0 נקודות.
        </Alert>
      )}
      {props.busy && <Alert tone="info" title="ממתין לסיום שמירת ההקלטות">ההגשה תתאפשר כשכל ההקלטות יישמרו בשרת.</Alert>}
      {props.error && <Alert tone="danger">{props.error}</Alert>}
      {confirm ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <p className="flex-1 text-sm font-medium">להגיש את המבחן? לא ניתן יהיה לשנות תשובות.</p>
          <Button onClick={props.onSubmit} disabled={props.submitting || props.busy}>
            {props.submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} הגשה סופית
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            ביטול
          </Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => setConfirm(true)} disabled={props.busy}>
          <Send className="size-4" /> {props.preview ? "סיום תצוגה מקדימה" : "הגשת המבחן"}
        </Button>
      )}
    </div>
  );
}

function TimeUpScreen({ busy, error, onRetry }: { busy: boolean; error: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Timer className="size-10 text-ink-3" />
      <h1 className="text-xl font-semibold">הזמן הסתיים</h1>
      <p className="max-w-sm text-sm text-ink-2">{busy ? "שומרים את ההקלטות האחרונות ומגישים את המבחן…" : "המבחן מוגש עם התשובות שנשמרו."}</p>
      {busy && <Loader2 className="size-6 animate-spin text-brand" />}
      {error && (
        <>
          <Alert tone="danger">{error}</Alert>
          <Button onClick={onRetry}>ניסיון חוזר</Button>
        </>
      )}
    </div>
  );
}

