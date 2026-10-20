"use client";
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { RubricCriterion } from "@/lib/exam-types";
import { deleteRubricAction, saveRubricAction } from "../../_actions/rubrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export function RubricEditor({ id, initial }: { id: string; initial: { name: string; description: string | null; criteria: RubricCriterion[] } }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [criteria, setCriteria] = useState(initial.criteria);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const sum = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const setC = (i: number, patch: Partial<RubricCriterion>) => setCriteria((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <Field label="שם" htmlFor="rname">
          <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="תיאור" htmlFor="rdesc">
          <Textarea id="rdesc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </Card>
      {criteria.map((c, i) => (
        <Card key={i} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
            <Field label="קריטריון" htmlFor={`cl-${i}`}>
              <Input id={`cl-${i}`} lang="en" dir="ltr" value={c.label} onChange={(e) => setC(i, { label: e.target.value })} />
            </Field>
            <Field label="משקל (%)" htmlFor={`cw-${i}`}>
              <Input id={`cw-${i}`} type="number" min={0} max={100} value={c.weight} onChange={(e) => setC(i, { weight: Number(e.target.value) })} />
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))} disabled={criteria.length <= 1} aria-label="מחיקת קריטריון">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <Field label="תיאור" htmlFor={`cd-${i}`}>
            <Input id={`cd-${i}`} lang="en" dir="ltr" value={c.description} onChange={(e) => setC(i, { description: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">רמות</p>
            {c.bands.map((b, k) => (
              <div key={k} className="grid grid-cols-[90px_64px_64px_1fr_auto] items-center gap-2">
                <Input aria-label="שם רמה" value={b.label} onChange={(e) => setC(i, { bands: c.bands.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} />
                <Input aria-label="מינימום" type="number" min={0} max={100} value={b.min} onChange={(e) => setC(i, { bands: c.bands.map((x, m) => (m === k ? { ...x, min: Number(e.target.value) } : x)) })} />
                <Input aria-label="מקסימום" type="number" min={0} max={100} value={b.max} onChange={(e) => setC(i, { bands: c.bands.map((x, m) => (m === k ? { ...x, max: Number(e.target.value) } : x)) })} />
                <Input aria-label="תיאור רמה" lang="en" dir="ltr" value={b.descriptor} onChange={(e) => setC(i, { bands: c.bands.map((x, m) => (m === k ? { ...x, descriptor: e.target.value } : x)) })} />
                <Button variant="ghost" size="sm" aria-label="מחיקת רמה" onClick={() => setC(i, { bands: c.bands.filter((_, m) => m !== k) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {c.bands.length < 8 && (
              <Button variant="ghost" size="sm" onClick={() => setC(i, { bands: [...c.bands, { label: "רמה", min: 0, max: 100, descriptor: "" }] })}>
                <Plus className="size-4" /> הוספת רמה
              </Button>
            )}
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {criteria.length < 10 && (
          <Button variant="secondary" onClick={() => setCriteria((cs) => [...cs, { key: `c${Date.now().toString(36)}`, label: "New criterion", weight: 0, description: "", bands: [] }])}>
            <Plus className="size-4" /> קריטריון
          </Button>
        )}
        <span className={`text-sm tabular ${Math.abs(sum - 100) < 0.01 ? "text-ok" : "text-danger"}`}>סכום משקלים: {sum}%</span>
      </div>
      {msg && <Alert tone={msg.ok ? "ok" : "danger"}>{msg.text}</Alert>}
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveRubricAction(id, { name, description: description || null, criteria });
              setMsg(r.ok ? { ok: true, text: "המחוון נשמר" } : { ok: false, text: r.error ?? "שגיאה" });
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} שמירה
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm("למחוק את המחוון? מבחנים שמשתמשים בו יעברו לציון ישיר.")) start(() => deleteRubricAction(id));
          }}
        >
          מחיקה
        </Button>
      </div>
    </div>
  );
}
