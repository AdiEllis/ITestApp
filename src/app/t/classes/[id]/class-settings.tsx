"use client";
import { useActionState } from "react";
import { updateClassroomAction } from "../../_actions/classes";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function ClassSettings({ classroom }: { classroom: { id: string; name: string; gradeLevel: string | null; joinEnabled: boolean } }) {
  const [state, action] = useActionState(updateClassroomAction.bind(null, classroom.id), undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="שם הכיתה" htmlFor="cname">
        <Input id="cname" name="name" defaultValue={classroom.name} required />
      </Field>
      <Field label="שכבה / רמה" htmlFor="cgrade">
        <Input id="cgrade" name="gradeLevel" defaultValue={classroom.gradeLevel ?? ""} />
      </Field>
      <Checkbox name="joinEnabled" defaultChecked={classroom.joinEnabled} label="אפשר הצטרפות עם קוד" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="שומר…">
        שמירה
      </SubmitButton>
    </form>
  );
}
