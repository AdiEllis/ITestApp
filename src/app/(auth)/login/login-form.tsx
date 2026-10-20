"use client";
import { useActionState } from "react";
import { loginAction } from "../actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="שם משתמש או דוא״ל" htmlFor="identifier">
        <Input id="identifier" name="identifier" autoComplete="username" dir="ltr" required autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field label="סיסמה" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="מתחבר…">
        התחברות
      </SubmitButton>
      <p className="text-[13px] text-ink-3">שכחתם סיסמה? תלמידים — פנו למורה. מורים — פנו למנהל המערכת בבית הספר.</p>
    </form>
  );
}
