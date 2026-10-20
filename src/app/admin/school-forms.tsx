"use client";
import { useActionState } from "react";
import { createSchoolAction, updateRetentionAction } from "./actions";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Badge } from "@/components/ui/badge";

function Retention({ id, value }: { id: string; value: number | null }) {
  const [state, action] = useActionState(updateRetentionAction.bind(null, id), undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <Input name="days" type="number" min={0} max={3650} defaultValue={value ?? ""} placeholder="ברירת מחדל" className="h-8 w-28 text-sm" aria-label="ימי שמירה" />
      <SubmitButton size="sm" variant="secondary">
        שמירה
      </SubmitButton>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      {state?.ok && <span className="text-xs text-ok">{state.ok}</span>}
    </form>
  );
}

export function SchoolForms({ schools }: { schools: { id: string; name: string; code: string; retention: number | null; users: number; classes: number; demo: boolean }[] }) {
  const [state, action] = useActionState(createSchoolAction, undefined);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-subtle/70 text-xs text-ink-3">
            <tr>
              <th className="px-5 py-2.5 text-start font-medium">שם</th>
              <th className="px-3 py-2.5 text-start font-medium">קוד מורים</th>
              <th className="px-3 py-2.5 text-start font-medium">משתמשים</th>
              <th className="px-3 py-2.5 text-start font-medium">כיתות</th>
              <th className="px-5 py-2.5 text-start font-medium">שמירת הקלטות (ימים, 0 = לצמיתות)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {schools.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3 font-medium">
                  {s.name} {s.demo && <Badge tone="warn">הדגמה</Badge>}
                </td>
                <td className="px-3 py-3 font-mono" dir="ltr">
                  {s.code}
                </td>
                <td className="px-3 py-3 tabular">{s.users}</td>
                <td className="px-3 py-3 tabular">{s.classes}</td>
                <td className="px-5 py-3">
                  <Retention id={s.id} value={s.retention} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={action} className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
        <Input name="name" placeholder="שם בית ספר חדש" className="max-w-xs" required />
        <SubmitButton variant="secondary">יצירה</SubmitButton>
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      </form>
    </div>
  );
}
