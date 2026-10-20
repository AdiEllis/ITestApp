"use client";
import { useState } from "react";

export interface TrendPoint {
  label: string;
  date: string;
  score: number;
}

/**
 * Single-series score trend (0–100). One hue, 2px line, 8px markers, recessive grid.
 * Hover/focus shows a tooltip; the surrounding page lists the same data as a table.
 */
export function ScoreTrend({ points, height = 160 }: { points: TrendPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const W = 600;
  const H = height;
  const pad = { l: 8, r: 8, t: 12, b: 12 };
  const x = (i: number) => (points.length === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="relative" dir="ltr">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-1 text-[11px] text-ink-3 tabular" style={{ height: H }} aria-hidden>
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height: H }} role="img" aria-label={`מגמת ציונים: ${points.map((p) => p.score).join(", ")}`}>
          {[0, 50, 100].map((v) => (
            <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          <path d={d} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {/* Markers & hit targets in HTML so they stay round regardless of SVG scaling */}
      <div className="pointer-events-none absolute inset-y-0 end-0 start-8" style={{ height: H }}>
        {points.map((p, i) => (
          <button
            key={i}
            type="button"
            className="pointer-events-auto absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-2"
            style={{ left: `${(x(i) / W) * 100}%`, top: y(p.score) }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${p.label}: ${p.score}`}
          >
            <span className="block size-2 rounded-full bg-brand ring-2 ring-surface" />
          </button>
        ))}
        {active && hover !== null && (
          <div
            className="absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow-pop)]"
            style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%`, top: Math.max(0, y(active.score) - 52) }}
            role="tooltip"
          >
            <p className="max-w-48 truncate font-medium text-ink" dir="auto">
              {active.label}
            </p>
            <p className="text-ink-3">
              {active.date} · <span className="font-semibold text-ink tabular">{active.score}</span>
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
