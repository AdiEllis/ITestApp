import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

export interface StartStep {
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
}

/** Checklist that ticks itself as the teacher completes the first-time setup. */
export function GettingStarted({ steps }: { steps: StartStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[17px] font-semibold">צעדים ראשונים</h2>
          <p className="text-sm text-ink-3">
            {done} מתוך {steps.length} הושלמו · <Link href="/t/help" className="text-brand hover:underline">למדריך המלא</Link>
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.title} className={cn("flex items-center gap-4 px-5 py-4", i === next && "bg-brand-soft/50")}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold", s.done ? "bg-ok text-white" : i === next ? "bg-brand text-white" : "bg-subtle text-ink-3")}>
              {s.done ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", s.done && "text-ink-3 line-through decoration-ink-3/40")}>{s.title}</p>
              {!s.done && <p className="text-sm text-ink-2">{s.body}</p>}
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-medium",
                  i === next ? "bg-brand text-white hover:bg-brand-strong" : "border border-line-strong bg-surface hover:bg-subtle",
                )}
              >
                {s.cta} <ChevronLeft className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
