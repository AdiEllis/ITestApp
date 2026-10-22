"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { FileUp, LayoutTemplate, PenLine } from "lucide-react";
import { createExamAction } from "../../_actions/exams";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubjectInput } from "@/components/ui/subject-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";

export function NewExamForm() {
  const [state, action] = useActionState(createExamAction, undefined);
  const [start, setStart] = useState<"cobe" | "blank">("blank");
  const [mode, setMode] = useState<"PRACTICE" | "SIMULATION">("PRACTICE");
  const choices = [
    { v: "blank" as const, icon: PenLine, title: "מבחן חדש", body: "כותבים שאלות על החומר שנלמד עד עכשיו, בכל מקצוע. התלמידים שומעים כל שאלה ומקליטים תשובה.", badge: "מומלץ" },
    { v: "cobe" as const, icon: LayoutTemplate, title: "בגרות בעל פה באנגלית (COBE)", body: "שלושת החלקים של הבחינה באנגלית, עם שאלות לדוגמה שאפשר לשנות." },
  ];
  const modes = [
    { v: "PRACTICE" as const, title: "תרגול", body: "בלי לחץ זמן. אפשר לחזור לשאלות ולהקליט שוב." },
    { v: "SIMULATION" as const, title: "מבחן", body: "זמן הכנה לכל שאלה, הקלטה שמתחילה לבד וזמן כולל למבחן." },
  ];
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="mode" value={mode} />

      <section>
        <h2 className="mb-3 font-semibold">1. מה יוצרים?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {choices.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => {
                setStart(o.v);
                setMode(o.v === "cobe" ? "SIMULATION" : "PRACTICE");
              }}
              aria-pressed={start === o.v}
              className={cn("relative rounded-[var(--radius-card)] border bg-surface p-5 text-start transition-colors", start === o.v ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-line-strong")}
            >
              {o.badge && <span className="absolute end-4 top-4 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-strong">{o.badge}</span>}
              <o.icon className={cn("size-6", start === o.v ? "text-brand" : "text-ink-3")} />
              <p className="mt-3 text-[17px] font-semibold">{o.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{o.body}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-3">
          יש לך מבחן מוכן בקובץ (PDF / Word)?{" "}
          <Link href="/t/exams/import" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <FileUp className="size-3.5" /> העלאת מבחן מוכן
          </Link>
        </p>
      </section>

      <Card className="space-y-6 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <Field label="2. שם המבחן" htmlFor="title">
            <Input id="title" name="title" required placeholder="לדוגמה: מלחמת העולם הראשונה – פרק א" className="h-11 text-base" />
          </Field>
          {start === "blank" && (
            <Field label="מקצוע" htmlFor="subject">
              <SubjectInput id="subject" name="subject" placeholder="לדוגמה: היסטוריה" className="h-11 text-base" />
            </Field>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">3. איך התלמידים יענו?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {modes.map((m) => (
              <label key={m.v} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", mode === m.v ? "border-brand bg-brand-soft/40" : "border-line hover:border-line-strong")}>
                <input type="radio" name="modeChoice" className="mt-1 accent-brand" checked={mode === m.v} onChange={() => setMode(m.v)} />
                <span>
                  <span className="block font-medium">{m.title}</span>
                  <span className="block text-sm text-ink-2">{m.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
        <SubmitButton size="lg" pendingText="יוצר…">
          יצירה
        </SubmitButton>
        <p className="text-xs text-ink-3">הכול ניתן לשינוי אחר כך. זוהי מערכת תרגול עצמאית, ולא מערכת הבחינה הרשמית.</p>
      </Card>
    </form>
  );
}
