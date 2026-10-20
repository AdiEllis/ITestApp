import Link from "next/link";

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 text-ink" aria-label="OralPrep – דף הבית">
      <span className="grid size-8 place-items-center rounded-[9px] bg-brand text-white">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
      </span>
      {!compact && (
        <span lang="en" dir="ltr" className="text-[17px] font-semibold tracking-tight">
          Oral<span className="text-brand">Prep</span>
        </span>
      )}
    </Link>
  );
}
