import { useEffect, useState } from "react";
import { ClipboardCheck, BookOpen, HardDrive, LayoutDashboard, Menu, Users, X, type LucideIcon } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "./cn";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function TeacherShell({ route, pending, children }: { route: string[]; pending: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const current = "/" + route.join("/");
  useEffect(() => setOpen(false), [current]);
  const items: NavItem[] = [
    { path: "/t", label: "לוח בקרה", icon: LayoutDashboard },
    { path: "/t/exams", label: "מבחנים", icon: BookOpen },
    { path: "/t/inbox", label: "הגשות ובדיקה", icon: ClipboardCheck, badge: pending },
    { path: "/t/students", label: "תלמידים והתקדמות", icon: Users },
    { path: "/t/settings", label: "גיבוי והגדרות", icon: HardDrive },
  ];
  const isActive = (p: string) => (p === "/t" ? current === "/t" : current === p || current.startsWith(p + "/"));
  const nav = (
    <nav className="space-y-0.5" aria-label="ניווט ראשי">
      {items.map((it) => (
        <a
          key={it.path}
          href={`#${it.path}`}
          aria-current={isActive(it.path) ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14.5px] transition-colors",
            isActive(it.path) ? "bg-surface font-medium text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-ink-2 hover:bg-[#ebebe6] hover:text-ink",
          )}
        >
          <it.icon className={cn("size-[17px] shrink-0", isActive(it.path) ? "text-brand" : "text-ink-3")} aria-hidden />
          <span className="flex-1 truncate">{it.label}</span>
          {it.badge ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-5 text-white tabular">{it.badge}</span> : null}
        </a>
      ))}
    </nav>
  );
  const foot = <p className="border-t border-line px-2 pt-3 text-xs leading-relaxed text-ink-3">הנתונים נשמרים בדפדפן הזה בלבד. כדאי לגבות מדי פעם.</p>;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e border-line bg-[#f1f1ed] px-3 py-4 lg:flex">
        <div className="px-2">
          <Logo href="#/t" />
        </div>
        <div className="flex-1">{nav}</div>
        {foot}
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Logo href="#/t" />
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-subtle" aria-label="פתיחת תפריט" aria-expanded={open}>
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="תפריט">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[min(300px,85vw)] flex-col gap-6 bg-[#f1f1ed] px-3 py-4 shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between px-2">
              <Logo href="#/t" />
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[#ebebe6]" aria-label="סגירת תפריט">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1">{nav}</div>
            {foot}
          </div>
        </div>
      )}
      <main className="min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
