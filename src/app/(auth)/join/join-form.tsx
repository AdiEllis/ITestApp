"use client";
import { useActionState } from "react";
import Link from "next/link";
import { joinClassAction } from "../actions";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function JoinForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinClassAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="קוד כיתה" htmlFor="code">
        <Input id="code" name="code" defaultValue={code} dir="ltr" className="uppercase tracking-[0.3em] text-center text-lg h-12" required autoCapitalize="characters" autoComplete="off" />
      </Field>
      <Field label="שם מלא" htmlFor="name" hint="כפי שהמורה מכיר/ה אותך">
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="שם משתמש" htmlFor="username" hint="באנגלית בלבד, ללא רווחים. אין צורך בדוא״ל.">
        <Input id="username" name="username" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} required pattern="[A-Za-z0-9._\-]{3,32}" />
      </Field>
      <Field label="סיסמה" htmlFor="password" hint="לפחות 8 תווים, אותיות ומספרים">
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required minLength={8} />
      </Field>
      <Checkbox name="terms" required label={<>קראתי את <Link href="/privacy" target="_blank" className="text-brand hover:underline">מדיניות הפרטיות</Link></>} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="מצטרף…">
        הצטרפות
      </SubmitButton>
    </form>
  );
}
