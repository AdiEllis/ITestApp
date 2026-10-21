import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, Save, Send } from "lucide-react";
import type { Criterion, QuestionGrade, Submission } from "../lib/types";
import { settings, submissions } from "../lib/store";
import { useStore } from "../lib/use-store";
import { countedQuestions, rubricPercent, round2, totalGrade } from "../lib/scoring";
import { defaultCobeRubric } from "../lib/cobe";
import { feedbackLink } from "../lib/codec";
import { formatDateTime, formatDuration, formatScore } from "../lib/format";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert } from "../ui/alert";
import { Textarea } from "../ui/field";
import { En } from "../ui/en";
import { CopyButton } from "../ui/copy-button";
import { RecordingAudio } from "../ui/recording-audio";
import { cn } from "../ui/cn";

export function Review({ id }: { id: string }) {
  const data = useStore(async () => ({ sub: await submissions.get(id), all: await submissions.list(), rubric: (await settings.rubric()) ?? defaultCobeRubric() }), [id]);
  if (!data) return null;
  if (!data.sub) return <Alert tone="danger" title="ההגשה לא נמצאה" />;
  const sameExam = data.all.filter((s) => s.exam.id === data.sub!.exam.id).sort((a, b) => a.submittedAt - b.submittedAt);
  return <Grader key={data.sub.id} sub={data.sub} rubric={data.rubric} siblings={sameExam} />;
}

