import Link from "next/link";
import { env } from "@/lib/env";
import { Alert } from "@/components/ui/alert";
import { InAppBrowserHint } from "@/components/in-app-browser-hint";
import { RegisterForm } from "./register-form";
import { GoogleRegister } from "./google-register";

export const metadata = { title: "הרשמת מורה" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">פתיחת חשבון מורה</h1>
      <p className="mt-1 text-[15px] text-ink-2">חשבון אחד לכיתות, למבחנים ולבדיקת ההקלטות. בחינם.</p>
      <div className="mt-6 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        {!env.allowTeacherSignup ? (
          <Alert tone="warn" title="ההרשמה העצמית סגורה">
            פנו למנהל המערכת ליצירת חשבון.
          </Alert>
        ) : env.googleEnabled ? (
          <>
            <InAppBrowserHint />
            <GoogleRegister />
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-3 hover:text-ink">הרשמה עם סיסמה במקום Google</summary>
              <div className="mt-4">
                <RegisterForm />
              </div>
            </details>
          </>
        ) : (
          <RegisterForm />
        )}
      </div>
      <p className="mt-6 text-sm text-ink-2">
        כבר יש לך חשבון?{" "}
        <Link className="font-medium text-brand hover:underline" href="/login">
          התחברות
        </Link>
      </p>
    </div>
  );
}
