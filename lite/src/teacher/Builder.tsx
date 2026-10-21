import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, ExternalLink, Layers, Lightbulb, Link2, Plus, Send, Trash2, Volume2, X } from "lucide-react";
import type { Exam, Question, Section } from "../lib/types";
import { KIND_LABELS, LEVEL_LABELS } from "../lib/types";
import { exams, settings, submissions } from "../lib/store";
import { useStore } from "../lib/use-store";
import { newQuestion, COBE_DEFAULTS } from "../lib/cobe";
import { examLink } from "../lib/codec";
import { parseVideo } from "../lib/video";
import { VIDEO_SOURCES } from "../lib/video-sources";
import { speak } from "../lib/tts";
import { uid } from "../lib/id";
import { go } from "../lib/router";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert } from "../ui/alert";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/field";
import { CopyButton } from "../ui/copy-button";
import { VideoEmbed } from "../ui/video-embed";
import { cn } from "../ui/cn";

const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v))));
function move<T>(arr: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function problemsOf(e: Exam): string[] {
  const p: string[] = [];
  if (!e.title.trim()) p.push("חסר שם למבחן");
  if (e.sections.length === 0) p.push("המבחן חייב לכלול לפחות חלק אחד");
  e.sections.forEach((s, i) => {
    const name = s.title || `חלק ${i + 1}`;
    if (s.questions.length === 0) p.push(`ב${name} אין שאלות`);
    if (s.choiceMode === "CHOOSE_ONE" && s.questions.length < 2) p.push(`ב${name} מוגדרת בחירת נושא אך יש פחות משתי אפשרויות`);
    if (s.videoUrl && !parseVideo(s.videoUrl)) p.push(`קישור הסרטון ב${name} אינו נתמך (YouTube, Vimeo, Google Drive או קובץ mp4)`);
    if (s.kind === "AUDIO_VISUAL" && !s.videoUrl && !s.questions.some((q) => q.videoUrl)) p.push(`ב${name} (Audio-Visual) יש להוסיף קישור לסרטון`);
    s.questions.forEach((q, j) => {
      if (!q.prompt.trim() && q.subQuestions.length === 0) p.push(`שאלה ${j + 1} ב${name} ריקה`);
      if (q.videoUrl && !parseVideo(q.videoUrl)) p.push(`קישור הסרטון בשאלה ${j + 1} ב${name} אינו נתמך`);
    });
  });
  return p;
}

export function Builder({ id }: { id: string }) {
  const loaded = useStore(() => exams.get(id), [id]);
  const subCount = useStore(async () => (await submissions.list()).filter((s) => s.exam.id === id).length, [id]) ?? 0;
  const [exam, setExam] = useState<Exam | null>(null);
  const [saved, setSaved] = useState(true);
  const first = useRef(true);

  useEffect(() => {
    if (loaded && first.current) {
      setExam(loaded);
      first.current = false;
    }
  }, [loaded]);

  // Autosave to the browser 600ms after the last change.
  useEffect(() => {
    if (!exam || saved) return;
    const t = setTimeout(() => exams.save(exam).then(() => setSaved(true)), 600);
    return () => clearTimeout(t);
  }, [exam, saved]);

  const update = (fn: (e: Exam) => Exam) => {
    setExam((e) => (e ? fn(e) : e));
    setSaved(false);
  };
  const problems = useMemo(() => (exam ? problemsOf(exam) : []), [exam]);

  if (loaded === undefined && first.current) return <p className="text-ink-3">טוען…</p>;
  if (!exam) return <Alert tone="danger" title="המבחן לא נמצא בדפדפן הזה" />;
  const simulation = exam.mode === "SIMULATION";

  const setSection = (si: number, patch: Partial<Section>) => update((e) => ({ ...e, sections: e.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const setQuestion = (si: number, qi: number, patch: Partial<Question>) =>
    update((e) => ({ ...e, sections: e.sections.map((s, i) => (i === si ? { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) } : s)) }));
  const totalPoints = exam.sections.reduce((sum, s) => sum + (s.choiceMode === "CHOOSE_ONE" ? (s.questions[0]?.points ?? 0) : s.questions.reduce((a, q) => a + q.points, 0)), 0);

  return (
    <div className="pb-16">
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <a href="#/t/exams" className="text-sm text-ink-3 hover:text-ink">
              מבחנים
            </a>
            <span className="text-ink-3">/</span>
            <span className="truncate font-medium" dir="auto">
              {exam.title || "ללא שם"}
            </span>
            <Badge tone={simulation ? "brand" : "neutral"}>{simulation ? "סימולציה" : "תרגול"}</Badge>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 text-sm", saved ? "text-ok" : "text-ink-3")} aria-live="polite">
            {saved ? (
              <>
                <Check className="size-3.5" /> נשמר
              </>
            ) : (
              "שומר…"
            )}
          </span>
          <a href="#share" className="inline-flex h-8 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong">
            <Send className="size-4" /> שליחה לתלמידים
          </a>
        </div>
      </div>

      {subCount > 0 && (
        <Alert tone="info" className="mb-4">
          התקבלו כבר {subCount} הגשות למבחן הזה. שינויים כאן לא משפיעים עליהן (כל הגשה שומרת את גרסת המבחן שלה), וגם לא על קישורים שכבר נשלחו — אחרי שינוי שלחו קישור חדש.
        </Alert>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-4 p-5">
            <Field label="שם המבחן" htmlFor="title">
              <Input id="title" value={exam.title} onChange={(e) => update((x) => ({ ...x, title: e.target.value }))} className="h-11 text-base font-medium" />
            </Field>
            <Field label="תיאור (לא חובה)" htmlFor="desc" hint="מוצג לתלמידים לפני ההתחלה">
              <Textarea id="desc" rows={2} value={exam.description} onChange={(e) => update((x) => ({ ...x, description: e.target.value }))} />
            </Field>
          </Card>

          {exam.sections.map((s, si) => (
            <SectionCard
              key={s.id}
              s={s}
              index={si}
              count={exam.sections.length}
              simulation={simulation}
              onChange={(p) => setSection(si, p)}
              onQuestion={(qi, p) => setQuestion(si, qi, p)}
              onMove={(d) => update((e) => ({ ...e, sections: move(e.sections, si, d) }))}
              onRemove={() => update((e) => ({ ...e, sections: e.sections.filter((_, i) => i !== si) }))}
              onAddQuestion={() => setSection(si, { questions: [...s.questions, newQuestion(simulation)] })}
              onMoveQuestion={(qi, d) => setSection(si, { questions: move(s.questions, qi, d) })}
              onRemoveQuestion={(qi) => setSection(si, { questions: s.questions.filter((_, j) => j !== qi) })}
              onDuplicateQuestion={(qi) => setSection(si, { questions: [...s.questions.slice(0, qi + 1), { ...s.questions[qi], id: uid() }, ...s.questions.slice(qi + 1)] })}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              update((e) => ({
                ...e,
                sections: [...e.sections, { id: uid(), title: `Part ${e.sections.length + 1}`, instructions: "", kind: "GENERAL", choiceMode: "ALL", videoUrl: "", questions: [newQuestion(simulation)] }],
              }))
            }
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/50 py-5 text-sm font-medium text-ink-2 hover:border-brand hover:text-brand"
          >
            <Layers className="size-4" /> הוספת חלק
          </button>
        </div>

        <div className="space-y-6">
          <SharePanel exam={exam} problems={problems} />
          <Card className="space-y-4 p-5">
            <h2 className="text-[15px] font-semibold">הגדרות מבחן</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="רמה" htmlFor="level">
                <Select id="level" value={exam.level} onChange={(e) => update((x) => ({ ...x, level: e.target.value as Exam["level"] }))}>
                  {Object.entries(LEVEL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="מצב" htmlFor="mode">
                <Select
                  id="mode"
                  value={exam.mode}
                  onChange={(e) => {
                    const mode = e.target.value as Exam["mode"];
                    update((x) => ({
                      ...x,
                      mode,
                      settings:
                        mode === "SIMULATION"
                          ? { ...x.settings, totalTimeLimitSec: x.settings.totalTimeLimitSec ?? COBE_DEFAULTS.totalTimeLimitSec, allowBackNavigation: false }
                          : { ...x.settings, totalTimeLimitSec: null, allowBackNavigation: true },
                    }));
                  }}
                >
                  <option value="PRACTICE">תרגול</option>
                  <option value="SIMULATION">סימולציה</option>
                </Select>
              </Field>
            </div>
            <Field label="מגבלת זמן כוללת (דקות)" htmlFor="limit" hint="ריק = ללא מגבלה">
              <Input
                id="limit"
                type="number"
                min={1}
                max={240}
                value={exam.settings.totalTimeLimitSec ? Math.round(exam.settings.totalTimeLimitSec / 60) : ""}
                onChange={(e) => {
                  const m = numOrNull(e.target.value);
                  update((x) => ({ ...x, settings: { ...x.settings, totalTimeLimitSec: m ? Math.min(240, Math.max(1, m)) * 60 : null } }));
                }}
              />
            </Field>
            <Checkbox checked={exam.settings.allowBackNavigation} onChange={(e) => update((x) => ({ ...x, settings: { ...x.settings, allowBackNavigation: e.target.checked } }))} label="מותר לחזור לשאלות קודמות" />
            <Checkbox
              checked={exam.settings.allowReviewOwnRecording}
              onChange={(e) => update((x) => ({ ...x, settings: { ...x.settings, allowReviewOwnRecording: e.target.checked } }))}
              label="התלמיד/ה יכול/ה להאזין להקלטה לפני השליחה"
            />
            <div className="rounded-lg bg-subtle px-3 py-2 text-sm text-ink-2">
              סה״כ ניקוד: <span className="font-semibold tabular text-ink">{totalPoints}</span> · הציון מנורמל ל־100
            </div>
          </Card>
          <Card className="space-y-2 p-5">
            <h2 className="text-[15px] font-semibold">פעולות</h2>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={async () => {
                const copy: Exam = { ...structuredClone(exam), id: uid(), title: `${exam.title} (עותק)`, createdAt: Date.now() };
                await exams.save(copy);
                go(`/t/exams/${copy.id}`);
              }}
            >
              <Copy className="size-4" /> שכפול מבחן
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="w-full justify-start"
              onClick={async () => {
                if (!confirm("למחוק את המבחן? הגשות שכבר התקבלו יישמרו.")) return;
                await exams.remove(exam.id);
                go("/t/exams");
              }}
            >
              <Trash2 className="size-4" /> מחיקת מבחן
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SharePanel({ exam, problems }: { exam: Exam; problems: string[] }) {
  const prefs = useStore(async () => ({ classes: await settings.classes(), teacher: await settings.teacherName() }));
  const [className, setClassName] = useState("");
  const [teacher, setTeacher] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const t = teacher ?? prefs?.teacher ?? "";
  async function create() {
    const c = className.trim();
    if (c && prefs && !prefs.classes.includes(c)) await settings.setClasses([...prefs.classes, c]);
    if (t !== prefs?.teacher) await settings.setTeacherName(t.trim());
    setLink(examLink(exam, c, t.trim()));
  }
  useEffect(() => setLink(null), [exam]);
  return (
    <Card className="space-y-4 p-5" id="share">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Link2 className="size-4 text-brand" /> שליחה לתלמידים
      </h2>
      {problems.length > 0 ? (
        <Alert tone="warn" title="לפני שליחה יש לתקן:">
          <ul className="list-disc space-y-0.5 ps-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <>
          <Field label="כיתה" htmlFor="cls" hint="יופיע בהגשות — כך יהיה קל לסנן">
            <Input id="cls" list="classes" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="לדוגמה: י״א 3" />
            <datalist id="classes">{prefs?.classes.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="שם המורה (לא חובה)" htmlFor="teacher">
            <Input id="teacher" value={t} onChange={(e) => setTeacher(e.target.value)} />
          </Field>
          <Button onClick={create} className="w-full">
            <Link2 className="size-4" /> יצירת קישור
          </Button>
          {link && (
            <div className="space-y-2 rounded-lg border border-line bg-subtle p-3">
              <p className="break-all text-xs text-ink-3" dir="ltr">
                {link.slice(0, 90)}…
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={link} label="העתקת קישור" variant="primary" />
                <a
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-subtle"
                  href={`https://wa.me/?text=${encodeURIComponent(`${exam.title}\n${link}`)}`}
                  target="_blank"
                  rel="noopener"
                >
                  וואטסאפ
                </a>
                <a className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm text-ink-2 hover:bg-surface" href={link} target="_blank" rel="noopener">
                  <ExternalLink className="size-4" /> פתיחה כתלמיד
                </a>
              </div>
              <p className="text-xs leading-relaxed text-ink-3">התלמידים פותחים את הקישור, מקליטים, ובסוף שולחים לך קובץ הגשה (בוואטסאפ, במייל וכו׳). את הקבצים מייבאים בעמוד "הגשות ובדיקה".</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function IconBtn({ label, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" title={label} aria-label={label} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-subtle hover:text-ink disabled:opacity-30" {...p}>
      {children}
    </button>
  );
}

function VideoField({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label: string }) {
  const parsed = parseVideo(value);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Lightbulb className="size-4" /> הצעת סרטון
      </Button>
      {open && (
        <div className="space-y-2 rounded-lg border border-line bg-surface p-3 text-sm">
          <p className="text-ink-2">בחרו קטע באחד המאגרים, העתיקו את קישור ה־YouTube שלו והדביקו כאן.</p>
          <ul className="space-y-2">
            {VIDEO_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  {s.name} <ExternalLink className="size-3.5" />
                </a>
                <span className={`ms-2 rounded px-1.5 py-0.5 text-[11px] ${s.official ? "bg-ok-soft text-ok" : "bg-subtle text-ink-3"}`}>{s.official ? "רשמי" : "אתר מורים – לא רשמי"}</span>
                <p className="text-xs text-ink-3">{s.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field label={label} htmlFor={id} hint={value && !parsed ? "קישור לא נתמך. השתמשו בקישור YouTube, Vimeo, Google Drive (משותף לכל מי שיש לו קישור) או קובץ mp4." : "YouTube / Vimeo / Google Drive / mp4"}>
        <Input id={id} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
      </Field>
      {parsed && <VideoEmbed src={parsed} className="max-w-md" />}
    </div>
  );
}

function SectionCard(p: {
  s: Section;
  index: number;
  count: number;
  simulation: boolean;
  onChange: (p: Partial<Section>) => void;
  onQuestion: (qi: number, p: Partial<Question>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onMoveQuestion: (qi: number, d: -1 | 1) => void;
  onRemoveQuestion: (qi: number) => void;
  onDuplicateQuestion: (qi: number) => void;
}) {
  const { s } = p;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-subtle/60 px-5 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-ink text-xs font-semibold text-white tabular">{p.index + 1}</span>
        <Input aria-label="שם החלק" value={s.title} onChange={(e) => p.onChange({ title: e.target.value })} dir="auto" className="h-9 max-w-sm flex-1 bg-surface font-medium" />
        <div className="ms-auto flex items-center gap-1">
          <IconBtn label="הזזה למעלה" onClick={() => p.onMove(-1)} disabled={p.index === 0}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="הזזה למטה" onClick={() => p.onMove(1)} disabled={p.index === p.count - 1}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn label="מחיקת חלק" onClick={() => confirm(`למחוק את "${s.title}"?`) && p.onRemove()}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="סוג החלק" htmlFor={`k-${s.id}`}>
            <Select id={`k-${s.id}`} value={s.kind} onChange={(e) => p.onChange({ kind: e.target.value as Section["kind"] })}>
              {Object.entries(KIND_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="מענה" htmlFor={`c-${s.id}`}>
            <Select id={`c-${s.id}`} value={s.choiceMode} onChange={(e) => p.onChange({ choiceMode: e.target.value as Section["choiceMode"] })}>
              <option value="ALL">עונים על כל השאלות</option>
              <option value="CHOOSE_ONE">בחירת נושא אחד</option>
            </Select>
          </Field>
        </div>
        <Field label="הוראות לחלק (באנגלית)" htmlFor={`i-${s.id}`}>
          <Textarea id={`i-${s.id}`} lang="en" dir="ltr" rows={2} value={s.instructions} onChange={(e) => p.onChange({ instructions: e.target.value })} />
        </Field>
        {(s.kind === "AUDIO_VISUAL" || s.videoUrl) && (
          <div className="rounded-xl border border-line bg-subtle/40 p-4">
            <VideoField id={`v-${s.id}`} label="סרטון משותף לחלק" value={s.videoUrl} onChange={(v) => p.onChange({ videoUrl: v })} />
          </div>
        )}
        <div className="space-y-3">
          {s.questions.map((q, qi) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={qi}
              count={s.questions.length}
              choose={s.choiceMode === "CHOOSE_ONE"}
              onChange={(patch) => p.onQuestion(qi, patch)}
              onMove={(d) => p.onMoveQuestion(qi, d)}
              onRemove={() => p.onRemoveQuestion(qi)}
              onDuplicate={() => p.onDuplicateQuestion(qi)}
            />
          ))}
          <Button variant="subtle" size="sm" onClick={p.onAddQuestion}>
            <Plus className="size-4" /> {s.choiceMode === "CHOOSE_ONE" ? "הוספת נושא" : "הוספת שאלה"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function QuestionCard(p: { q: Question; index: number; count: number; choose: boolean; onChange: (p: Partial<Question>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; onDuplicate: () => void }) {
  const { q } = p;
  const [open, setOpen] = useState(!q.prompt);
  const label = q.title || (p.choose ? `Topic ${p.index + 1}` : `Question ${p.index + 1}`);
  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-start" aria-expanded={open}>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", !open && "rotate-90")} />
          <span lang="en" dir="ltr" className="max-w-[45%] shrink-0 truncate text-sm font-medium">
            {label}
          </span>
          {!open && q.prompt && (
            <span lang="en" dir="ltr" className="hidden truncate text-sm text-ink-3 sm:inline">
              — {q.prompt}
            </span>
          )}
        </button>
        <span className="hidden shrink-0 text-xs text-ink-3 tabular sm:inline">
          {q.points} נק׳ · {q.maxRecordSec} שנ׳
        </span>
        <IconBtn label="הזזה למעלה" onClick={() => p.onMove(-1)} disabled={p.index === 0}>
          <ArrowUp className="size-4" />
        </IconBtn>
        <IconBtn label="הזזה למטה" onClick={() => p.onMove(1)} disabled={p.index === p.count - 1}>
          <ArrowDown className="size-4" />
        </IconBtn>
        <IconBtn label="שכפול שאלה" onClick={p.onDuplicate}>
          <Copy className="size-4" />
        </IconBtn>
        <IconBtn label="מחיקת שאלה" onClick={() => confirm("למחוק את השאלה?") && p.onRemove()}>
          <Trash2 className="size-4" />
        </IconBtn>
      </div>
      {open && (
        <div className="space-y-4 border-t border-line p-4">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Field label="כותרת" htmlFor={`t-${q.id}`}>
              <Input id={`t-${q.id}`} lang="en" dir="ltr" value={q.title} placeholder={label} onChange={(e) => p.onChange({ title: e.target.value })} />
            </Field>
            <Field label="השאלה / הפתיח (באנגלית)" htmlFor={`p-${q.id}`}>
              <Textarea id={`p-${q.id}`} lang="en" dir="ltr" rows={2} value={q.prompt} onChange={(e) => p.onChange({ prompt: e.target.value })} placeholder="Let's talk about…" />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">שאלות בסט (נענות בהקלטה אחת)</p>
            {q.subQuestions.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-ink-3 tabular">{i + 1}</span>
                <Input lang="en" dir="ltr" value={t} aria-label={`שאלה ${i + 1}`} onChange={(e) => p.onChange({ subQuestions: q.subQuestions.map((x, j) => (j === i ? e.target.value : x)) })} />
                <IconBtn label="מחיקה" onClick={() => p.onChange({ subQuestions: q.subQuestions.filter((_, j) => j !== i) })}>
                  <X className="size-4" />
                </IconBtn>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => p.onChange({ subQuestions: [...q.subQuestions, ""] })}>
              <Plus className="size-4" /> הוספת שאלה לסט
            </Button>
          </div>
          <Field label="הנחיה נוספת (לא חובה)" htmlFor={`n-${q.id}`}>
            <Input id={`n-${q.id}`} lang="en" dir="ltr" value={q.instructions} onChange={(e) => p.onChange({ instructions: e.target.value })} placeholder="Answer all the questions in one recording." />
          </Field>
          <div className="grid gap-4 rounded-xl bg-subtle/50 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Checkbox checked={q.tts} onChange={(e) => p.onChange({ tts: e.target.checked })} label="התלמידים יכולים לשמוע את השאלה" hint="הקראה בקול באנגלית על ידי המכשיר" />
              <Button variant="ghost" size="sm" onClick={() => speak([q.prompt, ...q.subQuestions].filter(Boolean).join(". "))}>
                <Volume2 className="size-4" /> השמעת דוגמה
              </Button>
            </div>
            <VideoField id={`qv-${q.id}`} label="סרטון לשאלה (לא חובה)" value={q.videoUrl} onChange={(v) => p.onChange({ videoUrl: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="זמן הכנה (שנ׳)" htmlFor={`pr-${q.id}`} hint="0 = ללא">
              <Input id={`pr-${q.id}`} type="number" min={0} max={600} value={q.prepTimeSec} onChange={(e) => p.onChange({ prepTimeSec: Math.min(600, numOrNull(e.target.value) ?? 0) })} />
            </Field>
            <Field label="זמן הקלטה מרבי (שנ׳)" htmlFor={`rc-${q.id}`}>
              <Input id={`rc-${q.id}`} type="number" min={10} max={900} value={q.maxRecordSec} onChange={(e) => p.onChange({ maxRecordSec: Math.min(900, Math.max(10, numOrNull(e.target.value) ?? 10)) })} />
            </Field>
            <Field label="ניקוד" htmlFor={`pt-${q.id}`}>
              <Input id={`pt-${q.id}`} type="number" min={1} max={100} value={q.points} onChange={(e) => p.onChange({ points: Math.min(100, Math.max(1, numOrNull(e.target.value) ?? 1)) })} />
            </Field>
            <Field label="השמעות מרביות" htmlFor={`mp-${q.id}`} hint="ריק = ללא הגבלה">
              <Input id={`mp-${q.id}`} type="number" min={1} max={20} value={q.maxPlays ?? ""} onChange={(e) => p.onChange({ maxPlays: numOrNull(e.target.value) || null })} />
            </Field>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <Checkbox checked={q.allowReRecord} onChange={(e) => p.onChange({ allowReRecord: e.target.checked })} label="מותר להקליט מחדש" />
            {q.allowReRecord && (
              <Field label="מספר הקלטות מרבי" htmlFor={`mr-${q.id}`} hint="ריק = ללא הגבלה" className="w-44">
                <Input id={`mr-${q.id}`} type="number" min={1} max={20} value={q.maxRecordings ?? ""} onChange={(e) => p.onChange({ maxRecordings: numOrNull(e.target.value) || null })} />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
