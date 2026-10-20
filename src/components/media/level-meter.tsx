/** Live microphone level as a row of bars. Purely visual; `level` is 0..1. */
export function LevelMeter({ level, active = true, bars = 16 }: { level: number; active?: boolean; bars?: number }) {
  const lit = Math.round(Math.min(1, level * 3.2) * bars);
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden dir="ltr">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={`w-[4px] rounded-full transition-[height,background-color] duration-75 ${active && i < lit ? (i > bars * 0.8 ? "bg-warn" : "bg-ok") : "bg-line-strong"}`}
          style={{ height: `${30 + (i / bars) * 70}%` }}
        />
      ))}
    </div>
  );
}
