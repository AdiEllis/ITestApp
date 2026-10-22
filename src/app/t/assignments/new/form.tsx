"use client";
import { useActionState, useState } from "react";
import { createAssignmentAction } from "../../_actions/assignments";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/components/ui/cn";

export function AssignForm({
  exams,
  classes,
  defaultExamId,
  defaultClassroomId,
}: {
  exams: { id: string; title: string; mode: string }[];
  classes: { id: string; name: string; students: { id: string; name: string }[] }[];
  defaultExamId?: string;
  defaultClassroomId?: string;
}) {
  const [state, action] = useActionState(createAssignmentAction, undefined);
  const [examId, setExamId] = useState(exams.find((e) => e.id === defaultExamId)?.id ?? exams[0].id);
  const [classId, setClassId] = useState(classes.find((c) => c.id === defaultClassroomId)?.id ?? classes[0].id);
  const [target, setTarget] = useState<"class" | "students">("class");
  const [where, setWhere] = useState<"anywhere" | "classroom">("anywhere");
  const exam = exams.find((e) => e.id === examId);
  const cls = classes.find((c) => c.id === classId)!;
  return (
    <form action={action} className="space-y-5">
      <Field label="מבחן" htmlFor="examId">
        <Select id="examId" name="examId" value={examId} onChange={(e) => setExamId(e.target.value)}>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} ({e.mode === "SIMULATION" ? "מבחן" : "תרגול"})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="כיתה" htmlFor="classroomId">
        <Select id="classroomId" name="classroomId" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length} תלמידים)
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">איפה עושים את המבחן?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["anywhere", "בכל מקום", "בבית או בכיתה, מכל מחשב או טלפון."],
              ["classroom", "בכיתה, במחשב נעול", "רק בתוכנה Safe Exam Browser, בלי גישה לאתרים אחרים. מתאים למבחן עם משגיח/ה."],
            ] as const
          ).map(([v, title, body]) => (
            <label key={v} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", where === v ? "border-brand bg-brand-soft/40" : "border-line hover:border-line-strong")}>
              <input type="radio" name="where" className="mt-1 accent-brand" checked={where === v} onChange={() => setWhere(v)} />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-ink-2">{body}</span>
              </span>
            </label>
          ))}
        </div>
        {where === "classroom" && (
          <>
            <input type="hidden" name="requireSeb" value="on" />
            <Field label="סיסמת יציאה למשגיח/ה (לא חובה)" htmlFor="sebQuitPassword" hint="ריק = המערכת תבחר סיסמה בת 6 ספרות. תופיע בעמוד המשימה.">
              <Input id="sebQuitPassword" name="sebQuitPassword" dir="ltr" inputMode="numeric" autoComplete="off" className="max-w-48" />
            </Field>
          </>
        )}
      </fieldset>
      <Field label="עד מתי להגיש? (לא חובה)" htmlFor="dueAt" hint="אפשר להשאיר ריק">
        <Input id="dueAt" name="dueAt" type="datetime-local" dir="ltr" />
      </Field>
      <details className="rounded-xl border border-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-2 hover:text-ink">עוד אפשרויות (לא חובה)</summary>
        <div className="space-y-5 border-t border-line p-4">
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">למי</legend>
            <input type="hidden" name="target" value={target} />
            <div className="inline-flex rounded-lg bg-subtle p-1 text-sm">
              {(
                [
                  ["class", "כל הכיתה"],
                  ["students", "תלמידים מסוימים"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTarget(v)} aria-pressed={target === v} className={cn("h-8 rounded-md px-3 font-medium", target === v ? "bg-surface shadow-sm" : "text-ink-2")}>
                  {l}
                </button>
              ))}
            </div>
            {target === "students" && (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-line p-3">
                {cls.students.length === 0 ? <p className="text-sm text-ink-3">אין תלמידים בכיתה</p> : cls.students.map((s) => <Checkbox key={s.id} name="studentIds" value={s.id} label={s.name} />)}
              </div>
            )}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="נפתח ב־" htmlFor="opensAt" hint="ריק = מיד">
              <Input id="opensAt" name="opensAt" type="datetime-local" dir="ltr" />
            </Field>
            <Field label="מספר ניסיונות מרבי" htmlFor="maxAttempts" hint="ריק = ללא הגבלה">
              <Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={50} defaultValue={exam?.mode === "SIMULATION" ? 1 : ""} key={examId} />
            </Field>
          </div>
          <Checkbox name="allowLate" defaultChecked label="לאפשר הגשה באיחור" />
          <Field label="הודעה לתלמידים" htmlFor="instructions">
            <Textarea id="instructions" name="instructions" rows={2} />
          </Field>
        </div>
      </details>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText="שולח…">שליחה לכיתה</SubmitButton>
    </form>
  );
}
