"use client";
import { useActionState, useState, useTransition } from "react";
import { adminResetPasswordAction, createStaffAction, deleteUserAction, setUserActiveAction } from "../actions";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CreateStaff({ schools }: { schools: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createStaffAction, undefined);
  const [role, setRole] = useState("TEACHER");
  return (
    <form action={action} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_140px_1fr_auto] sm:items-end">
      <Input name="name" placeholder="שם מלא" required aria-label="שם" />
      <Input name="email" type="email" dir="ltr" placeholder="email@school.org.il" required aria-label="דוא״ל" />
      <Select name="role" value={role} onChange={(e) => setRole(e.target.value)} aria-label="תפקיד">
        <option value="TEACHER">מורה</option>
        <option value="ADMIN">מנהל/ת</option>
      </Select>
      <Select name="schoolId" disabled={role !== "TEACHER"} aria-label="בית ספר" defaultValue="">
        <option value="">בית ספר…</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <SubmitButton>יצירה</SubmitButton>
      <div className="sm:col-span-5">
        {state?.password ? (
          <Alert tone="warn" title="סיסמה זמנית (מוצגת פעם אחת)">
            <span dir="ltr" className="font-mono">
              {state.password}
            </span>
          </Alert>
        ) : (
          <FormMessage state={state} />
        )}
      </div>
    </form>
  );
}

export function UserRowActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {pw && (
        <span className="rounded bg-warn-soft px-2 py-1 font-mono text-xs" dir="ltr">
          {pw}
        </span>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setPw((await adminResetPasswordAction(id)).password ?? null))}>
        איפוס סיסמה
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setUserActiveAction(id, !active))}>
        {active ? "השבתה" : "הפעלה"}
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm(`למחוק לצמיתות את ${name} וכל הנתונים וההקלטות שלו/ה?`)) start(() => deleteUserAction(id));
        }}
      >
        מחיקה
      </Button>
    </div>
  );
}
