"use client";
import { RecordingAudio } from "@/components/media/recording-audio";
import { HelpButton } from "@/components/help/help-button";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Save, Send, Undo2 } from "lucide-react";
import type { ExamSnapshot } from "@/lib/exam-types";
import { countedQuestions, round2, totalGrade } from "@/lib/scoring";
import { formatDateTime, formatDuration, formatScore } from "@/lib/format";
import { returnAttemptAction, saveGradesAction, unpublishGradesAction } from "../../_actions/assignments";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/field";
import { En } from "@/components/ui/en";
import { cn } from "@/components/ui/cn";

interface AnswerRow {
  questionId: string;
  recordingId: string | null;
  recordingMime: string | null;
  recordingCount: number;
  durationSec: number | null;
  textAnswer: string | null;
  criterionScores: Record<string, number | null> | null;
  score: number | null;
  feedback: string | null;
}

type Draft = Record<string, { score: number | null; feedback: string }>;

export function Grader(props: {
  attempt: {
    id: string;
    status: string;
    gradingStatus: string;
    attemptNumber: number;
    submittedAt: string | null;
    late: boolean;
    overallFeedback: string | null;
    totalScore: number | null;
    choices: Record<string, string>;
    returnNote: string | null;
  };
  student: { name: string; username: string };
  snapshot: ExamSnapshot;
  answers: AnswerRow[];
  prevId: string | null;
  nextId: string | null;
  nextPendingId: string | null;
  position: { index: number; total: number } | null;
  history: { id: string; attemptNumber: number; totalScore: number | null; gradingStatus: string }[];
}) {
  const { snapshot, attempt } = props;
  const router = useRouter();
  const counted = useMemo(() => countedQuestions(snapshot, attempt.choices), [snapshot, attempt.choices]);
  const byQ = useMemo(() => new Map(props.answers.map((a) => [a.questionId, a])), [props.answers]);
  const [draft, setDraft] = useState<Draft>(() => {
    const d: Draft = {};
    for (const c of counted) {
      const a = byQ.get(c.questionId);
      d[c.questionId] = { score: a?.score ?? null, feedback: a?.feedback ?? "" };
    }
    return d;
  });
  const [overall, setOverall] = useState(attempt.overallFeedback ?? "");
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [returning, setReturning] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const readOnly = attempt.status === "RETURNED";

  const scores = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const c of counted) {
      const d = draft[c.questionId];
      if (!d) continue;
      out[c.questionId] = d.score === null ? null : Math.min(c.points, d.score);
    }
    return out;
  }, [draft, counted]);
  const sum = totalGrade(snapshot, attempt.choices, scores);
  // The final grade follows the question scores until the teacher types her own.
  const [finalInput, setFinalInput] = useState<string | null>(() => {
    if (attempt.totalScore === null) return null;
    const initialSum = totalGrade(snapshot, attempt.choices, Object.fromEntries(props.answers.map((a) => [a.questionId, a.score])));
    return round2(attempt.totalScore) === round2(initialSum) ? null : String(attempt.totalScore);
  });
  const finalScore = finalInput === null || finalInput.trim() === "" ? null : Math.min(100, Math.max(0, Number(finalInput) || 0));
  const total = finalScore ?? sum;

  const update = (qid: string, patch: Partial<Draft[string]>) => {
    setDraft((cur) => ({ ...cur, [qid]: { ...cur[qid], ...patch } }));
    setDirty(true);
  };

  function save(publish: boolean) {
    setMessage(null);
    start(async () => {
      const r = await saveGradesAction(attempt.id, {
        overallFeedback: overall,
        publish,
        finalScore,
        answers: Object.entries(draft).map(([questionId, d]) => ({ questionId, criterionScores: null, score: d.score, feedback: d.feedback })),
      });
      if (!r.ok) setMessage({ tone: "danger", text: r.error ?? "השמירה נכשלה" });
      else {
        setDirty(false);
        setMessage({ tone: "ok", text: publish ? "הציון והמשוב פורסמו לתלמיד/ה" : "טיוטת הבדיקה נשמרה" });
        router.refresh();
      }
    });
  }

  const cur = counted[active];
  const section = cur ? snapshot.sections.find((s) => s.id === cur.sectionId)! : null;
  const q = cur && section ? section.questions.find((x) => x.id === cur.questionId) : undefined;
  const ans = cur ? byQ.get(cur.questionId) : undefined;

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{props.student.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            <span dir="auto">{snapshot.title}</span> · ניסיון {attempt.attemptNumber}
            {attempt.submittedAt ? ` · הוגש ${formatDateTime(attempt.submittedAt)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attempt.status === "RETURNED" ? (
              <Badge tone="rec">הוחזר לתלמיד/ה</Badge>
            ) : attempt.gradingStatus === "PUBLISHED" ? (
              <Badge tone="ok">פורסם</Badge>
            ) : attempt.gradingStatus === "DRAFT" ? (
              <Badge tone="warn">טיוטת בדיקה</Badge>
            ) : (
              <Badge tone="warn">ממתין לבדיקה</Badge>
            )}
            {attempt.late && <Badge tone="danger">הוגש באיחור</Badge>}
            {snapshot.mode === "SIMULATION" && <Badge tone="brand">מבחן</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton topic="review" />
          {props.position && <span className="text-sm text-ink-3 tabular" dir="ltr">{props.position.index}/{props.position.total}</span>}
          <LinkButton href={props.prevId ? `/t/review/${props.prevId}` : "#"} variant="secondary" size="sm" aria-disabled={!props.prevId} className={!props.prevId ? "pointer-events-none opacity-40" : ""}>
            <ChevronRight className="size-4" /> הקודם
          </LinkButton>
          <LinkButton href={props.nextId ? `/t/review/${props.nextId}` : "#"} variant="secondary" size="sm" aria-disabled={!props.nextId} className={!props.nextId ? "pointer-events-none opacity-40" : ""}>
            הבא <ChevronLeft className="size-4" />
          </LinkButton>
        </div>
      </div>

      {readOnly && <Alert tone="warn" title="המבחן הוחזר לתלמיד/ה לתרגול נוסף">{attempt.returnNote}</Alert>}
      {props.history.length > 0 && (
        <p className="text-sm text-ink-3">
          ניסיונות נוספים:{" "}
          {props.history.map((h, i) => (
            <span key={h.id}>
              {i > 0 && ", "}
              <Link href={`/t/review/${h.id}`} className="text-brand hover:underline">
                ניסיון {h.attemptNumber}
                {h.gradingStatus === "PUBLISHED" ? ` (${formatScore(h.totalScore)})` : ""}
              </Link>
            </span>
          ))}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Question navigation */}
        <nav aria-label="שאלות" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {counted.map((c, i) => {
            const s = snapshot.sections.find((x) => x.id === c.sectionId)!;
            const qq = s.questions.find((x) => x.id === c.questionId);
            const graded = scores[c.questionId] !== null && scores[c.questionId] !== undefined;
            const a = byQ.get(c.questionId);
            const has = !!a?.recordingId || !!a?.textAnswer;
            return (
              <button
                key={c.questionId}
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "flex min-w-44 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors lg:min-w-0",
                  i === active ? "border-brand bg-surface ring-2 ring-brand/15" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", graded ? "bg-ok-soft text-ok" : "bg-subtle text-ink-3")}>
                  {graded ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate text-start text-sm font-medium">
                    {s.title.replace(/^Part\s+/i, "")} · {qq?.title || `Q${i + 1}`}
                  </span>
                  <span className="block text-xs text-ink-3">
                    {!has ? "לא נענתה" : graded ? `${formatScore(scores[c.questionId])}/${c.points}` : `${c.points} נק׳`}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active question */}
        {cur && section && (
          <div className="min-w-0 space-y-4">
            <Card className="space-y-4 p-5">
              <En as="p" className="text-xs font-medium uppercase tracking-wide text-brand">
                {section.title}
              </En>
              {q ? (
                <>
                  <En as="p" className="text-[17px] font-semibold leading-snug">
                    {q.prompt || q.title}
                  </En>
                  {q.subQuestions.length > 0 && (
                    <ol dir="auto" className="list-decimal space-y-1 ps-6 text-start text-[15px] text-ink-2">
                      {q.subQuestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  )}
                </>
              ) : (
                <p className="text-sm text-warn">התלמיד/ה לא בחר/ה נושא בחלק זה</p>
              )}
              <div className="space-y-3 rounded-xl bg-subtle p-4">
                {ans?.textAnswer && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-3">תשובה בהקלדה</p>
                    <p className="whitespace-pre-wrap rounded-lg bg-surface px-3 py-2 text-[15px] leading-relaxed" dir="auto">
                      {ans.textAnswer}
                    </p>
                  </div>
                )}
                {ans?.recordingId ? (
                  <RecordingPlayer key={ans.recordingId} src={`/api/media/${ans.recordingId}`} />
                ) : !ans?.textAnswer ? (
                  <p className="text-sm text-ink-2">אין תשובה לשאלה זו (0 נקודות).</p>
                ) : null}
                {ans?.recordingId && (
                  <p className="mt-2 text-xs text-ink-3">
                    אורך {formatDuration(ans.durationSec)} · {ans.recordingCount} {ans.recordingCount === 1 ? "הקלטה" : "הקלטות (נשמרה האחרונה)"}
                  </p>
                )}
              </div>
            </Card>

            {q && (
              <Card className="space-y-5 p-5">
                <fieldset disabled={readOnly} className="space-y-4">
                  <label className="flex items-center gap-2 text-[15px] font-semibold">
                    ציון לשאלה
                    <input
                      type="number"
                      min={0}
                      max={cur.points}
                      inputMode="decimal"
                      value={draft[cur.questionId]?.score ?? ""}
                      onChange={(e) => update(cur.questionId, { score: e.target.value === "" ? null : Math.min(cur.points, Math.max(0, Number(e.target.value))) })}
                      className="h-10 w-24 rounded-lg border border-line-strong bg-surface px-2 text-center text-base font-normal tabular"
                    />
                    <span className="font-normal text-ink-3">מתוך {cur.points}</span>
                  </label>
                  <div className="space-y-1.5">
                    <label htmlFor={`fb-${cur.questionId}`} className="text-sm font-medium">
                      הערה לשאלה (לא חובה)
                    </label>
                    <Textarea id={`fb-${cur.questionId}`} rows={2} dir="auto" value={draft[cur.questionId]?.feedback ?? ""} onChange={(e) => update(cur.questionId, { feedback: e.target.value })} />
                  </div>
                </fieldset>
                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setActive((a) => Math.max(0, a - 1))} disabled={active === 0}>
                    <ChevronRight className="size-4" /> שאלה קודמת
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActive((a) => Math.min(counted.length - 1, a + 1))} disabled={active === counted.length - 1}>
                    שאלה הבאה <ChevronLeft className="size-4" />
                  </Button>
                </div>
              </Card>
            )}

            <Card className="space-y-4 p-5">
              <h2 className="text-[15px] font-semibold">ציון סופי</h2>
              <fieldset disabled={readOnly} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label htmlFor="final" className="sr-only">
                    ציון סופי
                  </label>
                  <input
                    id="final"
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={finalInput ?? formatScore(sum)}
                    onChange={(e) => (setFinalInput(e.target.value), setDirty(true))}
                    className="h-11 w-28 rounded-lg border border-line-strong bg-surface px-2 text-center text-lg font-semibold tabular"
                  />
                  <span className="text-ink-3">מתוך 100</span>
                  {finalInput !== null ? (
                    <button type="button" onClick={() => (setFinalInput(null), setDirty(true))} className="text-brand hover:underline">
                      חזרה לסכום השאלות ({formatScore(sum)})
                    </button>
                  ) : (
                    <span className="text-ink-3">· סכום הציונים בשאלות. אפשר לשנות.</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="overall" className="text-sm font-medium">
                    הערה כללית (לא חובה)
                  </label>
                  <Textarea id="overall" rows={3} dir="auto" value={overall} onChange={(e) => (setOverall(e.target.value), setDirty(true))} />
                </div>
              </fieldset>
            </Card>

            {!readOnly && attempt.status === "SUBMITTED" && (
              <Card className="space-y-3 p-5">
                {returning ? (
                  <>
                    <label htmlFor="rn" className="text-sm font-medium">
                      הודעה לתלמיד/ה (לא חובה)
                    </label>
                    <Textarea id="rn" rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="לדוגמה: הרחב/י את התשובה בחלק B ונסה/י שוב." />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          start(async () => {
                            const r = await returnAttemptAction(attempt.id, returnNote);
                            if (!r.ok) setMessage({ tone: "danger", text: r.error ?? "שגיאה" });
                            else router.refresh();
                          })
                        }
                      >
                        החזרה לתלמיד/ה
                      </Button>
                      <Button variant="ghost" onClick={() => setReturning(false)}>
                        ביטול
                      </Button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => setReturning(true)} className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
                    <Undo2 className="size-4" /> החזרת המבחן לתלמיד/ה לתרגול נוסף
                  </button>
                )}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:start-[248px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <div className="me-auto">
              <p className="text-xs text-ink-3">ציון סופי (מתוך 100)</p>
              <p className="text-xl font-semibold tabular">{formatScore(total)}</p>
            </div>
            {message && <p className={cn("text-sm", message.tone === "ok" ? "text-ok" : "text-danger")} role="status">{message.text}</p>}
            {dirty && !message && <p className="text-sm text-ink-3">שינויים לא שמורים</p>}
            {attempt.gradingStatus === "PUBLISHED" && (
              <Button variant="ghost" size="sm" onClick={() => start(async () => { await unpublishGradesAction(attempt.id); router.refresh(); })} disabled={pending}>
                ביטול פרסום
              </Button>
            )}
            <Button variant="secondary" onClick={() => save(false)} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} שמירת טיוטה
            </Button>
            <Button onClick={() => save(true)} disabled={pending}>
              <Send className="size-4" /> {attempt.gradingStatus === "PUBLISHED" ? "עדכון הפרסום" : "פרסום לתלמיד/ה"}
            </Button>
            {props.nextPendingId && !dirty && (
              <LinkButton href={`/t/review/${props.nextPendingId}`} variant="subtle">
                להגשה הבאה <ChevronLeft className="size-4" />
              </LinkButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Audio player with playback speed control for faster reviewing. */
function RecordingPlayer({ src }: { src: string }) {
  const [rate, setRate] = useState(1);
  return (
    <div className="space-y-2">
      <RecordingAudio
        src={src}
        className="w-full"
        aria-label="הקלטת התלמיד/ה"
        ref={(el) => {
          if (el) el.playbackRate = rate;
        }}
      />
      <div className="flex items-center gap-1 text-xs">
        <span className="text-ink-3">מהירות:</span>
        {[1, 1.25, 1.5].map((r) => (
          <button key={r} type="button" onClick={() => setRate(r)} className={cn("rounded-md px-2 py-0.5 tabular", rate === r ? "bg-surface font-semibold shadow-sm" : "text-ink-2")} dir="ltr">
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}
