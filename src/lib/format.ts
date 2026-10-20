const tz = "Asia/Jerusalem";

export function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(d));
}
export function formatDateTime(d: Date | string) {
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
}
export function formatDuration(sec: number | null | undefined) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function formatScore(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
/** Converts a Date to the value of an <input type="datetime-local"> in Israel time. */
export function toLocalInput(d: Date | null | undefined) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
/** Parses a datetime-local value as Israel time. */
export function fromLocalInput(v: string): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Find Israel offset at that moment.
  const probe = new Date(asUtc);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = local.getTime() - utc.getTime();
  return new Date(asUtc - offset);
}
