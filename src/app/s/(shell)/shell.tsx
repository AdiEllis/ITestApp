"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, History, ListTodo, LogOut, Mic } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/ui/cn";
import { logoutAction } from "@/app/(auth)/actions";
import { DemoBanner } from "@/components/demo-banner";

const NAV = [
  { href: "/s", label: "משימות", icon: ListTodo, exact: true },
  { href: "/s/history", label: "היסטוריה וציונים", icon: History },
  { href: "/s/mic-check", label: "בדיקת מיקרופון", icon: Mic },
  { href: "/help/students", label: "עזרה", icon: CircleHelp },
];

export function StudentShell({ name, demo, children }: { name: string; demo: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));
  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      {demo && <DemoBanner />}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-4">
          <Logo href="/s" />
          <nav className="hidden flex-1 items-center gap-1 sm:flex" aria-label="ניווט ראשי">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n) ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm", active(n) ? "bg-surface font-medium shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden text-sm text-ink-2 sm:inline">{name}</span>
            <form action={logoutAction}>
              <button className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-subtle hover:text-ink" aria-label="התנתקות" title="התנתקות">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="ניווט">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active(n) ? "text-brand" : "text-ink-3")}>
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
