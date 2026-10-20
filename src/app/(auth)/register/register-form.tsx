"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { registerTeacherAction } from "../actions";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/components/ui/cn";

export function RegisterForm() {
  const [state, action] = useActionState(registerTeacherAction, undefined);
  const [mode, setMode] = useState<"new" | "join">("new");
  return (
    <form action={action} className="space-y-4">
      <Field label="שם מלא" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="דוא״ל" htmlFor="email" hint="משמש להתחברות">
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>
      <Field label="סיסמה" htmlFor="password" hint="לפחות 8 תווים, אותיות ומספרים">
        <Input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" required minLength={8} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">בית ספר</legend>
        <input type="hidden" name="schoolMode" value={mode} />
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1" role="radiogroup">
          {(
            [
              ["new", "בית ספר חדש"],
              ["join", "יש לי קוד בית ספר"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={mode === v}
              onClick={() => setMode(v)}
              className={cn("h-9 rounded-md text-sm font-medium transition-colors", mode === v ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "new" ? (
          <Field label="שם בית הספר" htmlFor="schoolName">
            <Input id="schoolName" name="schoolName" required />
          </Field>
        ) : (
          <Field label="קוד בית הספר" htmlFor="inviteCode" hint="מקבלים ממורה אחר בבית הספר או ממנהל המערכת">
            <Input id="inviteCode" name="inviteCode" dir="ltr" className="uppercase tracking-widest" required />
          </Field>
        )}
      </fieldset>
      <Checkbox
        name="terms"
        required
        label={
          <>
            קראתי ואני מסכימ/ה ל<Link href="/privacy" className="text-brand hover:underline" target="_blank">מדיניות הפרטיות ותנאי השימוש</Link>
          </>
        }
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="יוצר חשבון…">
        יצירת חשבון
      </SubmitButton>
    </form>
  );
}
