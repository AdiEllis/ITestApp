"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Film, Loader2, Music, UploadCloud, X } from "lucide-react";
import { createImportedExamAction } from "../../_actions/exams";
import { guessMime, uploadFile } from "@/lib/client/upload";
import { mediaCategory } from "@/lib/files";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { ProgressBar } from "@/components/media/progress-bar";
import { cn } from "@/components/ui/cn";

type Item = { key: string; file: File; progress: number; mediaId?: string; error?: string };
const ACCEPT = ".pdf,.doc,.docx,.mp3,.m4a,.wav,.mp4,.mov,.webm,.png,.jpg,.jpeg";

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

export function ImportWizard() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("FOUR_AND_FIVE");
  const [mode, setMode] = useState("SIMULATION");

  function add(files: FileList | File[]) {
    const list = Array.from(files).map((f) => ({ key: Math.random().toString(36).slice(2), file: fixType(f), progress: 0 }));
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

  async function create() {
    setError(null);
    setCreating(true);
    const r = await createImportedExamAction({ title, level: level as "FOUR_AND_FIVE", mode: mode as "SIMULATION", mediaIds: ready.map((i) => i.mediaId!) });
    if (!r.ok || !r.examId) {
      setError(r.ok ? "שגיאה" : r.error);
      setCreating(false);
      return;
    }
    router.push(`/t/exams/${r.examId}`);
  }

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
          <p className="mt-3 font-medium">גררו קבצים לכאן</p>
          <p className="mt-1 text-sm text-ink-3">PDF, Word (doc/docx), MP3, M4A, WAV, MP4, MOV · עד 30MB למסמך, 400MB לסרטון בממשק העריכה</p>
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
      </Card>
      <Card className="space-y-4 p-5">
        <Field label="שם המבחן" htmlFor="title">
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="רמה" htmlFor="level">
            <Select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="FOUR_AND_FIVE">4 ו־5 יח״ל</option>
              <option value="FIVE_POINTS">5 יח״ל</option>
              <option value="FOUR_POINTS">4 יח״ל</option>
              <option value="OTHER">אחר</option>
            </Select>
          </Field>
          <Field label="מצב" htmlFor="mode">
            <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="SIMULATION">סימולציה</option>
              <option value="PRACTICE">תרגול</option>
            </Select>
          </Field>
        </div>
        <Alert tone="info">בשלב זה אין חילוץ אוטומטי של שאלות מהקבצים. בעורך תוכלו לצפות בקבצים לצד הטופס, להקליד את השאלות ולשייך קובצי שמע ווידאו לשאלות.</Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button onClick={create} disabled={uploading || ready.length === 0 || !title.trim() || creating}>
          {creating && <Loader2 className="size-4 animate-spin" />}
          {uploading ? "ממתין לסיום ההעלאה…" : "יצירת מבחן והמשך לשיוך"}
        </Button>
      </Card>
    </div>
  );
}
