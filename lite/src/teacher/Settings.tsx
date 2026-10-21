import { useEffect, useRef, useState } from "react";
import { Download, Plus, RotateCcw, ShieldCheck, Trash2, Upload } from "lucide-react";
import type { Criterion } from "../lib/types";
import { all, del, requestPersistence, settings } from "../lib/store";
import { useStore } from "../lib/use-store";
import { exportBackup, importBackup } from "../lib/backup";
import { download } from "../lib/codec";
import { defaultCobeRubric } from "../lib/cobe";
import { formatDateTime } from "../lib/format";
import { Card, CardHeader, PageHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { Field, Input } from "../ui/field";

export function Settings() {
  return (
    <>
      <PageHeader title="גיבוי והגדרות" description="כל הנתונים נשמרים בדפדפן הזה בלבד — בלי שרת ובלי חשבון." />
      <div className="space-y-6">
        <BackupCard />
        <RubricCard />
        <DangerCard />
      </div>
    </>
  );
}

function BackupCard() {
  const last = useStore(() => settings.lastBackup());
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  return (
    <Card>
      <CardHeader title="גיבוי" description={last ? `הגיבוי האחרון: ${formatDateTime(last)}` : "עדיין לא נשמר גיבוי"} />
      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-ink-2">
          קובץ הגיבוי כולל את המבחנים, ההגשות (כולל ההקלטות), הציונים וההגדרות. שמרו אותו מדי פעם (למשל ב־Google Drive). כדי לעבור למחשב אחר — שחזרו בו את קובץ הגיבוי.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                download(await exportBackup(), `oralprep-backup-${new Date().toISOString().slice(0, 10)}.json`);
                setMsg({ tone: "ok", text: "קובץ הגיבוי נשמר בהורדות" });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download className="size-4" /> שמירת גיבוי
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const r = await importBackup(f);
                setMsg({ tone: "ok", text: `שוחזרו ${r.exams} מבחנים ו־${r.submissions} הגשות` });
              } catch (err) {
                setMsg({ tone: "danger", text: (err as Error).message });
              }
            }}
          />
          <Button variant="secondary" onClick={() => input.current?.click()}>
            <Upload className="size-4" /> שחזור מגיבוי
          </Button>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {persisted === false && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-subtle px-3 py-2 text-sm text-ink-2">
            <ShieldCheck className="size-4 text-ink-3" />
            <span className="flex-1">אפשר לבקש מהדפדפן לא למחוק את הנתונים כשחסר מקום.</span>
            <Button size="sm" variant="secondary" onClick={async () => setPersisted(await requestPersistence())}>
              הגנה על הנתונים
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function RubricCard() {
  const stored = useStore(() => settings.rubric());
  const [rubric, setRubric] = useState<Criterion[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (stored !== undefined && rubric === null) setRubric(stored ?? defaultCobeRubric());
  }, [stored, rubric]);
  if (!rubric) return null;
  const sum = rubric.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const setC = (i: number, p: Partial<Criterion>) => setRubric((r) => r!.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <Card>
      <CardHeader title="מחוון הערכה" description="משמש לבדיקת כל השאלות. המשקלים הם ברירת מחדל לעריכה — יש לוודא מול המחוון הרשמי העדכני." />
      <div className="space-y-4 p-5">
        {rubric.map((c, i) => (
          <div key={c.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_110px_auto]">
            <Field label="קריטריון" htmlFor={`cl-${i}`}>
              <Input id={`cl-${i}`} lang="en" dir="ltr" value={c.label} onChange={(e) => setC(i, { label: e.target.value })} />
            </Field>
            <Field label="משקל (%)" htmlFor={`cw-${i}`}>
              <Input id={`cw-${i}`} type="number" min={0} max={100} value={c.weight} onChange={(e) => setC(i, { weight: Number(e.target.value) })} />
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" aria-label="מחיקת קריטריון" disabled={rubric.length <= 1} onClick={() => setRubric((r) => r!.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setRubric((r) => [
                ...r!,
                { key: `c${Date.now().toString(36)}`, label: "New criterion", weight: 0, description: "", bands: defaultCobeRubric()[0].bands.map((b) => ({ ...b, descriptor: "" })) },
              ])
            }
          >
            <Plus className="size-4" /> קריטריון
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRubric(defaultCobeRubric())}>
            <RotateCcw className="size-4" /> ברירת מחדל
          </Button>
          <span className={`text-sm tabular ${Math.abs(sum - 100) < 0.01 ? "text-ok" : "text-danger"}`}>סכום: {sum}%</span>
        </div>
        <Button
          disabled={Math.abs(sum - 100) > 0.01}
          onClick={async () => {
            await settings.setRubric(rubric);
            setMsg("המחוון נשמר");
          }}
        >
          שמירת מחוון
        </Button>
        {msg && <Alert tone="ok">{msg}</Alert>}
      </div>
    </Card>
  );
}

function DangerCard() {
  return (
    <Card>
      <CardHeader title="מחיקת נתונים" description="מוחק את כל המבחנים, ההגשות וההקלטות מהדפדפן הזה." />
      <div className="p-5">
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm("למחוק את כל הנתונים מהדפדפן הזה? מומלץ לשמור גיבוי קודם. לא ניתן לבטל.")) return;
            for (const store of ["exams", "submissions"] as const) {
              const keys = (await all<{ id: string }>(store)).map((x) => x.id);
              for (const k of keys) await del(store, k);
            }
          }}
        >
          <Trash2 className="size-4" /> מחיקת כל הנתונים
        </Button>
      </div>
    </Card>
  );
}
