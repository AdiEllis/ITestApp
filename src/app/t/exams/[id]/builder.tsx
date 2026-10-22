"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  Send,
  Settings2,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { BuilderExam, BuilderQuestion, BuilderSection, MediaMeta } from "@/lib/builder-state";
import { toSaveInput } from "@/lib/builder-state";
import { LEVEL_LABELS, MODE_LABELS, SECTION_KIND_LABELS } from "@/lib/exam-types";
import { COBE_DEFAULTS } from "@/lib/cobe";
import {
  addSourceFilesAction,
  duplicateExamAction,
  publishExamAction,
  removeSourceFileAction,
  saveExamAction,
  shareToLibraryAction,
  unpublishExamAction,
} from "../../_actions/exams";
import { uploadFile } from "@/lib/client/upload";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { MediaField } from "@/components/media/media-field";
import { VideoLinkField } from "@/components/media/video-link-field";
import { HelpButton } from "@/components/help/help-button";
import { MediaPlayer } from "@/components/media/media-player";
import { ProgressBar } from "@/components/media/progress-bar";
import { cn } from "@/components/ui/cn";

type SourceFile = { id: string; name: string | null; mimeType: string; sizeBytes: number };
type SaveState = "saved" | "dirty" | "saving" | "error";

const uid = () => `k_${Math.random().toString(36).slice(2, 10)}`;

function newQuestion(simulation: boolean): BuilderQuestion {
  return {
    key: uid(),
    title: null,
    prompt: "",
    subQuestions: [],
    instructions: null,
    audioId: null,
    videoId: null,
    imageId: null,
    videoUrl: null,
    maxMediaPlays: null,
    prepTimeSec: simulation ? 30 : 0,
    maxRecordSec: 120,
    allowReRecord: true,
    maxRecordings: simulation ? 3 : null,
    points: 25,
  };
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v))));

