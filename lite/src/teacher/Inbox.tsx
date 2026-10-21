import { useRef, useState } from "react";
import { ClipboardCheck, FileUp, Trash2, UploadCloud } from "lucide-react";
import { useStore } from "../lib/use-store";
import { submissions } from "../lib/store";
import { unpackSubmission } from "../lib/codec";
import { Card, PageHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert } from "../ui/alert";
import { EmptyState } from "../ui/empty-state";
import { formatDateTime, formatScore } from "../lib/format";
import { cn } from "../ui/cn";

export function Inbox() {
  const list = useStore(() => submissions.list());
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [report, setReport] = useState<{ ok: string[]; failed: { name: string; error: string }[] } | null>(null);
  const [filter, setFilter] = useState<{ exam: string; cls: string; status: string }>({ exam: "", cls: "", status: "" });

  async function importFiles(files: FileList | File[]) {
    const ok: string[] = [];
    const failed: { name: string; error: string }[] = [];
    for (const f of Array.from(files)) {
      try {
        const s = await unpackSubmission(f);
        const existing = await submissions.get(s.id);
        // Re-importing the same file keeps the teacher's grading.
        await submissions.save(existing ? { ...s, grading: existing.grading } : s);
        ok.push(`${s.studentName} – ${s.exam.title}${existing ? " (עודכן)" : ""}`);
      } catch (e) {
        failed.push({ name: f.name, error: (e as Error).message });
      }
    }
    setReport({ ok, failed });
  }

  const all = list ?? [];
  const examsSeen = [...new Map(all.map((s) => [s.exam.id, s.exam.title])).entries()];
  const classes = [...new Set(all.map((s) => s.className).filter(Boolean))];
  const shown = all.filter(
    (s) =>
      (!filter.exam || s.exam.id === filter.exam) &&
      (!filter.cls || s.className === filter.cls) &&
      (!filter.status || (filter.status === "pending" ? s.grading?.status !== "done" : s.grading?.status === "done")),
  );

  return (
    <>
      <PageHeader title="הגשות ובדיקה" description="ייבאו את קובצי ההגשה שהתלמידים שלחו (וואטסאפ, מייל, Drive…). אפשר לבחור כמה קבצים יחד." />
      <Card className="mb-6 p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void importFiles(e.dataTransfer.files);
          }}
          className={cn("flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center", drag ? "border-brand bg-brand-soft" : "border-line-strong")}
        >
          <UploadCloud className="size-8 text-ink-3" />
          <p className="mt-2 font-medium">גררו לכאן קובצי הגשה</p>
          <p className="mt-1 text-sm text-ink-3">קבצים בשם "שם התלמיד - שם המבחן.html"</p>
          <input ref={input} type="file" multiple accept=".html,.htm,text/html" className="hidden" onChange={(e) => e.target.files && importFiles(e.target.files).then(() => (e.target.value = ""))} />
          <Button variant="secondary" className="mt-4" onClick={() => input.current?.click()}>
            <FileUp className="size-4" /> בחירת קבצים
          </Button>
        </div>
        {report && (
          <div className="mt-4 space-y-2">
            {report.ok.length > 0 && <Alert tone="ok" title={`יובאו ${report.ok.length} הגשות`}>{report.ok.join(" · ")}</Alert>}
            {report.failed.map((f) => (
              <Alert key={f.name} tone="danger" title={f.name}>
                {f.error}
              </Alert>
            ))}
          </div>
        )}
      </Card>

      {all.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <select aria-label="מבחן" className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" value={filter.exam} onChange={(e) => setFilter({ ...filter, exam: e.target.value })}>
            <option value="">כל המבחנים</option>
            {examsSeen.map(([id, t]) => (
              <option key={id} value={id}>
                {t}
              </option>
            ))}
          </select>
          {classes.length > 0 && (
            <select aria-label="כיתה" className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" value={filter.cls} onChange={(e) => setFilter({ ...filter, cls: e.target.value })}>
              <option value="">כל הכיתות</option>
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <select aria-label="סטטוס" className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">הכול</option>
            <option value="pending">ממתינות לבדיקה</option>
            <option value="done">נבדקו</option>
          </select>
        </div>
      )}
      <Card>
        {shown.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={all.length ? "אין הגשות בסינון הזה" : "עדיין אין הגשות"} body={all.length ? undefined : "שלחו לתלמידים קישור למבחן. בסיום הם ישלחו לכם קובץ — ייבאו אותו כאן."} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                <a href={`#/t/review/${encodeURIComponent(s.id)}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{s.studentName.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.studentName} <span className="font-normal text-ink-3">·</span> <span dir="auto">{s.exam.title}</span>
                    </p>
                    <p className="text-sm text-ink-3">
                      {s.className ? `${s.className} · ` : ""}
                      {formatDateTime(s.submittedAt)} · {Object.keys(s.answers).length} הקלטות
                    </p>
                  </div>
                  {s.grading?.status === "done" ? (
                    <span className="font-semibold tabular">{formatScore(s.grading.total)}</span>
                  ) : s.grading?.status === "draft" ? (
                    <Badge tone="warn">טיוטה</Badge>
                  ) : (
                    <Badge tone="brand">לבדיקה</Badge>
                  )}
                </a>
                <button
                  type="button"
                  aria-label={`מחיקת ההגשה של ${s.studentName}`}
                  className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-subtle hover:text-danger"
                  onClick={() => confirm(`למחוק את ההגשה של ${s.studentName}?`) && submissions.remove(s.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
