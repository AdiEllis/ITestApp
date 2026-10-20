"use client";
import { useActionState } from "react";
import { changePasswordAction } from "../actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="סיסמה נוכחית / זמנית" htmlFor="current">
        <Input id="current" name="current" type="password" dir="ltr" autoComplete="current-password" required />
      </Field>
      <Field label="סיסמה חדשה" htmlFor="password" hint="לפחות 8 תווים, אותיות ומספרים">
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="אימות סיסמה חדשה" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" dir="ltr" autoComplete="new-password" required minLength={8} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="שומר…">
        שמירת סיסמה
      </SubmitButton>
    </form>
  );
}
