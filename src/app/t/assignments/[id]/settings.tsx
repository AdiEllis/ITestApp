"use client";
import { useActionState } from "react";
import { updateAssignmentAction } from "../../_actions/assignments";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function AssignmentSettings({ id, dueAt, allowLate, maxAttempts }: { id: string; dueAt: string; allowLate: boolean; maxAttempts: number | null }) {
  const [state, action] = useActionState(updateAssignmentAction.bind(null, id), undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="מועד הגשה" htmlFor="dueAt" hint="ריק = ללא מועד">
        <Input id="dueAt" name="dueAt" type="datetime-local" dir="ltr" defaultValue={dueAt} />
      </Field>
      <Field label="מספר ניסיונות מרבי" htmlFor="maxAttempts" hint="ריק = ללא הגבלה">
        <Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={50} defaultValue={maxAttempts ?? ""} />
      </Field>
      <Checkbox name="allowLate" defaultChecked={allowLate} label="לאפשר הגשה באיחור" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm">
        שמירה
      </SubmitButton>
    </form>
  );
}
