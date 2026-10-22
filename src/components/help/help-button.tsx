"use client";
import { useRef } from "react";
import { BookOpen, CircleHelp, Lightbulb, X } from "lucide-react";
import { HELP } from "@/lib/help-content";
import { Button } from "@/components/ui/button";

/** "?" button that opens a short, page-specific how-to. */
export function HelpButton({ topic }: { topic: keyof typeof HELP }) {
  const ref = useRef<HTMLDialogElement>(null);
  const h = HELP[topic];
  if (!h) return null;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => ref.current?.showModal()}>
        <CircleHelp className="size-4" /> איך עושים את זה?
      </Button>
      <dialog
        ref={ref}
        className="m-0 ms-auto h-dvh max-h-dvh w-[min(420px,100vw)] max-w-none border-s border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-ink/30"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CircleHelp className="size-5 text-brand" /> {h.title}
            </h2>
            <button type="button" onClick={() => ref.current?.close()} className="grid size-9 place-items-center rounded-lg hover:bg-subtle" aria-label="סגירה">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <ol className="space-y-3">
              {h.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            {h.tips && (
              <div className="space-y-2 rounded-xl bg-subtle p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Lightbulb className="size-4 text-warn" /> טיפים
                </p>
                <ul className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-ink-2">
                  {h.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="border-t border-line px-5 py-4">
            <a href="/t/help" className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
              <BookOpen className="size-4" /> למדריך המלא
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
