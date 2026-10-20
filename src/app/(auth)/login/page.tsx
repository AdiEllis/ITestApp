import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "התחברות" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">התחברות</h1>
      <p className="mt-1 text-[15px] text-ink-2">תרגול הבחינה בעל פה באנגלית — למורים ולתלמידים.</p>
      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <LoginForm next={next} />
      </div>
      <div className="mt-6 grid gap-2 text-sm text-ink-2">
        <p>
          תלמידים עם קוד כיתה?{" "}
          <Link className="font-medium text-brand hover:underline" href="/join">
            הצטרפות לכיתה
          </Link>
        </p>
        <p>
          מורים חדשים?{" "}
          <Link className="font-medium text-brand hover:underline" href="/register">
            יצירת חשבון מורה
          </Link>
        </p>
      </div>
    </div>
  );
}
