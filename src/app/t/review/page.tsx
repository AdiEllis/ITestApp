import Link from "next/link";
import { ChevronLeft, ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatScore } from "@/lib/format";
import { snapshotOf } from "@/lib/attempts";
import type { Prisma } from "@prisma/client";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "בדיקת הגשות" };

const FILTERS = [
  { v: "pending", l: "ממתינות לבדיקה" },
  { v: "draft", l: "טיוטות בדיקה" },
  { v: "published", l: "פורסמו" },
  { v: "returned", l: "הוחזרו" },
] as const;

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ f?: string; classroomId?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const sp = await searchParams;
  const f = FILTERS.find((x) => x.v === sp.f)?.v ?? "pending";
  const where: Prisma.AttemptWhereInput = {
    assignment: { classroom: { teacherId: user.id }, ...(sp.classroomId ? { classroomId: sp.classroomId } : {}) },
    ...(f === "pending"
      ? { status: "SUBMITTED", gradingStatus: "NONE" }
      : f === "draft"
        ? { status: "SUBMITTED", gradingStatus: "DRAFT" }
        : f === "published"
          ? { gradingStatus: "PUBLISHED", status: "SUBMITTED" }
          : { status: "RETURNED" }),
  };
  const [attempts, classes] = await Promise.all([
    db.attempt.findMany({
      where,
      orderBy: { submittedAt: f === "pending" ? "asc" : "desc" },
      take: 200,
      include: { student: { select: { name: true } }, assignment: { select: { classroom: { select: { name: true } }, dueAt: true } } },
    }),
    db.classroom.findMany({ where: { teacherId: user.id, archived: false }, select: { id: true, name: true } }),
  ]);
  const q = (v: string, c?: string) => `/t/review?f=${v}${c ? `&classroomId=${c}` : ""}`;
  return (
    <>
      <PageHeader title="בדיקת הגשות" description="האזנה להקלטות, מתן ציון ומשוב." actions={<HelpButton topic="reviewList" />} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-lg bg-[#ebebe6] p-1 text-sm">
          {FILTERS.map((x) => (
            <Link key={x.v} href={q(x.v, sp.classroomId)} className={`rounded-md px-3 py-1.5 font-medium ${f === x.v ? "bg-surface shadow-sm" : "text-ink-2 hover:text-ink"}`}>
              {x.l}
            </Link>
          ))}
        </div>
        {classes.length > 1 && (
          <div className="flex flex-wrap gap-1.5 text-sm">
            <Link href={q(f)} className={`rounded-full border px-3 py-1 ${!sp.classroomId ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
              כל הכיתות
            </Link>
            {classes.map((c) => (
              <Link key={c.id} href={q(f, c.id)} className={`rounded-full border px-3 py-1 ${sp.classroomId === c.id ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Card>
        {attempts.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={f === "pending" ? "אין הגשות שממתינות לבדיקה" : "אין פריטים להצגה"} body={f === "pending" ? "כשתלמידים יגישו, ההגשות יופיעו כאן לפי סדר ההגשה." : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {attempts.map((a) => (
              <li key={a.id}>
                <Link href={`/t/review/${a.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-subtle/60">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{a.student.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {a.student.name} <span className="font-normal text-ink-3">·</span> <span dir="auto">{snapshotOf(a).title}</span>
                    </p>
                    <p className="text-sm text-ink-3">
                      {a.assignment.classroom.name} · {a.submittedAt ? formatDateTime(a.submittedAt) : ""}
                      {a.submittedAt && a.assignment.dueAt && a.submittedAt > a.assignment.dueAt ? " · באיחור" : ""}
                    </p>
                  </div>
                  {a.totalScore !== null && f !== "pending" && <span className="font-semibold tabular">{formatScore(a.totalScore)}</span>}
                  {f === "draft" && <Badge tone="warn">טיוטה</Badge>}
                  <ChevronLeft className="size-4 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
