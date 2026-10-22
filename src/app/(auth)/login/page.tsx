import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { env } from "@/lib/env";
import { GOOGLE_ERRORS } from "@/lib/google-login";
import { GoogleButton } from "@/components/google-button";
import { InAppBrowserHint } from "@/components/in-app-browser-hint";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata = { title: "התחברות" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next, error } = await searchParams;
  const google = env.googleEnabled;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">התחברות</h1>
      <p className="mt-1 text-[15px] text-ink-2">תרגול הבחינה בעל פה באנגלית — למורים ולתלמידים.</p>
      <div className="mt-6 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        {error && <Alert tone="danger">{GOOGLE_ERRORS[error] ?? GOOGLE_ERRORS.failed}</Alert>}
        <InAppBrowserHint />
        {google ? (
          <>
            <GoogleButton params={{ intent: "login", next }} />
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-3 hover:text-ink">כניסה עם שם משתמש וסיסמה</summary>
              <div className="mt-4">
                <LoginForm next={next} />
              </div>
            </details>
          </>
        ) : (
          <LoginForm next={next} />
        )}
      </div>
      <div className="mt-6 grid gap-2 text-sm text-ink-2">
        <p>
          <span className="font-medium text-ink">תלמידים בפעם הראשונה?</span> היכנסו דרך קישור ההצטרפות שקיבלתם מהמורה, או{" "}
          <Link className="font-medium text-brand hover:underline" href="/join">
            הקלידו קוד כיתה
          </Link>
          .
        </p>
        <p>
          <span className="font-medium text-ink">מורים חדשים?</span>{" "}
          <Link className="font-medium text-brand hover:underline" href="/register">
            פתיחת חשבון מורה
          </Link>
        </p>
      </div>
    </div>
  );
}
