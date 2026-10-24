"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "./ui/cn";
import { logoutAction } from "@/app/(auth)/actions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
  /** Shown in the phone's bottom tab bar, under this short label. */
  tab?: string;
}

const isActive = (item: NavItem, pathname: string) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

function TabIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />;
}

/** Bottom tab bar on phones: the main pages within thumb reach, "עוד" opens the full menu. */
function TabBar({ items, onMore }: { items: NavItem[]; onMore: () => void }) {
  const pathname = usePathname();
  const tabs = items.filter((i) => i.tab);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }} aria-label="ניווט">
      {tabs.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs", active ? "font-medium text-brand" : "text-ink-3")}>
            <span className="relative">
              <TabIcon icon={item.icon} />
              {item.badge ? <span className="absolute -end-3 -top-1.5 min-w-5 rounded-full bg-brand px-1 text-center text-[11px] font-semibold leading-5 text-white tabular">{item.badge}</span> : null}
            </span>
            {item.tab}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs text-ink-3">
        <Menu className="size-5" aria-hidden />
        עוד
      </button>
    </nav>
  );
}

/** Spinner on the tapped item until the new page shows, so a slow server never looks like a missed tap. */
function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="size-[17px] shrink-0 animate-spin text-brand" aria-hidden />
  ) : (
    <Icon className={cn("size-[17px] shrink-0", active ? "text-brand" : "text-ink-3")} aria-hidden />
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="ניווט ראשי">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={active ? onNavigate : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition-colors lg:h-9 lg:text-[14.5px]",
              active ? "bg-surface font-medium text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-ink-2 hover:bg-[#ebebe6] hover:text-ink",
            )}
          >
            <NavIcon icon={item.icon} active={active} />
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

export function AppShell({
  items,
  user,
  roleLabel,
  home,
  children,
  banner,
  hideTabs,
}: {
  items: NavItem[];
  user: { name: string };
  roleLabel: string;
  home: string;
  children: React.ReactNode;
  banner?: React.ReactNode;
  /** Pages with their own bottom bar (the grader) hide the tab bar. */
  hideTabs?: (pathname: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const tabs = items.some((i) => i.tab) && !hideTabs?.(pathname);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
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
        {!tabs && (
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-subtle" aria-label="פתיחת תפריט" aria-expanded={open}>
            <Menu className="size-5" />
          </button>
        )}
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
      <main className={cn("min-w-0", tabs && "pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0")}>
        {banner}
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-9">{children}</div>
      </main>
      {tabs && <TabBar items={items} onMore={() => setOpen(true)} />}
    </div>
  );
}
