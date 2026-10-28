"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CheckCircle2, FileText, Film, Loader2, Merge, Music, Plus, Trash2, UploadCloud, Wand2, X } from "lucide-react";
import { createImportedExamAction, parseExamFilesAction } from "../../_actions/exams";
import { guessMime, uploadFile } from "@/lib/client/upload";
import { mediaCategory } from "@/lib/files";
import type { ParsedExam, ParsedQuestion } from "@/lib/exam-import";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { SubjectInput } from "@/components/ui/subject-input";
import { ProgressBar } from "@/components/media/progress-bar";
import { cn } from "@/components/ui/cn";

type Item = { key: string; file: File; progress: number; mediaId?: string; error?: string };
const ACCEPT = ".pdf,.doc,.docx,.mp3,.m4a,.wav,.mp4,.mov,.webm,.png,.jpg,.jpeg";

/** A question on the review screen; sub-questions are edited one per line. */
type Draft = { key: string; prompt: string; subs: string; points: string };
type DraftSection = { key: string; title: string; instructions: string; questions: Draft[] };

const uid = () => Math.random().toString(36).slice(2);

function Icon({ type }: { type: string }) {
  const c = mediaCategory(type);
  if (c === "audio") return <Music className="size-4 text-ink-3" />;
  if (c === "video") return <Film className="size-4 text-ink-3" />;
  return <FileText className="size-4 text-ink-3" />;
}

function fixType(f: File): File {
  const t = f.type || guessMime(f.name);
  return t && t !== f.type ? new File([f], f.name, { type: t }) : f;
}

const readable = (f: File) => ["pdf", "doc", "image"].includes(mediaCategory(f.type));

function toDraft(q: ParsedQuestion): Draft {
  return { key: uid(), prompt: q.prompt, subs: q.subQuestions.join("\n"), points: q.points ? String(q.points) : "" };
}

