"use client";
import { useActionState } from "react";
import { createClassroomAction } from "../_actions/classes";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function CreateClassForm() {
  const [state, action] = useActionState(createClassroomAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="שם הכיתה" htmlFor="name">
        <Input id="name" name="name" placeholder="לדוגמה: י״א 3 – 5 יח״ל" required />
      </Field>
      <Field label="שכבה / רמה (לא חובה)" htmlFor="gradeLevel">
        <Input id="gradeLevel" name="gradeLevel" placeholder="י״א" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="יוצר…">
        יצירת כיתה
      </SubmitButton>
    </form>
  );
}
