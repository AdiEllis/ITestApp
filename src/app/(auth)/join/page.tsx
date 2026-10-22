import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { GOOGLE_ERRORS } from "@/lib/google-login";
import { GoogleButton } from "@/components/google-button";
import { InAppBrowserHint } from "@/components/in-app-browser-hint";
import { Alert } from "@/components/ui/alert";
import { JoinForm } from "./join-form";
import { CodeForm } from "./code-form";

export const metadata = { title: "הצטרפות לכיתה" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string; error?: string }> }) {
  const { code, error } = await searchParams;
  const classroom = code ? await db.classroom.findUnique({ where: { joinCode: code.toUpperCase() }, select: { name: true, joinEnabled: true, archived: true, school: { select: { name: true } } } }) : null;
  const valid = classroom && classroom.joinEnabled && !classroom.archived;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{valid ? `הצטרפות ל${classroom.name}` : "הצטרפות לכיתה"}</h1>
      <p className="mt-1 text-[15px] text-ink-2">{valid ? classroom.school.name : "הזינו את הקוד שקיבלתם מהמורה."}</p>
      <div className="mt-6 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        {error && <Alert tone="danger">{GOOGLE_ERRORS[error] ?? GOOGLE_ERRORS.failed}</Alert>}
        {code && !valid && <Alert tone="danger">קוד הכיתה אינו תקין או שההצטרפות סגורה. בקשו מהמורה קישור חדש.</Alert>}
        {!valid ? (
          <CodeForm />
        ) : env.googleEnabled ? (
          <>
            <InAppBrowserHint />
            <GoogleButton params={{ intent: "student", code }} label="הצטרפות עם Google" />
            <p className="text-[13px] text-ink-3">בפעם הבאה פשוט נכנסים עם אותו חשבון Google — בלי סיסמה.</p>
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-3 hover:text-ink">אין לי חשבון Google / זה לא עובד</summary>
              <div className="mt-4">
                <JoinForm code={code} />
              </div>
            </details>
          </>
        ) : (
          <JoinForm code={code} />
        )}
      </div>
      <p className="mt-6 text-sm text-ink-2">
        כבר הצטרפת?{" "}
        <Link className="font-medium text-brand hover:underline" href="/login">
          התחברות
        </Link>
      </p>
    </div>
  );
}