export function ImportWizard() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [reading, setReading] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState("PRACTICE");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<DraftSection[] | null>(null);
  const [method, setMethod] = useState<ParsedExam["method"]>("ai");

  function add(files: FileList | File[]) {
    const list = Array.from(files).map((f) => ({ key: uid(), file: fixType(f), progress: 0 }));
    setItems((cur) => [...cur, ...list]);
    if (!title && list[0]) setTitle(list[0].file.name.replace(/\.[^.]+$/, ""));
    for (const it of list) {
      uploadFile(it.file, {
        kind: "SOURCE_DOCUMENT",
        name: it.file.name,
        onProgress: (p) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, progress: p } : x))),
      })
        .then((id) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, progress: 1, mediaId: id } : x))))
        .catch((e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, error: (e as Error).message } : x))));
    }
  }

  const uploading = items.some((i) => !i.mediaId && !i.error);
  const ready = items.filter((i) => i.mediaId);
  const canRead = ready.some((i) => readable(i.file));
  const count = sections?.reduce((n, s) => n + s.questions.filter((q) => q.prompt.trim() || q.subs.trim()).length, 0) ?? 0;

  async function read() {
    setError(null);
    setWarnings([]);
    setReading(true);
    try {
      const r = await parseExamFilesAction(ready.map((i) => i.mediaId!));
      if (!r.ok || !r.exam) {
        setError(r.ok ? "השאלות לא נקראו" : r.error);
        return;
      }
      const e = r.exam;
      if (e.title) setTitle(e.title);
      if (e.description) setDescription(e.description);
      setMethod(e.method);
      setWarnings(r.warnings ?? []);
      setSections(e.sections.map((s) => ({ key: uid(), title: s.title, instructions: s.instructions, questions: s.questions.map(toDraft) })));
    } catch {
      setError("החיבור לשרת נכשל. נסו שוב.");
    } finally {
      setReading(false);
    }
  }

  async function create() {
    setError(null);
    setCreating(true);
    const r = await createImportedExamAction({
      title,
      subject: subject.trim() || null,
      mode: mode as "SIMULATION",
      description: description.trim() || null,
      mediaIds: ready.map((i) => i.mediaId!),
      sections: (sections ?? []).map((s) => ({
        title: s.title,
        instructions: s.instructions,
        questions: s.questions.map((q) => {
          const points = Number(q.points);
          return {
            prompt: q.prompt.trim(),
            subQuestions: q.subs.split("\n").map((x) => x.trim()).filter(Boolean),
            points: Number.isInteger(points) && points >= 1 && points <= 100 ? points : null,
          };
        }),
      })),
    });
    if (!r.ok || !r.examId) {
      setError(r.ok ? "שגיאה" : r.error);
      setCreating(false);
      return;
    }
    router.push(`/t/exams/${r.examId}${count ? "?imported=1" : ""}`);
  }

  const setSection = (si: number, patch: Partial<DraftSection>) => setSections((cur) => cur!.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setQuestions = (si: number, fn: (qs: Draft[]) => Draft[]) => setSections((cur) => cur!.map((s, i) => (i === si ? { ...s, questions: fn(s.questions) } : s)));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            add(e.dataTransfer.files);
          }}
          className={cn("flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-brand bg-brand-soft" : "border-line-strong")}
        >
          <UploadCloud className="size-8 text-ink-3" />
          <p className="mt-3 font-medium">גררו לכאן את קובץ המבחן</p>
          <p className="mt-1 text-sm text-ink-3">Word (docx), PDF או צילום של דף המבחן. אפשר להוסיף גם קובצי שמע ווידאו.</p>
          <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && add(e.target.files)} />
          <Button variant="secondary" className="mt-4" onClick={() => input.current?.click()}>
            בחירת קבצים
          </Button>
        </div>
        {items.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-3 px-4 py-3">
                <Icon type={it.file.type} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm" dir="auto">
                    {it.file.name}
                  </p>
                  {it.error ? <p className="text-xs text-danger">{it.error}</p> : !it.mediaId ? <ProgressBar value={it.progress} /> : null}
                </div>
                {it.mediaId ? <CheckCircle2 className="size-4 text-ok" aria-label="הועלה" /> : !it.error ? <Loader2 className="size-4 animate-spin text-ink-3" /> : null}
                <button type="button" aria-label="הסרה" onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))} className="text-ink-3 hover:text-ink">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!sections && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={read} disabled={uploading || !canRead || reading}>
              {reading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {uploading ? "ממתין לסיום ההעלאה…" : reading ? "קוראים את השאלות…" : "קריאת השאלות מהקובץ"}
            </Button>
            {reading && <span className="text-sm text-ink-3">זה יכול לקחת עד דקה</span>}
          </div>
        )}
        {error && !sections && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}
      </Card>

      {sections && (
        <>
          <Alert tone="info" title={count ? `נמצאו ${count} שאלות` : "לא נמצאו שאלות"}>
            {method === "text" ? "השאלות חולקו לפי המספור שבקובץ. " : ""}
            בדקו שכל שאלה הועתקה נכון ושלמה, ותקנו או מחקו לפי הצורך. התלמיד/ה ישמע/תשמע בדיוק את מה שכתוב כאן.
          </Alert>
          {warnings.length > 0 && (
            <Alert tone="warn">
              <ul className="space-y-0.5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
          {sections.map((s, si) => (
            <Card key={s.key} className="space-y-4 p-4 sm:p-5">
              {(sections.length > 1 || s.title) && (
                <div className="flex items-end gap-2">
                  <Field label="שם החלק" htmlFor={`st-${s.key}`} className="flex-1">
                    <Input id={`st-${s.key}`} dir="auto" value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} />
                  </Field>
                  {sections.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label="מחיקת החלק" onClick={() => setSections((cur) => cur!.filter((_, i) => i !== si))}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )}
              {s.instructions && (
                <Field label="הנחיות לחלק" htmlFor={`si-${s.key}`}>
                  <Textarea id={`si-${s.key}`} dir="auto" rows={2} value={s.instructions} onChange={(e) => setSection(si, { instructions: e.target.value })} />
                </Field>
              )}
              <ol className="space-y-4">
                {s.questions.map((q, qi) => (
                  <li key={q.key} className="space-y-2 rounded-xl border border-line p-3" aria-label={`שאלה ${qi + 1}`}>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-semibold">שאלה {qi + 1}</span>
                      {qi > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="חיבור לשאלה הקודמת, אם השאלה נחתכה לשתיים"
                          onClick={() =>
                            setQuestions(si, (qs) => {
                              const prev = qs[qi - 1];
                              const merged = { ...prev, prompt: [prev.prompt, q.prompt].filter(Boolean).join("\n"), subs: [prev.subs, q.subs].filter(Boolean).join("\n") };
                              return [...qs.slice(0, qi - 1), merged, ...qs.slice(qi + 1)];
                            })
                          }
                        >
                          <Merge className="size-4" /> <ArrowUp className="-ms-1.5 size-3" /> חיבור לקודמת
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" aria-label={`מחיקת שאלה ${qi + 1}`} onClick={() => setQuestions(si, (qs) => qs.filter((_, j) => j !== qi))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Textarea
                      aria-label={`נוסח שאלה ${qi + 1}`}
                      dir="auto"
                      rows={Math.min(10, Math.max(2, Math.ceil(q.prompt.length / 70) + q.prompt.split("\n").length - 1))}
                      className="min-h-16"
                      value={q.prompt}
                      onChange={(e) => setQuestions(si, (qs) => qs.map((x, j) => (j === qi ? { ...x, prompt: e.target.value } : x)))}
                    />
                    <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                      <Field label="סעיפים (סעיף בכל שורה, לא חובה)" htmlFor={`sub-${q.key}`}>
                        <Textarea
                          id={`sub-${q.key}`}
                          dir="auto"
                          rows={Math.max(1, q.subs.split("\n").length)}
                          className="min-h-10"
                          value={q.subs}
                          onChange={(e) => setQuestions(si, (qs) => qs.map((x, j) => (j === qi ? { ...x, subs: e.target.value } : x)))}
                        />
                      </Field>
                      <Field label="ניקוד" htmlFor={`pt-${q.key}`}>
                        <Input
                          id={`pt-${q.key}`}
                          inputMode="numeric"
                          placeholder="אוטומטי"
                          value={q.points}
                          onChange={(e) => setQuestions(si, (qs) => qs.map((x, j) => (j === qi ? { ...x, points: e.target.value.replace(/\D/g, "").slice(0, 3) } : x)))}
                        />
                      </Field>
                    </div>
                  </li>
                ))}
              </ol>
              <Button variant="secondary" size="sm" onClick={() => setQuestions(si, (qs) => [...qs, { key: uid(), prompt: "", subs: "", points: "" }])}>
                <Plus className="size-4" /> הוספת שאלה
              </Button>
            </Card>
          ))}
          {sections.length === 0 && (
            <Button variant="secondary" onClick={() => setSections([{ key: uid(), title: "", instructions: "", questions: [{ key: uid(), prompt: "", subs: "", points: "" }] }])}>
              <Plus className="size-4" /> הוספת שאלה
            </Button>
          )}
        </>
      )}

      {(sections || ready.length > 0) && (
        <Card className="space-y-4 p-5">
          <Field label="שם המבחן" htmlFor="title">
            <Input id="title" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="מקצוע" htmlFor="subject">
              <SubjectInput id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="לדוגמה: היסטוריה" />
            </Field>
            <Field label="מצב" htmlFor="mode">
              <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="PRACTICE">תרגול</option>
                <option value="SIMULATION">מבחן</option>
              </Select>
            </Field>
          </div>
          {sections && (
            <Field label="הסבר לתלמידים לפני המבחן (לא חובה)" htmlFor="description">
              <Textarea id="description" dir="auto" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          )}
          {error && sections && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            {sections ? (
              <Button onClick={create} disabled={uploading || !title.trim() || creating || count === 0}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                יצירת המבחן והמשך להקראה
              </Button>
            ) : (
              <button type="button" onClick={create} disabled={uploading || ready.length === 0 || !title.trim() || creating} className="text-sm text-brand hover:underline disabled:opacity-50">
                {creating ? "יוצרים…" : "דילוג: אקליד את השאלות בעצמי בעורך"}
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
