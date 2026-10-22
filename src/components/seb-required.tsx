import { Lock } from "lucide-react";
import { SEB_REQUIRED_MESSAGE } from "@/lib/seb";

/** Shown when a classroom (Safe Exam Browser) exam is opened in a regular browser. */
export function SebRequired({ inline = false }: { inline?: boolean }) {
  return (
    <div className={inline ? "rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center" : "flex min-h-dvh flex-col items-center justify-center px-6 text-center"}>
      <Lock className="mx-auto size-8 text-ink-3" />
      <h1 className="mt-3 text-lg font-semibold">מבחן בכיתה</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">{SEB_REQUIRED_MESSAGE}</p>
    </div>
  );
}
