"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "./ui/cn";
import { logoutAction } from "@/app/(auth)/actions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="ניווט ראשי">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14.5px] transition-colors",
              active ? "bg-surface font-medium text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-ink-2 hover:bg-[#ebebe6] hover:text-ink",
            )}
          >
            <item.icon className={cn("size-[17px] shrink-0", active ? "text-brand" : "text-ink-3")} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-5 text-white tabular">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox({ name, roleLabel }: { name: string; roleLabel: string }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line pt-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{name.trim().charAt(0)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-ink-3">{roleLabel}</p>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-[#ebebe6] hover:text-ink" title="התנתקות" aria-label="התנתקות">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({ items, user, roleLabel, home, children, banner }: { items: NavItem[]; user: { name: string }; roleLabel: string; home: string; children: React.ReactNode; banner?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e border-line bg-[#f1f1ed] px-3 py-4 lg:flex">
        <div className="px-2">
          <Logo href={home} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks items={items} />
        </div>
        <UserBox name={user.name} roleLabel={roleLabel} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Logo href={home} />
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-subtle" aria-label="פתיחת תפריט" aria-expanded={open}>
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="תפריט">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[min(300px,85vw)] flex-col gap-6 bg-[#f1f1ed] px-3 py-4 shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between px-2">
              <Logo href={home} />
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[#ebebe6]" aria-label="סגירת תפריט">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </div>
            <UserBox name={user.name} roleLabel={roleLabel} />
          </div>
        </div>
      )}
      <main className="min-w-0">
        {banner}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
