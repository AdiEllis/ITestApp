"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { FileUp, LayoutTemplate, PenLine } from "lucide-react";
import { createExamAction } from "../../_actions/exams";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";
import { SIMULATION_DISCLAIMER } from "@/lib/cobe";

export function NewExamForm() {
  const [state, action] = useActionState(createExamAction, undefined);
  const [start, setStart] = useState<"cobe" | "blank">("cobe");
  const [mode, setMode] = useState<"PRACTICE" | "SIMULATION">("SIMULATION");
  const options = [
    { v: "cobe" as const, icon: LayoutTemplate, title: "מבנה COBE", body: "שלושה חלקים: Personal Response (בחירת נושא), Project ו־Audio-Visual עם שני סטים של שאלות. כולל שאלות לדוגמה לעריכה." },
    { v: "blank" as const, icon: PenLine, title: "מבחן ריק", body: "בנו מבנה חופשי — מתאים לתרגול קצר וממוקד." },
  ];
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="start" value={start} />
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => {
              setStart(o.v);
              setMode(o.v === "cobe" ? "SIMULATION" : "PRACTICE");
            }}
            aria-pressed={start === o.v}
            className={cn(
              "rounded-[var(--radius-card)] border bg-surface p-4 text-start transition-colors",
              start === o.v ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-line-strong",
            )}
          >
            <o.icon className={cn("size-5", start === o.v ? "text-brand" : "text-ink-3")} />
            <p className="mt-2 font-semibold">{o.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{o.body}</p>
          </button>
        ))}
        <Link href="/t/exams/import" className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-start hover:border-line-strong">
          <FileUp className="size-5 text-ink-3" />
          <p className="mt-2 font-semibold">העלאת מבחן מוכן</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">PDF, Word, שמע או וידאו — והפיכתם למבחן אינטראקטיבי.</p>
        </Link>
      </div>
      <Card className="space-y-4 p-5">
        <Field label="שם המבחן" htmlFor="title">
          <Input id="title" name="title" required placeholder="לדוגמה: סימולציה 1 – Technology" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="רמה" htmlFor="level">
            <Select id="level" name="level" defaultValue="FOUR_AND_FIVE">
              <option value="FOUR_AND_FIVE">4 ו־5 יח״ל</option>
              <option value="FIVE_POINTS">5 יח״ל</option>
              <option value="FOUR_POINTS">4 יח״ל</option>
              <option value="OTHER">אחר</option>
            </Select>
          </Field>
          <Field label="מצב" htmlFor="mode" hint={mode === "SIMULATION" ? "זמני הכנה, מגבלת זמן כוללת, ללא חזרה אחורה" : "ללא מגבלת זמן, מעבר חופשי בין שאלות"}>
            <Select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="SIMULATION">סימולציה</option>
              <option value="PRACTICE">תרגול</option>
            </Select>
          </Field>
        </div>
        {start === "cobe" && (
          <Alert tone="info" title="על מבנה ה־COBE בתבנית">
            המבנה וזמני ברירת המחדל מבוססים על פרסומים ציבוריים של משרד החינוך. יש לוודא מול ההנחיות העדכניות. {SIMULATION_DISCLAIMER}
          </Alert>
        )}
        {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
        <SubmitButton pendingText="יוצר…">יצירה והמשך לעריכה</SubmitButton>
      </Card>
    </form>
  );
}
