import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Hourglass, Layers, Loader2, Mic, Play, RotateCcw, Send, Share2, Square, Timer, Volume2 } from "lucide-react";
import type { Answer, Exam, Question, Section } from "../lib/types";
import { decodeExamLink, packSubmission, shareOrDownload, submissionFileName, download } from "../lib/codec";
import { get, put, requestPersistence } from "../lib/store";
import { useRecorder, MIC_ERROR_TEXT, type RecordingResult } from "../lib/recorder";
import { parseVideo } from "../lib/video";
import { speak, stopSpeaking, ttsSupported } from "../lib/tts";
import { formatDuration, normalizeName } from "../lib/format";
import { SIMULATION_DISCLAIMER } from "../lib/cobe";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { Card } from "../ui/card";
import { En } from "../ui/en";
import { Field, Input } from "../ui/field";
import { LevelMeter } from "../ui/level-meter";
import { ProgressBar } from "../ui/progress-bar";
import { RecordingAudio } from "../ui/recording-audio";
import { VideoEmbed } from "../ui/video-embed";
import { Logo } from "../ui/logo";
import { MicCheck } from "./MicCheck";
import { cn } from "../ui/cn";

/** Everything a student has done on this device for one exam link. Kept in IndexedDB so a reload or crash loses nothing. */
interface Draft {
  key: string;
  studentName: string;
  className: string;
  startedAt: number;
  deadlineAt: number | null;
  choices: Record<string, string>;
  answers: Record<string, Answer>;
  position: number;
  plays: Record<string, number>;
  prepStarted: Record<string, number>;
  finishedAt: number | null;
  sentAt: number | null;
}

type Step = { section: Section; question: Question | null };

export function TakeExam({ data }: { data: string }) {
  const link = useMemo(() => decodeExamLink(data), [data]);
  if (!link)
    return (
      <Frame>
        <Alert tone="danger" title="הקישור אינו תקין">ייתכן שהקישור נקטע בהעתקה. בקשו מהמורה לשלוח אותו שוב.</Alert>
      </Frame>
    );
  return <TakeExamInner exam={link.exam} className={link.className} teacher={link.teacher} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center px-4 py-4">
        <Logo href="#/" />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16">{children}</main>
    </div>
  );
}

function TakeExamInner({ exam, className, teacher }: { exam: Exam; className: string; teacher: string }) {
  // One draft per exam version on this device.
  const key = `${exam.id}:${exam.updatedAt}`;
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  useEffect(() => {
    get<Draft>("studentDrafts", key).then((d) => setDraft(d ?? null));
  }, [key]);
  const save = useCallback(
    (d: Draft) => {
      setDraft(d);
      void put("studentDrafts", key, d).catch(() => undefined);
    },
    [key],
  );

  if (draft === undefined) return null;
  if (!draft) return <Intro exam={exam} className={className} teacher={teacher} onStart={(name) => {
    void requestPersistence();
    const limit = exam.settings.totalTimeLimitSec;
    save({ key, studentName: name, className, startedAt: Date.now(), deadlineAt: limit ? Date.now() + limit * 1000 : null, choices: {}, answers: {}, position: 0, plays: {}, prepStarted: {}, finishedAt: null, sentAt: null });
  }} />;
  if (draft.finishedAt) return <SendScreen exam={exam} draft={draft} teacher={teacher} onSent={() => save({ ...draft, sentAt: Date.now() })} onRestart={() => save({ ...draft, finishedAt: null })} />;
  return <Runner exam={exam} draft={draft} save={save} />;
}

// ---------------------------------------------------------------------------