export function ExamBuilder({
  examId,
  initial,
  initialMedia,
  status,
  locked,
  rubrics,
  sourceFiles: initialSources,
  sharedEntry,
  justCopied,
}: {
  examId: string;
  initial: BuilderExam;
  initialMedia: MediaMeta;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  locked: boolean;
  rubrics: { id: string; name: string; system: boolean }[];
  sourceFiles: SourceFile[];
  sharedEntry: { id: string; sharedAt: string } | null;
  justCopied: boolean;
}) {
  const router = useRouter();
  const [exam, setExam] = useState(initial);
  const [media, setMedia] = useState(initialMedia);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const readOnly = locked || status === "ARCHIVED";
  const simulation = exam.mode === "SIMULATION";

  const update = useCallback((fn: (e: BuilderExam) => BuilderExam) => {
    setExam((e) => fn(e));
    setProblems([]);
    setNotice(null);
    version.current++;
    setSaveState("dirty");
  }, []);
  const addMedia = useCallback((id: string | null, meta?: MediaMeta[string]) => {
    if (id && meta) setMedia((m) => ({ ...m, [id]: meta }));
  }, []);

  const save = useCallback(async () => {
    if (readOnly) return true;
    const v = version.current;
    setSaveState("saving");
    const r = await saveExamAction(examId, toSaveInput(exam));
    if (!r.ok) {
      setSaveState("error");
      setSaveError(r.error);
      return false;
    }
    savedVersion.current = v;
    setSaveError(null);
    // Adopt server ids only if nothing changed while saving.
    if (version.current === v && r.state) {
      setExam((cur) => mergeIds(cur, r.state!.exam));
      setMedia((m) => ({ ...m, ...r.state!.media }));
      setSaveState("saved");
    } else {
      if (r.state) setExam((cur) => mergeIds(cur, r.state!.exam));
      setSaveState("dirty");
    }
    return true;
  }, [exam, examId, readOnly]);

  // Autosave 1.5s after the last change.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [saveState, save, exam]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save, saveState]);

  const totalPoints = useMemo(
    () =>
      exam.sections.reduce((sum, s) => {
        if (s.choiceMode === "CHOOSE_ONE") return sum + (s.questions[0]?.points ?? 0);
        return sum + s.questions.reduce((a, q) => a + q.points, 0);
      }, 0),
    [exam.sections],
  );

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string; problems?: string[] } | void>) {
    setBusy(label);
    setNotice(null);
    setProblems([]);
    try {
      if (saveState !== "saved" && !(await save())) return;
      const r = await fn();
      if (r && !r.ok) {
        setNotice(r.error ?? "הפעולה נכשלה");
        setProblems(r.problems ?? []);
      } else if (r && r.message) setNotice(r.message);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const setSection = (si: number, patch: Partial<BuilderSection>) =>
    update((e) => ({ ...e, sections: e.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const setQuestion = (si: number, qi: number, patch: Partial<BuilderQuestion>) =>
    update((e) => ({
      ...e,
      sections: e.sections.map((s, i) => (i === si ? { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) } : s)),
    }));

  return (
    <div className="pb-24">
      {/* Top bar */}
      <div className="z-20 -mx-4 mb-6 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link href="/t/exams" className="shrink-0 whitespace-nowrap text-sm text-ink-3 hover:text-ink">
              המבחנים שלי
            </Link>
            <span className="text-ink-3">/</span>
            <span className="truncate font-medium">{exam.title || "ללא שם"}</span>
            <Badge tone={status === "PUBLISHED" ? "ok" : status === "ARCHIVED" ? "neutral" : "warn"} className="shrink-0">
              {status === "PUBLISHED" ? "מפורסם" : status === "ARCHIVED" ? "בארכיון" : "טיוטה"}
            </Badge>
            <span className="hidden shrink-0 sm:inline-flex">
              <Badge tone={simulation ? "brand" : "neutral"}>{MODE_LABELS[exam.mode]}</Badge>
            </span>
          </div>
          <SaveIndicator state={readOnly ? "saved" : saveState} onRetry={save} />
          <div className="flex flex-wrap items-center gap-2">
            <HelpButton topic="builder" />
            <LinkButton href={`/preview/${examId}`} target="_blank" variant="secondary" size="sm" onClick={() => void save()}>
              <Eye className="size-4" /> תצוגת תלמיד
            </LinkButton>
            {status === "DRAFT" && (
              <Button size="sm" onClick={() => run("publish", () => publishExamAction(examId))} disabled={!!busy}>
                {busy === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} פרסום
              </Button>
            )}
            {status === "PUBLISHED" && (
              <LinkButton href={`/t/assignments/new?examId=${examId}`} size="sm">
                <ListChecks className="size-4" /> הקצאה לכיתה
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      {!locked && status !== "ARCHIVED" && (
        <ol className="mb-5 grid grid-cols-3 gap-2 text-sm" aria-label="שלבים">
          {[
            ["כותבים את השאלות", true],
            ["לוחצים \"פרסום\"", status === "PUBLISHED"],
            ["שולחים לכיתה", false],
          ].map(([label, done], i) => {
            const current = (i === 1 && status === "DRAFT") || (i === 2 && status === "PUBLISHED");
            return (
              <li key={i} className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center text-[13px] leading-tight sm:flex-row sm:gap-2 sm:px-3 sm:text-start sm:text-sm", current ? "border-brand bg-brand-soft/60 font-medium" : "border-line bg-surface text-ink-2")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done && !current ? "bg-ok text-white" : current ? "bg-brand text-white" : "bg-subtle text-ink-3")}>
                  {done && !current ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span>{label as string}</span>
              </li>
            );
          })}
        </ol>
      )}
      {justCopied && (
        <Alert tone="ok" className="mb-4" title="המבחן הועתק לספרייה שלך">
          זהו עותק פרטי — שינויים כאן לא ישפיעו על המבחן במאגר המשותף.
        </Alert>
      )}
      {locked && (
        <Alert tone="warn" className="mb-4" title="המבחן נעול לעריכה">
          תלמידים כבר התחילו לבצע את המבחן, ולכן לא ניתן לשנות אותו (כדי שהבדיקה תתבסס על אותה גרסה). ניתן לשכפל אותו וליצור גרסה חדשה.
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => run("dup", () => duplicateExamAction(examId))}>
              <Copy className="size-4" /> שכפול לגרסה חדשה
            </Button>
          </div>
        </Alert>
      )}
      {notice && (
        <Alert tone={problems.length ? "danger" : "ok"} className="mb-4" title={notice}>
          {problems.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {saveError && (
        <Alert tone="danger" className="mb-4" title="השמירה נכשלה">
          {saveError}
        </Alert>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column: sections & questions */}
        <fieldset disabled={readOnly} className="min-w-0 space-y-6">
          <Card className="space-y-4 p-5">
            <Field label="שם המבחן" htmlFor="title">
              <Input id="title" value={exam.title} onChange={(e) => update((x) => ({ ...x, title: e.target.value }))} className="h-11 text-base font-medium" />
            </Field>
            <Field label="תיאור (לא חובה)" htmlFor="description" hint="מוצג לתלמידים לפני תחילת המבחן">
              <Textarea id="description" rows={2} value={exam.description ?? ""} onChange={(e) => update((x) => ({ ...x, description: e.target.value }))} />
            </Field>
          </Card>

          {exam.sections.map((s, si) => (
            <SectionCard
              key={s.key}
              section={s}
              index={si}
              count={exam.sections.length}
              media={media}
              sourceFiles={initialSources}
              simulation={simulation}
              onChange={(patch) => setSection(si, patch)}
              onMedia={addMedia}
              onQuestion={(qi, patch) => setQuestion(si, qi, patch)}
              onMove={(dir) => update((e) => ({ ...e, sections: move(e.sections, si, dir) }))}
              onRemove={() => update((e) => ({ ...e, sections: e.sections.filter((_, i) => i !== si) }))}
              onAddQuestion={() => setSection(si, { questions: [...s.questions, newQuestion(simulation)] })}
              onMoveQuestion={(qi, dir) => setSection(si, { questions: move(s.questions, qi, dir) })}
              onRemoveQuestion={(qi) => setSection(si, { questions: s.questions.filter((_, j) => j !== qi) })}
              onDuplicateQuestion={(qi) =>
                setSection(si, {
                  questions: [...s.questions.slice(0, qi + 1), { ...s.questions[qi], id: undefined, key: uid() }, ...s.questions.slice(qi + 1)],
                })
              }
            />
          ))}

          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                update((e) => ({
                  ...e,
                  sections: [
                    ...e.sections,
                    {
                      key: uid(),
                      title: `Part ${e.sections.length + 1}`,
                      instructions: null,
                      kind: "GENERAL",
                      choiceMode: "ALL",
                      mediaId: null,
                      videoUrl: null,
                      maxMediaPlays: null,
                      questions: [newQuestion(simulation)],
                    },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/50 py-5 text-sm font-medium text-ink-2 hover:border-brand hover:text-brand"
            >
              <Layers className="size-4" /> הוספת חלק
            </button>
          )}
        </fieldset>

        {/* Side column: settings */}
        <div className="space-y-6">
          <Card className="p-5">
            <fieldset disabled={readOnly} className="space-y-4">
              <h2 className="text-[15px] font-semibold">איך התלמידים יענו?</h2>
              <div className="grid gap-2">
                {(
                  [
                    ["PRACTICE", "תרגול רגיל", "בלי לחץ זמן, אפשר לחזור לשאלות"],
                    ["SIMULATION", "כמו בבחינה", "זמני הכנה, הקלטה אוטומטית וזמן כולל"],
                  ] as const
                ).map(([v, title, body]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={exam.mode === v}
                    onClick={() =>
                      update((x) => ({
                        ...x,
                        mode: v,
                        settings:
                          v === "SIMULATION"
                            ? { ...x.settings, totalTimeLimitSec: x.settings.totalTimeLimitSec ?? COBE_DEFAULTS.totalTimeLimitSec, allowBackNavigation: false }
                            : { ...x.settings, totalTimeLimitSec: null, allowBackNavigation: true },
                      }))
                    }
                    className={cn("rounded-xl border p-3 text-start", exam.mode === v ? "border-brand bg-brand-soft/50" : "border-line hover:border-line-strong")}
                  >
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-ink-2">{body}</span>
                  </button>
                ))}
              </div>
              {exam.mode === "SIMULATION" && (
                <Field label="זמן כולל למבחן (דקות)" htmlFor="limit" hint="כשהזמן נגמר — מה שהוקלט מוגש אוטומטית. ריק = ללא מגבלה.">
                  <Input
                    id="limit"
                    type="number"
                    min={1}
                    max={240}
                    inputMode="numeric"
                    value={exam.settings.totalTimeLimitSec ? Math.round(exam.settings.totalTimeLimitSec / 60) : ""}
                    onChange={(e) => {
                      const m = numOrNull(e.target.value);
                      update((x) => ({ ...x, settings: { ...x.settings, totalTimeLimitSec: m ? Math.min(240, Math.max(1, m)) * 60 : null } }));
                    }}
                  />
                </Field>
              )}
              <details className="rounded-xl border border-line">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-ink-2 hover:text-ink">
                  <Settings2 className="size-4" /> הגדרות מתקדמות
                </summary>
                <div className="space-y-4 border-t border-line p-3">
                  <Field label="רמה" htmlFor="level">
                    <Select id="level" value={exam.level} onChange={(e) => update((x) => ({ ...x, level: e.target.value as BuilderExam["level"] }))}>
                      {Object.entries(LEVEL_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Checkbox
                    checked={exam.settings.allowBackNavigation}
                    onChange={(e) => update((x) => ({ ...x, settings: { ...x.settings, allowBackNavigation: e.target.checked } }))}
                    label="מותר לחזור לשאלות קודמות"
                  />
                  <Checkbox
                    checked={exam.settings.allowReviewOwnRecording}
                    onChange={(e) => update((x) => ({ ...x, settings: { ...x.settings, allowReviewOwnRecording: e.target.checked } }))}
                    label="התלמיד/ה יכול/ה להאזין להקלטה לפני ההגשה"
                  />
                  <Field
                    label="מחוון הערכה"
                    htmlFor="rubric"
                    hint={
                      <Link href="/t/rubrics" className="text-brand hover:underline">
                        עריכת מחוונים
                      </Link>
                    }
                  >
                    <Select id="rubric" value={exam.rubricId ?? ""} onChange={(e) => update((x) => ({ ...x, rubricId: e.target.value || null }))}>
                      <option value="">ללא מחוון (ציון ישיר לכל שאלה)</option>
                      {rubrics.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.system ? " (ברירת מחדל)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <TopicsInput topics={exam.topics} onChange={(topics) => update((x) => ({ ...x, topics }))} />
                  <p className="text-sm text-ink-3">
                    סה״כ ניקוד: <span className="font-semibold tabular text-ink">{totalPoints}</span> · הציון הסופי מנורמל ל־100
                  </p>
                </div>
              </details>
            </fieldset>
          </Card>

          {initialSources.length > 0 && <SourceFilesPanel examId={examId} files={initialSources} readOnly={readOnly} onChanged={() => router.refresh()} />}

          <Card className="space-y-3 p-5">
            <h2 className="text-[15px] font-semibold">פעולות</h2>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" className="justify-start" onClick={() => run("dup", () => duplicateExamAction(examId))} disabled={!!busy}>
                <Copy className="size-4" /> שכפול מבחן
              </Button>
              {status === "PUBLISHED" && (
                <Button variant="secondary" size="sm" className="justify-start" onClick={() => setShareOpen((v) => !v)}>
                  <Share2 className="size-4" /> {sharedEntry ? "עדכון הגרסה במאגר המשותף" : "שיתוף במאגר המשותף"}
                </Button>
              )}
              {shareOpen && (
                <ShareBox onShare={(ok) => run("share", () => shareToLibraryAction(examId, ok)).then(() => setShareOpen(false))} busy={busy === "share"} />
              )}
              {sharedEntry && (
                <p className="text-xs text-ink-3">
                  משותף במאגר ·{" "}
                  <Link href={`/t/library/${sharedEntry.id}`} className="text-brand hover:underline">
                    צפייה
                  </Link>
                </p>
              )}
              {status === "PUBLISHED" && !locked && (
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => run("unpub", () => unpublishExamAction(examId))} disabled={!!busy}>
                  החזרה לטיוטה
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Copies server-assigned ids onto client items that were saved without one (matched by position). */
function mergeIds(cur: BuilderExam, server: BuilderExam): BuilderExam {
  return {
    ...cur,
    sections: cur.sections.map((s, i) => {
      const ss = server.sections[i];
      if (!ss) return s;
      return {
        ...s,
        id: s.id ?? ss.id,
        questions: s.questions.map((q, j) => ({ ...q, id: q.id ?? ss.questions[j]?.id })),
      };
    }),
  };
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-3" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" /> שומר…
      </span>
    );
  if (state === "dirty")
    return (
      <span className="text-sm text-ink-3" aria-live="polite">
        שינויים לא שמורים
      </span>
    );
  if (state === "error")
    return (
      <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-sm text-danger hover:underline">
        <AlertTriangle className="size-3.5" /> השמירה נכשלה · ניסיון חוזר
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ok" aria-live="polite">
      <Check className="size-3.5" /> נשמר
    </span>
  );
}

function ShareBox({ onShare, busy }: { onShare: (rightsConfirmed: boolean) => void; busy: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border border-line bg-subtle p-3 text-sm">
      <p className="text-ink-2">עותק של המבחן (ללא הגשות או נתוני תלמידים) יפורסם לכל המורים במערכת. מורים יוכלו להעתיק אותו לספרייה שלהם.</p>
      <Checkbox
        checked={ok}
        onChange={(e) => setOk(e.target.checked)}
        label="אני מאשר/ת שהתכנים נכתבו על ידי, או שיש לי זכות לשתף אותם. המבחן אינו כולל חומרי בחינה רשמיים מוגנים, סרטונים או קבצים ללא הרשאה."
      />
      <Button size="sm" disabled={!ok || busy} onClick={() => onShare(ok)}>
        {busy && <Loader2 className="size-4 animate-spin" />} שיתוף
      </Button>
    </div>
  );
}

function TopicsInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim();
    if (t && !topics.includes(t) && topics.length < 10) onChange([...topics, t]);
    setV("");
  };
  return (
    <Field label="נושאים / תגיות" htmlFor="topic" hint="עוזר לחיפוש במאגר המשותף">
      <div className="flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong">
            {t}
            <button type="button" onClick={() => onChange(topics.filter((x) => x !== t))} aria-label={`הסרת ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id="topic"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="לדוגמה: Technology"
        />
        <Button variant="secondary" onClick={add}>
          הוספה
        </Button>
      </div>
    </Field>
  );
}

function SectionCard(props: {
  section: BuilderSection;
  index: number;
  count: number;
  media: MediaMeta;
  sourceFiles: SourceFile[];
  simulation: boolean;
  onChange: (p: Partial<BuilderSection>) => void;
  onMedia: (id: string | null, meta?: MediaMeta[string]) => void;
  onQuestion: (qi: number, p: Partial<BuilderQuestion>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onMoveQuestion: (qi: number, dir: -1 | 1) => void;
  onRemoveQuestion: (qi: number) => void;
  onDuplicateQuestion: (qi: number) => void;
}) {
  const { section: s, index } = props;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-subtle/60 px-5 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-ink text-xs font-semibold text-white tabular">{index + 1}</span>
        <Input
          aria-label="שם החלק"
          value={s.title}
          onChange={(e) => props.onChange({ title: e.target.value })}
          dir="auto"
          className="h-9 max-w-sm flex-1 bg-surface font-medium"
        />
        <div className="ms-auto flex items-center gap-1">
          <IconBtn label="הזזה למעלה" onClick={() => props.onMove(-1)} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="הזזה למטה" onClick={() => props.onMove(1)} disabled={index === props.count - 1}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn
            label="מחיקת חלק"
            onClick={() => {
              if (confirm(`למחוק את "${s.title}" ואת כל השאלות בו?`)) props.onRemove();
            }}
          >
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <Field label="הוראות לתלמידים (באנגלית)" htmlFor={`instr-${s.key}`}>
          <Textarea id={`instr-${s.key}`} lang="en" dir="ltr" rows={2} value={s.instructions ?? ""} onChange={(e) => props.onChange({ instructions: e.target.value })} />
        </Field>
        {s.choiceMode === "CHOOSE_ONE" && <p className="rounded-lg bg-brand-soft/60 px-3 py-2 text-sm text-ink-2">בחלק הזה התלמיד/ה בוחר/ת נושא אחד מתוך האפשרויות ועונה רק עליו.</p>}
        {(s.kind === "AUDIO_VISUAL" || s.mediaId || s.videoUrl) && (
          <div className="space-y-4 rounded-xl border border-line bg-subtle/40 p-4">
            <VideoLinkField id={`vurl-${s.key}`} label="הסרטון של החלק (קישור מיוטיוב)" value={s.videoUrl} onChange={(v) => props.onChange({ videoUrl: v })} />
            <MediaField
              label="או: העלאת קובץ וידאו / שמע מהמחשב"
              accept="audio-video"
              value={s.mediaId}
              media={props.media}
              sourceFiles={props.sourceFiles}
              onChange={(id, meta) => {
                props.onMedia(id, meta);
                props.onChange({ mediaId: id });
              }}
            />
          </div>
        )}
        <details className="rounded-xl border border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink-2 hover:text-ink">
            <Settings2 className="size-4" /> הגדרות לחלק
          </summary>
          <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
            <Field label="סוג החלק" htmlFor={`kind-${s.key}`}>
              <Select id={`kind-${s.key}`} value={s.kind} onChange={(e) => props.onChange({ kind: e.target.value as BuilderSection["kind"] })}>
                {Object.entries(SECTION_KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="איך עונים" htmlFor={`choice-${s.key}`}>
              <Select id={`choice-${s.key}`} value={s.choiceMode} onChange={(e) => props.onChange({ choiceMode: e.target.value as BuilderSection["choiceMode"] })}>
                <option value="ALL">עונים על כל השאלות</option>
                <option value="CHOOSE_ONE">בוחרים נושא אחד</option>
              </Select>
            </Field>
            <Field label="מספר צפיות בסרטון" htmlFor={`plays-${s.key}`} hint="ריק = ללא הגבלה (רק לקובץ שהועלה)">
              <Input id={`plays-${s.key}`} type="number" min={1} max={20} value={s.maxMediaPlays ?? ""} onChange={(e) => props.onChange({ maxMediaPlays: numOrNull(e.target.value) || null })} />
            </Field>
          </div>
        </details>

        <div className="space-y-3">
          {s.questions.map((q, qi) => (
            <QuestionCard
              key={q.key}
              q={q}
              index={qi}
              count={s.questions.length}
              choose={s.choiceMode === "CHOOSE_ONE"}
              media={props.media}
              sourceFiles={props.sourceFiles}
              simulation={props.simulation}
              onChange={(p) => props.onQuestion(qi, p)}
              onMedia={props.onMedia}
              onMove={(d) => props.onMoveQuestion(qi, d)}
              onRemove={() => props.onRemoveQuestion(qi)}
              onDuplicate={() => props.onDuplicateQuestion(qi)}
            />
          ))}
          {s.questions.length === 0 && (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">אין עדיין שאלות בחלק זה</p>
          )}
          <Button variant="subtle" size="sm" onClick={props.onAddQuestion}>
            <Plus className="size-4" /> {s.choiceMode === "CHOOSE_ONE" ? "הוספת נושא" : "הוספת שאלה"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function QuestionCard(props: {
  q: BuilderQuestion;
  index: number;
  count: number;
  choose: boolean;
  media: MediaMeta;
  sourceFiles: SourceFile[];
  simulation: boolean;
  onChange: (p: Partial<BuilderQuestion>) => void;
  onMedia: (id: string | null, meta?: MediaMeta[string]) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { q } = props;
  const [open, setOpen] = useState(!q.prompt);
  const label = q.title || (props.choose ? `Topic ${props.index + 1}` : `Question ${props.index + 1}`);
  const hasMedia = q.audioId || q.videoId || q.imageId;
  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-start" aria-expanded={open}>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", !open && "rotate-90 rtl:-rotate-90")} />
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
          {q.points} נק׳ · {q.maxRecordSec} שנ׳{hasMedia ? " · מדיה" : ""}
        </span>
        <IconBtn label="הזזה למעלה" onClick={() => props.onMove(-1)} disabled={props.index === 0}>
          <ArrowUp className="size-4" />
        </IconBtn>
        <IconBtn label="הזזה למטה" onClick={() => props.onMove(1)} disabled={props.index === props.count - 1}>
          <ArrowDown className="size-4" />
        </IconBtn>
        <IconBtn label="שכפול שאלה" onClick={props.onDuplicate}>
          <Copy className="size-4" />
        </IconBtn>
        <IconBtn
          label="מחיקת שאלה"
          onClick={() => {
            if (confirm("למחוק את השאלה?")) props.onRemove();
          }}
        >
          <Trash2 className="size-4" />
        </IconBtn>
      </div>
      {open && (
        <div className="space-y-5 border-t border-line p-4">
          <Field label="השאלה (באנגלית)" htmlFor={`qp-${q.key}`}>
            <Textarea
              id={`qp-${q.key}`}
              lang="en"
              dir="ltr"
              rows={2}
              value={q.prompt}
              onChange={(e) => props.onChange({ prompt: e.target.value })}
              placeholder="Let's talk about…"
            />
          </Field>
          <SubQuestions items={q.subQuestions} onChange={(subQuestions) => props.onChange({ subQuestions })} />

          <div className="grid gap-4 rounded-xl bg-subtle/50 p-4 lg:grid-cols-2">
            <VideoLinkField id={`qvurl-${q.key}`} label="סרטון לשאלה (קישור, לא חובה)" value={q.videoUrl} onChange={(v) => props.onChange({ videoUrl: v })} />
            <MediaField
              label="השמעת השאלה בקול (לא חובה)"
              accept="audio"
              allowRecord
              value={q.audioId}
              media={props.media}
              sourceFiles={props.sourceFiles}
              onChange={(id, meta) => {
                props.onMedia(id, meta);
                props.onChange({ audioId: id });
              }}
            />
          </div>

          <details className="group rounded-xl border border-line">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink-2 hover:text-ink">
              <Settings2 className="size-4" /> הגדרות לשאלה
              <span className="font-normal text-ink-3">
                · {q.prepTimeSec ? `הכנה ${q.prepTimeSec} שנ׳ · ` : ""}הקלטה עד {q.maxRecordSec} שנ׳ · {q.points} נק׳
              </span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="זמן הכנה (שנ׳)" htmlFor={`prep-${q.key}`} hint="0 = ללא">
                  <Input id={`prep-${q.key}`} type="number" min={0} max={600} value={q.prepTimeSec} onChange={(e) => props.onChange({ prepTimeSec: Math.min(600, numOrNull(e.target.value) ?? 0) })} />
                </Field>
                <Field label="זמן הקלטה (שנ׳)" htmlFor={`rec-${q.key}`}>
                  <Input id={`rec-${q.key}`} type="number" min={10} max={900} value={q.maxRecordSec} onChange={(e) => props.onChange({ maxRecordSec: Math.min(900, Math.max(10, numOrNull(e.target.value) ?? 10)) })} />
                </Field>
                <Field label="ניקוד" htmlFor={`pts-${q.key}`}>
                  <Input id={`pts-${q.key}`} type="number" min={1} max={100} value={q.points} onChange={(e) => props.onChange({ points: Math.min(100, Math.max(1, numOrNull(e.target.value) ?? 1)) })} />
                </Field>
                <Field label="השמעות מרביות" htmlFor={`mp-${q.key}`} hint="ריק = ללא הגבלה">
                  <Input id={`mp-${q.key}`} type="number" min={1} max={20} value={q.maxMediaPlays ?? ""} onChange={(e) => props.onChange({ maxMediaPlays: numOrNull(e.target.value) || null })} />
                </Field>
              </div>
              <div className="flex flex-wrap items-end gap-6">
                <Checkbox checked={q.allowReRecord} onChange={(e) => props.onChange({ allowReRecord: e.target.checked })} label="מותר להקליט מחדש" />
                {q.allowReRecord && (
                  <Field label="מספר הקלטות מרבי" htmlFor={`mr-${q.key}`} hint="ריק = ללא הגבלה" className="w-44">
                    <Input id={`mr-${q.key}`} type="number" min={1} max={20} value={q.maxRecordings ?? ""} onChange={(e) => props.onChange({ maxRecordings: numOrNull(e.target.value) || null })} />
                  </Field>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <Field label="כותרת (לא חובה)" htmlFor={`qt-${q.key}`}>
                  <Input id={`qt-${q.key}`} lang="en" dir="ltr" value={q.title ?? ""} placeholder={label} onChange={(e) => props.onChange({ title: e.target.value })} />
                </Field>
                <Field label="הנחיה נוספת (לא חובה)" htmlFor={`qi-${q.key}`}>
                  <Input id={`qi-${q.key}`} lang="en" dir="ltr" value={q.instructions ?? ""} onChange={(e) => props.onChange({ instructions: e.target.value })} placeholder="Answer all the questions in one recording." />
                </Field>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <MediaField
                  label="העלאת קובץ וידאו"
                  accept="video"
                  value={q.videoId}
                  media={props.media}
                  sourceFiles={props.sourceFiles}
                  onChange={(id, meta) => {
                    props.onMedia(id, meta);
                    props.onChange({ videoId: id });
                  }}
                />
                <MediaField
                  label="תמונה"
                  accept="image"
                  value={q.imageId}
                  media={props.media}
                  sourceFiles={props.sourceFiles}
                  onChange={(id, meta) => {
                    props.onMedia(id, meta);
                    props.onChange({ imageId: id });
                  }}
                />
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SubQuestions({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">שאלות המשך <span className="font-normal text-ink-3">(התלמיד עונה על כולן בהקלטה אחת)</span></p>
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center text-xs text-ink-3 tabular">{i + 1}</span>
          <Input lang="en" dir="ltr" value={t} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`שאלה ${i + 1}`} />
          <IconBtn label="מחיקה" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </IconBtn>
        </div>
      ))}
      {items.length < 12 && (
        <Button variant="ghost" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus className="size-4" /> הוספת שאלה לסט
        </Button>
      )}
    </div>
  );
}

function SourceFilesPanel({ examId, files, readOnly, onChanged }: { examId: string; files: SourceFile[]; readOnly: boolean; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ name: string; progress: number; error?: string }[]>([]);
  async function onFiles(list: FileList) {
    const ids: string[] = [];
    const arr = Array.from(list);
    setUploads(arr.map((f) => ({ name: f.name, progress: 0 })));
    await Promise.all(
      arr.map(async (f, i) => {
        try {
          const id = await uploadFile(f, {
            kind: "SOURCE_DOCUMENT",
            name: f.name,
            onProgress: (p) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: p } : x))),
          });
          ids.push(id);
          setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: 1 } : x)));
        } catch (e) {
          setUploads((u) => u.map((x, j) => (j === i ? { ...x, error: (e as Error).message } : x)));
        }
      }),
    );
    if (ids.length) await addSourceFilesAction(examId, ids);
    setUploads((u) => u.filter((x) => x.error));
    onChanged();
  }
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">קבצי מקור</h2>
        {!readOnly && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.mp3,.m4a,.wav,.mp4,.mov,.webm,.png,.jpg,.jpeg"
              onChange={(e) => e.target.files && onFiles(e.target.files)}
            />
            <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
              <Upload className="size-4" /> העלאה
            </Button>
          </>
        )}
      </div>
      <p className="text-[13px] text-ink-3">
        PDF, Word, שמע ווידאו של מבחן מוכן. קבצי שמע/וידאו ניתן לשייך לשאלות דרך &quot;מהקבצים שהועלו&quot;. קבצי מקור אינם מוצגים לתלמידים.
      </p>
      {uploads.map((u) => (
        <div key={u.name} className="space-y-1 text-sm">
          <p className="truncate" dir="auto">
            {u.name}
          </p>
          {u.error ? <p className="text-danger">{u.error}</p> : <ProgressBar value={u.progress} />}
        </div>
      ))}
      {files.length === 0 && uploads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-sm text-ink-3">אין קבצי מקור</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="space-y-1.5 rounded-lg border border-line p-2.5">
              <div className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                  {f.name}
                </span>
                {!readOnly && (
                  <IconBtn
                    label="הסרת קובץ"
                    onClick={async () => {
                      if (!confirm("להסיר את הקובץ?")) return;
                      await removeSourceFileAction(examId, f.id);
                      onChanged();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconBtn>
                )}
              </div>
              <MediaPlayer
                id={f.id}
                mimeType={f.mimeType}
                name={f.name}
                className={
                  f.mimeType.startsWith("video/") ? "aspect-video w-full rounded bg-black" : f.mimeType.startsWith("audio/") ? "w-full h-9" : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IconBtn({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-subtle hover:text-ink disabled:opacity-30"
      {...props}
    >
      {children}
    </button>
  );
}