function Grader({ sub, rubric, siblings }: { sub: Submission; rubric: Criterion[]; siblings: Submission[] }) {
  const counted = useMemo(() => countedQuestions(sub.exam, sub.choices), [sub]);
  const [draft, setDraft] = useState<Record<string, QuestionGrade>>(() => {
    const d: Record<string, QuestionGrade> = {};
    for (const c of counted) d[c.questionId] = sub.grading?.questions[c.questionId] ?? { criteria: {}, score: null, feedback: "" };
    return d;
  });
  const [overall, setOverall] = useState(sub.grading?.overall ?? "");
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => setMsg(null), [active]);

  const scores = useMemo(() => {
    const o: Record<string, number | null> = {};
    for (const c of counted) {
      const pct = rubricPercent(rubric, draft[c.questionId]?.criteria ?? {});
      o[c.questionId] = pct === null ? null : round2((c.points * pct) / 100);
    }
    return o;
  }, [draft, counted, rubric]);
  const total = totalGrade(sub.exam, sub.choices, scores);
  const update = (qid: string, p: Partial<QuestionGrade>) => {
    setDraft((d) => ({ ...d, [qid]: { ...d[qid], ...p } }));
    setDirty(true);
  };

  async function save(done: boolean) {
    if (done) {
      const missing = counted.filter((c) => sub.answers[c.questionId] && scores[c.questionId] === null);
      if (missing.length) return setMsg({ tone: "danger", text: "יש לתת ציון לכל השאלות שנענו לפני סיום הבדיקה" });
    }
    const questions: Record<string, QuestionGrade> = {};
    for (const c of counted) questions[c.questionId] = { ...draft[c.questionId], score: scores[c.questionId] };
    await submissions.save({ ...sub, grading: { questions, overall, total, status: done ? "done" : "draft", gradedAt: Date.now() } });
    setDirty(false);
    setMsg({ tone: "ok", text: done ? "הבדיקה הושלמה — שלחו לתלמיד/ה את קישור המשוב" : "הטיוטה נשמרה" });
  }

  const link = useMemo(() => {
    if (sub.grading?.status !== "done") return null;
    return feedbackLink({
      v: 1,
      examTitle: sub.exam.title,
      studentName: sub.studentName,
      total: sub.grading.total,
      overall: sub.grading.overall,
      date: sub.grading.gradedAt,
      items: counted.map((c) => {
        const s = sub.exam.sections.find((x) => x.id === c.sectionId)!;
        const q = s.questions.find((x) => x.id === c.questionId);
        const g = sub.grading!.questions[c.questionId];
        return { section: s.title, title: q ? q.title || q.prompt : "—", score: g?.score ?? 0, points: c.points, feedback: g?.feedback ?? "" };
      }),
    });
  }, [sub, counted]);

  const idx = siblings.findIndex((s) => s.id === sub.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const cur = counted[active];
  const section = cur ? sub.exam.sections.find((s) => s.id === cur.sectionId)! : null;
  const q = cur && section ? section.questions.find((x) => x.id === cur.questionId) : undefined;
  const ans = cur ? sub.answers[cur.questionId] : undefined;
  const audioUrl = useMemo(() => (ans ? URL.createObjectURL(ans.data) : null), [ans]);
  useEffect(() => () => void (audioUrl && URL.revokeObjectURL(audioUrl)), [audioUrl]);
  const [rate, setRate] = useState(1);

  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="#/t/inbox" className="text-sm text-ink-2 hover:text-ink">
            → הגשות
          </a>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{sub.studentName}</h1>
          <p className="mt-1 text-sm text-ink-2">
            <span dir="auto">{sub.exam.title}</span>
            {sub.className ? ` · ${sub.className}` : ""} · הוגש {formatDateTime(sub.submittedAt)}
          </p>
          <div className="mt-2">{sub.grading?.status === "done" ? <Badge tone="ok">נבדק</Badge> : sub.grading?.status === "draft" ? <Badge tone="warn">טיוטה</Badge> : <Badge tone="brand">ממתין לבדיקה</Badge>}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-3 tabular" dir="ltr">
            {idx + 1}/{siblings.length}
          </span>
          <a href={prev ? `#/t/review/${encodeURIComponent(prev.id)}` : undefined} aria-disabled={!prev} className={cn("inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 text-sm", !prev && "pointer-events-none opacity-40")}>
            <ChevronRight className="size-4" /> הקודם
          </a>
          <a href={next ? `#/t/review/${encodeURIComponent(next.id)}` : undefined} aria-disabled={!next} className={cn("inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 text-sm", !next && "pointer-events-none opacity-40")}>
            הבא <ChevronLeft className="size-4" />
          </a>
        </div>
      </div>

      {link && !dirty && (
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <MessageSquare className="size-4 text-brand" /> שליחת משוב ל{sub.studentName}
          </h2>
          <p className="text-sm text-ink-2">קישור אישי עם הציון והמשוב. שלחו אותו לתלמיד/ה באותה דרך שבה התקבלה ההגשה.</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={link} label="העתקת קישור משוב" variant="primary" />
            <a className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-subtle" href={`https://wa.me/?text=${encodeURIComponent(`משוב – ${sub.exam.title}\n${link}`)}`} target="_blank" rel="noopener">
              וואטסאפ
            </a>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="שאלות" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {counted.map((c, i) => {
            const s = sub.exam.sections.find((x) => x.id === c.sectionId)!;
            const qq = s.questions.find((x) => x.id === c.questionId);
            const graded = scores[c.questionId] !== null;
            return (
              <button
                key={c.questionId}
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active ? "true" : undefined}
                className={cn("flex min-w-44 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start lg:min-w-0", i === active ? "border-brand bg-surface ring-2 ring-brand/15" : "border-line bg-surface hover:border-line-strong")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", graded ? "bg-ok-soft text-ok" : "bg-subtle text-ink-3")}>{graded ? <CheckCircle2 className="size-3.5" /> : i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span lang="en" dir="ltr" className="block truncate text-start text-sm font-medium">
                    {s.title.replace(/^Part\s+/i, "")} · {qq?.title || `Q${i + 1}`}
                  </span>
                  <span className="block text-xs text-ink-3">{!sub.answers[c.questionId] ? "ללא הקלטה" : graded ? `${formatScore(scores[c.questionId])}/${c.points}` : `${c.points} נק׳`}</span>
                </span>
              </button>
            );
          })}
        </nav>

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
                  {q.subQuestions.filter(Boolean).length > 0 && (
                    <ol lang="en" dir="ltr" className="list-decimal space-y-1 ps-6 text-left text-[15px] text-ink-2">
                      {q.subQuestions.filter(Boolean).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  )}
                </>
              ) : (
                <p className="text-sm text-warn">לא נבחר נושא בחלק זה</p>
              )}
              <div className="rounded-xl bg-subtle p-4">
                {audioUrl ? (
                  <div className="space-y-2">
                    <RecordingAudio key={audioUrl} src={audioUrl} className="w-full" aria-label="הקלטת התלמיד/ה" ref={(el) => void (el && (el.playbackRate = rate))} />
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-ink-3">מהירות:</span>
                      {[1, 1.25, 1.5].map((r) => (
                        <button key={r} type="button" onClick={() => setRate(r)} className={cn("rounded-md px-2 py-0.5 tabular", rate === r ? "bg-surface font-semibold shadow-sm" : "text-ink-2")} dir="ltr">
                          {r}×
                        </button>
                      ))}
                      <span className="ms-auto text-ink-3">
                        {formatDuration(ans?.durationSec)} · {ans?.count === 1 ? "הקלטה אחת" : `${ans?.count} הקלטות (נשמרה האחרונה)`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">לא הוקלטה תשובה (0 נקודות).</p>
                )}
              </div>
            </Card>

            {q && (
              <Card className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold">הערכה</h2>
                  <span className="text-sm text-ink-2">
                    ציון לשאלה: <span className="text-lg font-semibold text-ink tabular">{scores[cur.questionId] === null ? "—" : formatScore(scores[cur.questionId])}</span> / {cur.points}
                  </span>
                </div>
                {rubric.map((c) => {
                  const v = draft[cur.questionId]?.criteria[c.key] ?? null;
                  const band = c.bands.find((b) => v !== null && v >= b.min && v <= b.max);
                  const setV = (n: number | null) => update(cur.questionId, { criteria: { ...draft[cur.questionId].criteria, [c.key]: n } });
                  return (
                    <div key={c.key} className="space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          <span lang="en">{c.label}</span> <span className="text-ink-3">· {c.weight}%</span>
                        </p>
                        <label className="flex items-center gap-2 text-sm">
                          <span className="sr-only">ציון {c.label}</span>
                          <input type="number" min={0} max={100} inputMode="numeric" value={v ?? ""} onChange={(e) => setV(e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))))} className="h-9 w-20 rounded-lg border border-line-strong bg-surface px-2 text-center tabular" />
                          <span className="text-ink-3">/100</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {c.bands.map((b) => (
                          <button
                            key={b.label}
                            type="button"
                            title={b.descriptor}
                            onClick={() => setV(Math.round((b.min + b.max) / 2))}
                            className={cn("rounded-lg border px-2 py-1.5 text-xs", band === b ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-line text-ink-2 hover:border-line-strong")}
                          >
                            {b.label} <span className="tabular text-ink-3">{b.min}–{b.max}</span>
                          </button>
                        ))}
                      </div>
                      {band && <En as="p" className="text-xs leading-relaxed text-ink-3">{band.descriptor}</En>}
                    </div>
                  );
                })}
                <div className="space-y-1.5">
                  <label htmlFor={`fb-${cur.questionId}`} className="text-sm font-medium">
                    משוב לשאלה
                  </label>
                  <Textarea id={`fb-${cur.questionId}`} rows={3} dir="auto" value={draft[cur.questionId]?.feedback ?? ""} onChange={(e) => update(cur.questionId, { feedback: e.target.value })} />
                </div>
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
            <Card className="space-y-3 p-5">
              <label htmlFor="overall" className="text-[15px] font-semibold">
                משוב כללי
              </label>
              <Textarea id="overall" rows={3} dir="auto" value={overall} onChange={(e) => (setOverall(e.target.value), setDirty(true))} />
            </Card>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:start-[248px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="me-auto">
            <p className="text-xs text-ink-3">ציון כולל (מתוך 100)</p>
            <p className="text-xl font-semibold tabular">{formatScore(total)}</p>
          </div>
          {msg && <p className={cn("text-sm", msg.tone === "ok" ? "text-ok" : "text-danger")} role="status">{msg.text}</p>}
          {dirty && !msg && <p className="text-sm text-ink-3">שינויים לא שמורים</p>}
          <Button variant="secondary" onClick={() => save(false)}>
            <Save className="size-4" /> שמירת טיוטה
          </Button>
          <Button onClick={() => save(true)}>
            <Send className="size-4" /> סיום בדיקה
          </Button>
        </div>
      </div>
    </div>
  );
}