function Intro({ exam, className, teacher, onStart }: { exam: Exam; className: string; teacher: string; onStart: (name: string) => void }) {
  const [name, setName] = useState("");
  const [passed, setPassed] = useState(false);
  const [skip, setSkip] = useState(false);
  const simulation = exam.mode === "SIMULATION";
  const ready = normalizeName(name).length >= 2 && (passed || (!simulation && skip));
  return (
    <Frame>
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", simulation ? "border-brand-line bg-brand-soft text-brand-strong" : "border-line bg-subtle text-ink-2")}>{simulation ? "סימולציה" : "תרגול"}</span>
            {className && <span>{className}</span>}
            {teacher && <span>· {teacher}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight" dir="auto">
            {exam.title}
          </h1>
          {exam.description && <p className="mt-2 text-ink-2" dir="auto">{exam.description}</p>}
        </div>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Layers className="size-4 text-ink-3" /> מבנה
          </h2>
          <ol className="space-y-2">
            {exam.sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm">
                <En as="span" className="font-medium">{s.title}</En>
                <span className="text-ink-3">{s.choiceMode === "CHOOSE_ONE" ? `בחירת נושא 1 מתוך ${s.questions.length}` : `${s.questions.length} שאלות`}</span>
              </li>
            ))}
          </ol>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
            {exam.settings.totalTimeLimitSec && (
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-ink-3" /> זמן כולל: {Math.round(exam.settings.totalTimeLimitSec / 60)} דקות מרגע ההתחלה.
              </li>
            )}
            {!exam.settings.allowBackNavigation && <li>• לא ניתן לחזור לשאלות קודמות.</li>}
            {simulation && <li>• בכל שאלה יש זמן הכנה, וההקלטה מתחילה אוטומטית בסיומו.</li>}
            <li>• ענו על כל השאלות בסט בהקלטה אחת רציפה.</li>
            <li>• בסוף תשלחו למורה קובץ אחד עם כל ההקלטות.</li>
          </ul>
        </Card>
        <Card className="space-y-4 p-5">
          <Field label="שם מלא" htmlFor="sname" hint="כפי שהמורה מכיר/ה אותך">
            <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <div>
            <h2 className="mb-3 text-[15px] font-semibold">בדיקת מיקרופון {simulation ? "(חובה)" : ""}</h2>
            {!skip && <MicCheck compact onPassed={() => setPassed(true)} />}
            {!simulation && !passed && !skip && (
              <button type="button" onClick={() => setSkip(true)} className="mt-3 text-sm text-ink-3 hover:underline">
                דילוג — כבר בדקתי את המיקרופון
              </button>
            )}
          </div>
          <Button size="lg" className="w-full" disabled={!ready} onClick={() => onStart(normalizeName(name))}>
            <Play className="size-4" /> התחלה
          </Button>
          {!ready && <p className="text-center text-xs text-ink-3">{normalizeName(name).length < 2 ? "יש להזין שם מלא" : "יש להשלים את בדיקת המיקרופון"}</p>}
        </Card>
        {simulation && <p className="text-xs leading-relaxed text-ink-3">{SIMULATION_DISCLAIMER}</p>}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------

function Runner({ exam, draft, save }: { exam: Exam; draft: Draft; save: (d: Draft) => void }) {
  const simulation = exam.mode === "SIMULATION";
  const canGoBack = exam.settings.allowBackNavigation;
  const recorder = useRecorder();
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const patch = useCallback((p: Partial<Draft>) => save({ ...draftRef.current, ...p }), [save]);

  const steps: Step[] = useMemo(
    () =>
      exam.sections.flatMap((section) =>
        section.choiceMode === "CHOOSE_ONE"
          ? [{ section, question: section.questions.find((q) => q.id === draft.choices[section.id]) ?? null }]
          : section.questions.map((question) => ({ section, question })),
      ),
    [exam, draft.choices],
  );
  const index = Math.min(draft.position, steps.length - 1);
  const [reviewing, setReviewing] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = draft.deadlineAt ? Math.max(0, (draft.deadlineAt - now) / 1000) : null;

  const finish = useCallback(() => {
    recorder.release();
    patch({ finishedAt: Date.now() });
  }, [patch, recorder]);

  const onRecorded = useCallback(
    (qid: string, r: RecordingResult) => {
      const prev = draftRef.current.answers[qid];
      patch({ answers: { ...draftRef.current.answers, [qid]: { mime: r.mimeType, data: r.blob, durationSec: r.durationSec, count: (prev?.count ?? 0) + 1 } } });
    },
    [patch],
  );

  // Time limit: stop the recording (keeping it), then finish.
  const timeUpHandled = useRef(false);
  useEffect(() => {
    if (remaining === null || remaining > 0 || timeUpHandled.current) return;
    timeUpHandled.current = true;
    void (async () => {
      if (recorder.state === "recording") {
        const r = await recorder.stop();
        const step = steps[index];
        if (r && step?.question && r.blob.size > 800) onRecorded(step.question.id, r);
      }
      finish();
    })();
  }, [remaining, recorder, steps, index, onRecorded, finish]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (recorder.state === "recording") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [recorder.state]);

  const goTo = (i: number) => {
    if (recorder.state === "recording") return;
    stopSpeaking();
    setReviewing(false);
    patch({ position: i });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const step = steps[index];
  const answered = steps.filter((s) => s.question && draft.answers[s.question.id]).length;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" dir="auto">
              {exam.title}
            </p>
            <p className="text-xs text-ink-3">
              {draft.studentName} · נענו {answered} מתוך {steps.length}
            </p>
          </div>
          {remaining !== null && (
            <div className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-semibold tabular", remaining < 60 ? "bg-rec-soft text-rec" : remaining < 300 ? "bg-warn-soft text-warn" : "bg-subtle text-ink")} role="timer" aria-label="זמן שנותר" dir="ltr">
              <Timer className="size-4" /> {formatDuration(remaining)}
            </div>
          )}
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-2" aria-label="התקדמות">
          {steps.map((s, i) => {
            const done = !!(s.question && draft.answers[s.question.id]);
            const reachable = canGoBack || i >= index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => reachable && goTo(i)}
                disabled={!reachable || recorder.state === "recording"}
                aria-label={`שאלה ${i + 1}${done ? " – נענתה" : ""}`}
                className={cn("h-1.5 flex-1 rounded-full", done ? "bg-ok" : i === index && !reviewing ? "bg-brand" : "bg-line")}
              />
            );
          })}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-32 pt-5">
        {reviewing ? (
          <Review steps={steps} answers={draft.answers} onGo={canGoBack ? goTo : undefined} onFinish={finish} />
        ) : step ? (
          <StepView
            key={`${index}:${step.question?.id ?? "choice"}`}
            exam={exam}
            step={step}
            draft={draft}
            recorder={recorder}
            simulation={simulation}
            onChoose={(qid) => patch({ choices: { ...draftRef.current.choices, [step.section.id]: qid } })}
            onPrep={(qid) => !draftRef.current.prepStarted[qid] && patch({ prepStarted: { ...draftRef.current.prepStarted, [qid]: Date.now() } })}
            onPlay={(k) => patch({ plays: { ...draftRef.current.plays, [k]: (draftRef.current.plays[k] ?? 0) + 1 } })}
            onRecorded={onRecorded}
          />
        ) : null}
      </main>
      {!reviewing && step && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0 || !canGoBack || recorder.state === "recording"}>
              <ArrowRight className="size-4" /> הקודם
            </Button>
            <span className="text-sm text-ink-3 tabular" dir="ltr">
              {index + 1} / {steps.length}
            </span>
            {index < steps.length - 1 ? (
              <Button onClick={() => goTo(index + 1)} disabled={recorder.state === "recording" || !step.question}>
                הבא <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => setReviewing(true)} disabled={recorder.state === "recording"}>
                סיום <ArrowLeft className="size-4" />
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

function StepView(p: {
  exam: Exam;
  step: Step;
  draft: Draft;
  recorder: ReturnType<typeof useRecorder>;
  simulation: boolean;
  onChoose: (qid: string) => void;
  onPrep: (qid: string) => void;
  onPlay: (key: string) => void;
  onRecorded: (qid: string, r: RecordingResult) => void;
}) {
  const { section, question: q } = p.step;
  const sectionVideo = parseVideo(section.videoUrl);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand" lang="en" dir="ltr" style={{ textAlign: "right" }}>
          {section.title}
        </p>
        {section.instructions && <En className="mt-2 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink-2">{section.instructions}</En>}
      </div>
      {sectionVideo && <VideoEmbed src={sectionVideo} />}
      {!q ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">בחרו נושא אחד</h2>
          <p className="text-sm text-ink-2">לאחר שתתחילו להקליט לא ניתן יהיה להחליף נושא.</p>
          {section.questions.map((x, i) => (
            <button key={x.id} type="button" onClick={() => p.onChoose(x.id)} className="block w-full rounded-[var(--radius-card)] border border-line bg-surface p-4 text-start shadow-[var(--shadow-card)] hover:border-brand">
              <En as="p" className="text-xs font-medium text-ink-3">
                {x.title || `Topic ${i + 1}`}
              </En>
              <En as="p" className="mt-1 text-[17px] font-medium leading-snug">
                {x.prompt}
              </En>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <En as="h2" className="text-[19px] font-semibold leading-snug">
              {q.prompt || q.title}
            </En>
            {q.subQuestions.filter(Boolean).length > 0 && (
              <ol lang="en" dir="ltr" className="mt-4 list-decimal space-y-2 ps-6 text-left text-[16px] leading-relaxed">
                {q.subQuestions.filter(Boolean).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
            {q.instructions && <En as="p" className="mt-4 text-sm italic text-ink-2">{q.instructions}</En>}
            {q.tts && ttsSupported() && <ListenButton q={q} used={p.draft.plays[`${q.id}:tts`] ?? 0} onPlay={() => p.onPlay(`${q.id}:tts`)} />}
            {parseVideo(q.videoUrl) && (
              <div className="mt-4">
                <VideoEmbed src={parseVideo(q.videoUrl)!} />
              </div>
            )}
          </div>
          {/* Changing topic is allowed until something was recorded. */}
          {section.choiceMode === "CHOOSE_ONE" && !p.draft.answers[q.id] && p.recorder.state !== "recording" && (
            <button type="button" onClick={() => p.onChoose("")} className="text-sm text-ink-3 hover:underline">
              החלפת נושא
            </button>
          )}
          <RecordPanel q={q} answer={p.draft.answers[q.id]} recorder={p.recorder} simulation={p.simulation} allowReview={p.exam.settings.allowReviewOwnRecording} prepStartedAt={p.draft.prepStarted[q.id]} onPrep={() => p.onPrep(q.id)} onRecorded={(r) => p.onRecorded(q.id, r)} />
        </>
      )}
    </div>
  );
}

function ListenButton({ q, used, onPlay }: { q: Question; used: number; onPlay: () => void }) {
  const [speaking, setSpeaking] = useState(false);
  const left = q.maxPlays === null ? null : q.maxPlays - used;
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button
        variant="subtle"
        size="sm"
        disabled={speaking || (left !== null && left <= 0)}
        onClick={() => {
          onPlay();
          setSpeaking(true);
          speak([q.prompt, ...q.subQuestions.filter(Boolean)].join(". "), () => setSpeaking(false));
        }}
      >
        <Volume2 className="size-4" /> {speaking ? "משמיע…" : "השמעת השאלה"}
      </Button>
      {left !== null && <span className="text-xs text-ink-3">נותרו {Math.max(0, left)} השמעות</span>}
    </div>
  );
}

function RecordPanel(p: {
  q: Question;
  answer?: Answer;
  recorder: ReturnType<typeof useRecorder>;
  simulation: boolean;
  allowReview: boolean;
  prepStartedAt?: number;
  onPrep: () => void;
  onRecorded: (r: RecordingResult) => void;
}) {
  const { q, recorder, answer } = p;
  const [warning, setWarning] = useState<string | null>(null);
  const [confirmRe, setConfirmRe] = useState(false);
  const count = answer?.count ?? 0;
  const left = q.maxRecordings === null ? null : Math.max(0, q.maxRecordings - count);
  const canAgain = q.allowReRecord && (left === null || left > 0);
  const url = useMemo(() => (answer ? URL.createObjectURL(answer.data) : null), [answer]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const needsPrep = q.prepTimeSec > 0 && count === 0;
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const prepDone = useRef(false);
  useEffect(() => {
    if (!needsPrep) return;
    if (!p.prepStartedAt) p.onPrep();
    const started = p.prepStartedAt ?? Date.now();
    const tick = () => setPrepLeft(Math.max(0, q.prepTimeSec - (Date.now() - started) / 1000));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPrep, q.id]);

  const done = useCallback(
    (r: RecordingResult | null) => {
      if (!r) return;
      if (r.blob.size < 800 || r.durationSec < 1) return setWarning("ההקלטה ריקה או קצרה מדי ולא נשמרה. נסו שוב.");
      setWarning(r.peak < 0.02 ? "כמעט לא נקלט קול. בדקו שהמיקרופון לא מושתק. ההקלטה נשמרה — אפשר להקליט מחדש." : null);
      p.onRecorded(r);
    },
    [p],
  );
  const start = useCallback(async () => {
    setWarning(null);
    setConfirmRe(false);
    stopSpeaking();
    await recorder.start(q.maxRecordSec, (r) => done(r));
  }, [recorder, q.maxRecordSec, done]);
  useEffect(() => {
    if (p.simulation && needsPrep && prepLeft === 0 && !prepDone.current && recorder.state !== "recording") {
      prepDone.current = true;
      void start();
    }
  }, [prepLeft, needsPrep, p.simulation, recorder.state, start]);

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
  const recording = recorder.state === "recording";
  return (
    <section aria-label="הקלטת תשובה" className={cn("rounded-[var(--radius-card)] border p-5", recording ? "border-[#f3c9ca] bg-rec-soft" : "border-line bg-surface shadow-[var(--shadow-card)]")}>
      {recording ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-rec" aria-live="polite">
            <span className="rec-pulse size-2.5 rounded-full bg-rec" /> מקליט
          </div>
          <p className="font-mono text-4xl font-semibold tabular" dir="ltr">
            {formatDuration(recorder.elapsed)}
            <span className="text-lg text-ink-3"> / {formatDuration(q.maxRecordSec)}</span>
          </p>
          <ProgressBar value={recorder.elapsed / q.maxRecordSec} tone="rec" label="זמן הקלטה" />
          <LevelMeter level={recorder.level} bars={24} />
          <Button size="lg" onClick={async () => done(await recorder.stop())} className="w-full max-w-xs bg-rec hover:bg-[#b82d31]">
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
          <p className="text-sm text-ink-3">{p.simulation ? "ההקלטה תתחיל אוטומטית בסיום זמן ההכנה." : "התכוננו לתשובה."}</p>
          <Button size="lg" onClick={start} className="w-full max-w-xs">
            <Mic className="size-4" /> אני מוכן/ה — התחלת הקלטה
          </Button>
        </div>
      ) : count === 0 ? (
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
          <p className="flex items-center gap-2 text-sm font-medium text-ok" aria-live="polite">
            <CheckCircle2 className="size-4" /> התשובה נשמרה במכשיר
          </p>
          {p.allowReview && url && <RecordingAudio src={url} className="w-full" aria-label="ההקלטה שלך" />}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-3">
            <span>
              {answer ? `אורך: ${formatDuration(answer.durationSec)}` : ""}
              {left !== null && q.allowReRecord ? ` · נותרו ${left} הקלטות חוזרות` : ""}
            </span>
            {canAgain ? (
              confirmRe ? (
                <span className="flex items-center gap-2">
                  <span className="text-ink-2">ההקלטה הקודמת תוחלף.</span>
                  <Button size="sm" onClick={start}>
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

function Review({ steps, answers, onGo, onFinish }: { steps: Step[]; answers: Record<string, Answer>; onGo?: (i: number) => void; onFinish: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const missing = steps.filter((s) => !s.question || !answers[s.question.id]).length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">סיום</h1>
        <p className="mt-1 text-sm text-ink-2">בדקו שכל התשובות הוקלטו. אחרי הסיום לא ניתן לשנות את ההקלטות.</p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {steps.map((s, i) => {
          const a = s.question ? answers[s.question.id] : undefined;
          return (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", a ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{a ? <Check className="size-4" /> : <AlertTriangle className="size-3.5" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" lang="en" dir="ltr" style={{ textAlign: "right" }}>
                  {s.section.title} · {s.question?.title || s.question?.prompt || "Choose a topic"}
                </p>
                <p className="text-xs text-ink-3">{a ? `הוקלט · ${formatDuration(a.durationSec)}` : "לא נענתה"}</p>
              </div>
              {onGo && (
                <Button size="sm" variant="ghost" onClick={() => onGo(i)}>
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
      {confirm ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <p className="flex-1 text-sm font-medium">לסיים את המבחן? לא ניתן יהיה לשנות תשובות.</p>
          <Button onClick={onFinish}>
            <Send className="size-4" /> סיום והכנת קובץ למורה
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            ביטול
          </Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => setConfirm(true)}>
          <Send className="size-4" /> סיום המבחן
        </Button>
      )}
    </div>
  );
}

function SendScreen({ exam, draft, teacher, onSent }: { exam: Exam; draft: Draft; teacher: string; onSent: () => void; onRestart: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"shared" | "downloaded" | "cancelled" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const build = () =>
    packSubmission({
      id: `${exam.id}:${normalizeName(draft.studentName).toLowerCase()}:${draft.startedAt}`,
      exam,
      className: draft.className,
      studentName: draft.studentName,
      startedAt: draft.startedAt,
      submittedAt: draft.finishedAt ?? Date.now(),
      choices: draft.choices,
      answers: draft.answers,
    });
  const name = submissionFileName(draft.studentName, exam.title);
  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await shareOrDownload(await build(), name, `הגשה: ${draft.studentName} – ${exam.title}`);
      setResult(r);
      if (r !== "cancelled") onSent();
    } catch {
      setError("לא הצלחנו להכין את הקובץ. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }
  const count = Object.keys(draft.answers).length;
  return (
    <Frame>
      <div className="space-y-6 pt-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="text-2xl font-semibold">סיימת! עכשיו שולחים למורה</h1>
          <p className="max-w-sm text-ink-2">
            {count} הקלטות נשמרו בטלפון. לחצו על הכפתור ובחרו איך לשלוח {teacher ? `ל${teacher}` : "למורה"} — וואטסאפ, מייל, Classroom או Drive.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={send} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} שליחת ההגשה למורה
        </Button>
        {result === "downloaded" && (
          <Alert tone="info" title="הקובץ נשמר בהורדות">
            שלחו את הקובץ <span className="font-medium" dir="auto">"{name}"</span> למורה כקובץ מצורף (בוואטסאפ: 📎 ← מסמך).
          </Alert>
        )}
        {result === "shared" && <Alert tone="ok" title="נשלח">אם לא בחרתם נמען — לחצו שוב על הכפתור.</Alert>}
        {draft.sentAt && result === null && <Alert tone="ok" title="כבר שלחת את ההגשה">אפשר לשלוח שוב אם המורה ביקש/ה.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <button type="button" onClick={async () => download(await build(), name)} className="w-full text-center text-sm text-ink-3 hover:underline">
          הורדת הקובץ למכשיר
        </button>
        <p className="text-center text-xs text-ink-3">ההקלטות נשמרות רק בטלפון שלך ובקובץ שנשלח למורה.</p>
      </div>
    </Frame>
  );
}
