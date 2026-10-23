"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, History, ListTodo, Loader2, LogOut, Mic, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/ui/cn";
import { logoutAction } from "@/app/(auth)/actions";
import { DemoBanner } from "@/components/demo-banner";

const NAV = [
  { href: "/s", label: "המבחנים שלי", short: "מבחנים", icon: ListTodo, exact: true },
  { href: "/s/history", label: "היסטוריה וציונים", short: "ציונים", icon: History },
  { href: "/s/mic-check", label: "בדיקת מיקרופון", short: "מיקרופון", icon: Mic },
  { href: "/help/students", label: "עזרה", short: "עזרה", icon: CircleHelp },
];

function NewCount({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("ms-1.5 inline-grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold leading-5 text-white tabular", className)} aria-label={`${n} מבחנים חדשים`}>
      {n}
    </span>
  );
}

function TabIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />;
}

export function StudentShell({ name, demo, fresh, children }: { name: string; demo: boolean; fresh: number; children: React.ReactNode }) {
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
                {n.href === "/s" && fresh > 0 && <NewCount n={fresh} />}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden text-sm text-ink-2 sm:inline">{name}</span>
            <form action={logoutAction}>
              <button className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-3 hover:bg-subtle hover:text-ink">
                <LogOut className="size-4" aria-hidden />
                יציאה
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="ניווט">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n) ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs", active(n) ? "font-medium text-brand" : "text-ink-3")}>
            <span className="relative">
              <TabIcon icon={n.icon} />
              {n.href === "/s" && fresh > 0 && <NewCount n={fresh} className="absolute -end-3 -top-1.5" />}
            </span>
            {n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
