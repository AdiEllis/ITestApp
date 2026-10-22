import Link from "next/link";
import { ChevronLeft, Library, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { MODE_LABELS } from "@/lib/exam-types";
import { formatDate } from "@/lib/format";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "מאגר משותף" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; mode?: string; topic?: string; mine?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80);
  const where: Prisma.ExamWhereInput = {
    isLibraryEntry: true,
    status: "PUBLISHED",
    ...(sp.mine === "1" ? { ownerId: user.id } : {}),
    ...(sp.subject ? { subject: sp.subject } : {}),
    ...(sp.mode === "PRACTICE" || sp.mode === "SIMULATION" ? { mode: sp.mode } : {}),
    ...(sp.topic ? { topics: { has: sp.topic } } : {}),
    ...(q
      ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { topics: { has: q } }] }
      : {}),
  };
  const [entries, topicsRaw, subjectsRaw] = await Promise.all([
    db.exam.findMany({
      where,
      orderBy: [{ copyCount: "desc" }, { sharedAt: "desc" }],
      take: 100,
      include: { owner: { select: { name: true, school: { select: { name: true } } } }, _count: { select: { sections: true } } },
    }),
    db.exam.findMany({ where: { isLibraryEntry: true, status: "PUBLISHED" }, select: { topics: true } }),
    db.exam.findMany({ where: { isLibraryEntry: true, status: "PUBLISHED", subject: { not: null } }, select: { subject: true }, distinct: ["subject"] }),
  ]);
  const subjects = subjectsRaw.map((s) => s.subject!).sort((a, b) => a.localeCompare(b, "he"));
  const topics = [...new Set(topicsRaw.flatMap((t) => t.topics))].sort().slice(0, 30);

  return (
    <>
      <PageHeader title="מאגר מבחנים משותף" description="מבחנים שמורים שיתפו. העתיקו מבחן לספרייה שלכם כדי לערוך ולהקצות אותו — המקור לא ישתנה." actions={<HelpButton topic="library" />} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={q} placeholder="חיפוש לפי שם, תיאור או נושא" className="h-10 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-sm" aria-label="חיפוש" />
        </div>
        <select name="subject" defaultValue={sp.subject ?? ""} className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm" aria-label="מקצוע">
          <option value="">כל המקצועות</option>
          {subjects.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select name="mode" defaultValue={sp.mode ?? ""} className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm" aria-label="סוג">
          <option value="">כל הסוגים</option>
          <option value="SIMULATION">מבחן</option>
          <option value="PRACTICE">תרגול</option>
        </select>
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">חיפוש</button>
        {sp.topic && <input type="hidden" name="topic" value={sp.topic} />}
      </form>
      {topics.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
          <Link href="/t/library" className={`rounded-full border px-2.5 py-1 ${!sp.topic && sp.mine !== "1" ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
            הכול
          </Link>
          <Link href="/t/library?mine=1" className={`rounded-full border px-2.5 py-1 ${sp.mine === "1" ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
            ששיתפתי
          </Link>
          {topics.map((t) => (
            <Link key={t} href={`/t/library?topic=${encodeURIComponent(t)}`} dir="auto" className={`rounded-full border px-2.5 py-1 ${sp.topic === t ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
              {t}
            </Link>
          ))}
        </div>
      )}
      <Card>
        {entries.length === 0 ? (
          <EmptyState icon={Library} title={q || sp.subject || sp.mode || sp.topic ? "לא נמצאו מבחנים" : "המאגר ריק עדיין"} body="מורים יכולים לשתף מבחן מפורסם מתוך מסך העריכה (״שיתוף במאגר המשותף״)." />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id}>
                <Link href={`/t/library/${e.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-subtle/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium" dir="auto">
                        {e.title}
                      </p>
                      <Badge tone={e.mode === "SIMULATION" ? "brand" : "neutral"}>{MODE_LABELS[e.mode]}</Badge>
                      {e.subject && <Badge>{e.subject}</Badge>}
                      {e.ownerId === user.id && <Badge tone="ok">שלי</Badge>}
                      {e.isDemo && <Badge tone="warn">הדגמה</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {e.owner.name}
                      {e.owner.school ? ` · ${e.owner.school.name}` : ""} · {e._count.sections} חלקים · שותף {e.sharedAt ? formatDate(e.sharedAt) : ""} · הועתק {e.copyCount} פעמים
                    </p>
                    {e.topics.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1" dir="auto">
                        {e.topics.map((t) => (
                          <span key={t} className="rounded bg-subtle px-1.5 py-0.5 text-xs text-ink-2">
                            {t}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <ChevronLeft className="size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
