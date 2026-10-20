import Link from "next/link";
import { JoinForm } from "./join-form";

export const metadata = { title: "הצטרפות לכיתה" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">הצטרפות לכיתה</h1>
      <p className="mt-1 text-[15px] text-ink-2">הזינו את הקוד שקיבלתם מהמורה ובחרו שם משתמש וסיסמה.</p>
      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <JoinForm code={code} />
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
