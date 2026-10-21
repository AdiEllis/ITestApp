const tz = "Asia/Jerusalem";
export const formatDate = (d: number | Date) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(d));
export const formatDateTime = (d: number | Date) =>
  new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
export function formatDuration(sec: number | null | undefined) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export const formatScore = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));
export const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ");
