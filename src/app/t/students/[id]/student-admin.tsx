"use client";
import { useActionState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { deleteStudentAction, resetStudentPasswordAction } from "../../_actions/classes";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { FormMessage } from "@/components/ui/form-message";

export function StudentAdmin({ studentId, name }: { studentId: string; name: string }) {
  const [reset, resetAction] = useActionState(resetStudentPasswordAction.bind(null, studentId), undefined);
  const [del, delAction] = useActionState(deleteStudentAction.bind(null, studentId), undefined);
  return (
    <Card className="mt-6">
      <CardHeader title="ניהול חשבון" />
      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <form action={resetAction} className="space-y-3">
          <p className="text-sm text-ink-2">יצירת סיסמה זמנית חדשה. התלמיד/ה יתבקש/תבקש לבחור סיסמה אישית בכניסה הבאה.</p>
          <SubmitButton variant="secondary" size="sm">
            <KeyRound className="size-4" /> איפוס סיסמה
          </SubmitButton>
          {reset?.password && (
            <Alert tone="warn" title="סיסמה זמנית (מוצגת פעם אחת)">
              <span dir="ltr" className="font-mono">
                {reset.username} / {reset.password}
              </span>
            </Alert>
          )}
          {reset?.error && <FormMessage state={reset} />}
        </form>
        <form
          action={delAction}
          className="space-y-3"
          onSubmit={(e) => {
            if (!confirm(`למחוק לצמיתות את ${name}, כל ההגשות וההקלטות? לא ניתן לשחזר.`)) e.preventDefault();
          }}
        >
          <p className="text-sm text-ink-2">מחיקה מלאה של החשבון, ההגשות, הציונים וכל ההקלטות מהאחסון.</p>
          <SubmitButton variant="danger" size="sm">
            <Trash2 className="size-4" /> מחיקת תלמיד/ה ונתונים
          </SubmitButton>
          <FormMessage state={del} />
        </form>
      </div>
    </Card>
  );
}
