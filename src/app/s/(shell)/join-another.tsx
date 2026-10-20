"use client";
import { useActionState } from "react";
import { joinAnotherClassAction } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function JoinAnotherClass() {
  const [state, action] = useActionState(joinAnotherClassAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <Input name="code" dir="ltr" placeholder="קוד כיתה" aria-label="קוד כיתה" className="max-w-48 uppercase tracking-widest" required />
        <SubmitButton variant="secondary">הצטרפות</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
