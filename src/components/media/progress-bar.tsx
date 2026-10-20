export function ProgressBar({ value, tone = "brand", label }: { value: number; tone?: "brand" | "ok" | "rec"; label?: string }) {
  const color = tone === "ok" ? "bg-ok" : tone === "rec" ? "bg-rec" : "bg-brand";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <div className={`h-full rounded-full transition-[width] duration-200 ${color}`} style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}
