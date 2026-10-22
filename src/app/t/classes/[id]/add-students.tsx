"use client";
import { useActionState, useState } from "react";
import { Printer, UserPlus } from "lucide-react";
import { addExistingStudentAction, addStudentsAction, addStudentsByEmailAction } from "../../_actions/classes";
import { CopyButton } from "@/components/copy-button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export function AddStudents({ classroomId, className, google, joinUrl }: { classroomId: string; className: string; google: boolean; joinUrl: string }) {
  if (google) return <AddStudentsGoogle classroomId={classroomId} className={className} joinUrl={joinUrl} />;
  return <AddStudentsPassword classroomId={classroomId} className={className} />;
}

/** With Google sign-in: share one link (main way) or pre-add e-mails. */
function AddStudentsGoogle({ classroomId, className, joinUrl }: { classroomId: string; className: string; joinUrl: string }) {
  const [tab, setTab] = useState<"link" | "email">("link");
  const [state, action] = useActionState(addStudentsByEmailAction.bind(null, classroomId), undefined);
  const wa = `https://wa.me/?text=${encodeURIComponent(`הצטרפות לכיתה ${className} לתרגול בעל פה באנגלית:\n${joinUrl}`)}`;
  return (
    <Card>
      <CardHeader title="הוספת תלמידים" description="התלמידים נכנסים עם חשבון ה־Google שלהם — בלי שם משתמש ובלי סיסמה" />
      <div className="p-5">
        <div className="mb-4 inline-flex rounded-lg bg-subtle p-1 text-sm">
          {(
            [
              ["link", "שליחת קישור לכיתה (מומלץ)"],
              ["email", "הוספה לפי מייל"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)} className={cn("h-8 rounded-md px-3 font-medium", tab === v ? "bg-surface shadow-sm" : "text-ink-2")} aria-pressed={tab === v}>
              {l}
            </button>
          ))}
        </div>
        {tab === "link" ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 ps-5 text-[15px] text-ink-2">
              <li>שלחו את הקישור לקבוצת הכיתה (וואטסאפ / Classroom / מייל).</li>
              <li>כל תלמיד/ה לוחץ/ת על הקישור ועל &quot;הצטרפות עם Google&quot;.</li>
              <li>זהו — הם מופיעים ברשימה למעלה.</li>
            </ol>
            <div className="rounded-xl border border-line bg-subtle px-4 py-3 text-sm" dir="ltr">
              <span className="break-all text-ink-2">{joinUrl}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={joinUrl} label="העתקת הקישור" />
              <a href={wa} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1f9d55] px-3 text-sm font-medium text-white hover:bg-[#188046]">
                שליחה בוואטסאפ
              </a>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <Field label="כתובות המייל של התלמידים" htmlFor="emails" hint="כתובת אחת בכל שורה. אפשר להוסיף שם לפני הכתובת: נועה כהן, noa@gmail.com">
              <Textarea id="emails" name="emails" rows={5} dir="ltr" placeholder={"noa.cohen@gmail.com\nיוסף לוי, yosef@gmail.com"} />
            </Field>
            <FormMessage state={state} />
            <SubmitButton pendingText="מוסיף…">
              <UserPlus className="size-4" /> הוספה לכיתה
            </SubmitButton>
            <p className="text-[13px] text-ink-3">התלמידים יתחברו עם &quot;התחברות עם Google&quot; באותה כתובת — לא צריך לשלוח להם סיסמה.</p>
          </form>
        )}
      </div>
    </Card>
  );
}

function AddStudentsPassword({ classroomId, className }: { classroomId: string; className: string }) {
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [state, action] = useActionState(addStudentsAction.bind(null, classroomId), undefined);
  const [existingState, existingAction] = useActionState(addExistingStudentAction.bind(null, classroomId), undefined);
  return (
    <Card>
      <CardHeader title="הוספת תלמידים" description="המערכת יוצרת שם משתמש וסיסמה זמנית לכל תלמיד/ה" />
      <div className="p-5">
        <div className="mb-4 inline-flex rounded-lg bg-subtle p-1 text-sm">
          {(
            [
              ["new", "תלמידים חדשים"],
              ["existing", "תלמיד/ה קיים/ת בבית הספר"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)} className={cn("h-8 rounded-md px-3 font-medium", tab === v ? "bg-surface shadow-sm" : "text-ink-2")} aria-pressed={tab === v}>
              {l}
            </button>
          ))}
        </div>
        {tab === "new" ? (
          <form action={action} className="space-y-4">
            <Field label="שמות התלמידים" htmlFor="names" hint="שם אחד בכל שורה. עד 60 בכל פעם.">
              <Textarea id="names" name="names" rows={5} placeholder={"נועה כהן\nיוסף לוי"} />
            </Field>
            <FormMessage state={state} />
            <SubmitButton pendingText="יוצר חשבונות…">
              <UserPlus className="size-4" /> יצירת חשבונות
            </SubmitButton>
          </form>
        ) : (
          <form action={existingAction} className="flex flex-wrap items-end gap-3">
            <Field label="שם משתמש" htmlFor="existing-username" className="min-w-52 flex-1">
              <Input id="existing-username" name="username" dir="ltr" required />
            </Field>
            <SubmitButton variant="secondary">הוספה לכיתה</SubmitButton>
            <div className="w-full">
              <FormMessage state={existingState} />
            </div>
          </form>
        )}

        {state?.created && state.created.length > 0 && (
          <div className="mt-6 space-y-3" id="credentials">
            <Alert tone="warn" title="שמרו או הדפיסו את הפרטים עכשיו">
              הסיסמאות הזמניות מוצגות פעם אחת בלבד. בכניסה הראשונה התלמידים יתבקשו לבחור סיסמה אישית.
            </Alert>
            <div className="overflow-hidden rounded-xl border border-line print:border-0">
              <div className="hidden p-3 text-lg font-semibold print:block">פרטי כניסה – {className}</div>
              <table className="w-full text-sm">
                <thead className="bg-subtle text-xs text-ink-3">
                  <tr>
                    <th className="px-4 py-2 text-start font-medium">שם</th>
                    <th className="px-4 py-2 text-start font-medium">שם משתמש</th>
                    <th className="px-4 py-2 text-start font-medium">סיסמה זמנית</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {state.created.map((c) => (
                    <tr key={c.username}>
                      <td className="px-4 py-2">{c.name}</td>
                      <td className="px-4 py-2 font-mono" dir="ltr">
                        {c.username}
                      </td>
                      <td className="px-4 py-2 font-mono" dir="ltr">
                        {c.password}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> הדפסה
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
