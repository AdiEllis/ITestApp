import { cn } from "./cn";

export type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "rec";
const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2 border-line",
  brand: "bg-brand-soft text-brand-strong border-brand-line",
  ok: "bg-ok-soft text-ok border-[#c4e4d3]",
  warn: "bg-warn-soft text-warn border-[#f1dcb5]",
  danger: "bg-danger-soft text-danger border-[#f0cbc6]",
  rec: "bg-rec-soft text-rec border-[#f3c9ca]",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
