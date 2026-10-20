import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
      <footer className="px-5 pb-6 text-center text-xs text-ink-3">
        מערכת תרגול עצמאית. אינה מערכת הבחינה הרשמית של משרד החינוך ואינה קשורה ל־iTest.
      </footer>
    </div>
  );
}
