import { useState } from "react";
import { LayoutTemplate, PenLine } from "lucide-react";
import { newExam, SIMULATION_DISCLAIMER } from "../lib/cobe";
import { exams } from "../lib/store";
import { go } from "../lib/router";
import { Card, PageHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/field";
import { Alert } from "../ui/alert";
import { cn } from "../ui/cn";
import type { Exam } from "../lib/types";

export function NewExam() {
  const [start, setStart] = useState<"cobe" | "blank">("cobe");
  const [mode, setMode] = useState<Exam["mode"]>("SIMULATION");
  const [level, setLevel] = useState<Exam["level"]>("FOUR_AND_FIVE");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const options = [
    { v: "cobe" as const, icon: LayoutTemplate, t: "מבנה COBE", d: "Personal Response (בחירת נושא), Project ו־Audio-Visual עם שני סטים. כולל שאלות לדוגמה לעריכה." },
    { v: "blank" as const, icon: PenLine, t: "מבחן ריק", d: "מבנה חופשי — מתאים לתרגול קצר וממוקד." },
  ];
  async function create() {
    if (!title.trim()) return setError("יש להזין שם למבחן");
    const e = newExam(title.trim(), mode, level, start);
    await exams.save(e);
    go(`/t/exams/${e.id}`);
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="מבחן חדש" description="כל ההגדרות ניתנות לשינוי בהמשך." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={start === o.v}
            onClick={() => {
              setStart(o.v);
              setMode(o.v === "cobe" ? "SIMULATION" : "PRACTICE");
            }}
            className={cn("rounded-[var(--radius-card)] border bg-surface p-4 text-start", start === o.v ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-line-strong")}
          >
            <o.icon className={cn("size-5", start === o.v ? "text-brand" : "text-ink-3")} />
            <p className="mt-2 font-semibold">{o.t}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{o.d}</p>
          </button>
        ))}
      </div>
      <Card className="space-y-4 p-5">
        <Field label="שם המבחן" htmlFor="title">
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: סימולציה 1 – Technology" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="רמה" htmlFor="level">
            <Select id="level" value={level} onChange={(e) => setLevel(e.target.value as Exam["level"])}>
              <option value="FOUR_AND_FIVE">4 ו־5 יח״ל</option>
              <option value="FIVE_POINTS">5 יח״ל</option>
              <option value="FOUR_POINTS">4 יח״ל</option>
              <option value="OTHER">אחר</option>
            </Select>
          </Field>
          <Field label="מצב" htmlFor="mode" hint={mode === "SIMULATION" ? "זמני הכנה, מגבלת זמן כוללת, ללא חזרה אחורה" : "ללא מגבלת זמן, מעבר חופשי בין שאלות"}>
            <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value as Exam["mode"])}>
              <option value="SIMULATION">סימולציה</option>
              <option value="PRACTICE">תרגול</option>
            </Select>
          </Field>
        </div>
        {start === "cobe" && <Alert tone="info">המבנה וזמני ברירת המחדל מבוססים על פרסומים ציבוריים של משרד החינוך — יש לוודא מול ההנחיות העדכניות. {SIMULATION_DISCLAIMER}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Button onClick={create}>יצירה והמשך לעריכה</Button>
      </Card>
    </div>
  );
}
