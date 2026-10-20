import Link from "next/link";
import { env } from "@/lib/env";
import { Alert } from "@/components/ui/alert";
import { RegisterForm } from "./register-form";

export const metadata = { title: "הרשמת מורה" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">יצירת חשבון מורה</h1>
      <p className="mt-1 text-[15px] text-ink-2">חשבון אחד לניהול כיתות, מבחנים, הגשות ומשוב.</p>
      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        {env.allowTeacherSignup ? <RegisterForm /> : <Alert tone="warn" title="ההרשמה העצמית סגורה">פנו למנהל המערכת ליצירת חשבון.</Alert>}
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
