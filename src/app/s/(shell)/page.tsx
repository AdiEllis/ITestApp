import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronLeft, ClipboardList, Inbox, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentAssignmentWhere } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatScore } from "@/lib/format";
import { MODE_LABELS } from "@/lib/exam-types";
import { JoinAnotherClass } from "./join-another";

export const metadata = { title: "המשימות שלי" };

export default async function StudentHome() {
  const user = await requireUser(["STUDENT"]);
  const now = new Date();
  const assignments = await db.assignment.findMany({
    where: { ...studentAssignmentWhere(user.id), exam: { status: { not: "DRAFT" } } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      exam: { select: { title: true, mode: true, description: true } },
      classroom: { select: { name: true } },
      attempts: { where: { studentId: user.id }, orderBy: { attemptNumber: "desc" }, select: { id: true, status: true, gradingStatus: true, totalScore: true, submittedAt: true } },
    },
  });
  const classes = await db.classroom.count({ where: { enrollments: { some: { studentId: user.id } }, archived: false } });

  const open: typeof assignments = [];
  const upcoming: typeof assignments = [];
  const done: typeof assignments = [];
  for (const a of assignments) {
    const latest = a.attempts[0];
    if (a.opensAt > now) upcoming.push(a);
    else if (!latest || latest.status === "IN_PROGRESS" || latest.status === "RETURNED") open.push(a);
    else done.push(a);
  }
  const feedback = done.filter((a) => a.attempts[0]?.gradingStatus === "PUBLISHED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">שלום, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-ink-2">{open.length ? `יש לך ${open.length} משימות פתוחות.` : "אין משימות פתוחות כרגע."}</p>
      </div>

      {classes === 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">עדיין לא הצטרפת לכיתה</h2>
          <p className="mt-1 text-sm text-ink-2">קבלו קוד כיתה מהמורה והזינו אותו כאן.</p>
          <div className="mt-4">
            <JoinAnotherClass />
          </div>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <ClipboardList className="size-4 text-brand" /> לביצוע
        </h2>
        {open.length === 0 ? (
          <Card>
            <EmptyState icon={Inbox} title="הכול בוצע" body="כשהמורה תקצה מבחן או תרגול חדש, הוא יופיע כאן." />
          </Card>
        ) : (
          <div className="grid gap-3">
            {open.map((a) => {
              const latest = a.attempts[0];
              const overdue = a.dueAt && a.dueAt < now;
              return (
                <Link key={a.id} href={`/s/assignments/${a.id}`} className="group block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-brand">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" dir="auto">
                          {a.exam.title}
                        </p>
                        <Badge tone={a.exam.mode === "SIMULATION" ? "brand" : "neutral"}>{MODE_LABELS[a.exam.mode]}</Badge>
                        {latest?.status === "IN_PROGRESS" && <Badge tone="warn">בתהליך</Badge>}
                        {latest?.status === "RETURNED" && <Badge tone="rec">הוחזר לתיקון</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-ink-3">
                        {a.classroom.name}
                        {a.dueAt && (
                          <span className={overdue ? "text-danger" : ""}>
                            {" · "}
                            {overdue ? "עבר מועד ההגשה" : "להגשה עד"} {formatDateTime(a.dueAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
                      {latest?.status === "IN_PROGRESS" ? "המשך" : latest?.status === "RETURNED" ? "ביצוע חוזר" : "התחלה"}
                      <ChevronLeft className="size-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {feedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <MessageSquare className="size-4 text-brand" /> משוב חדש
          </h2>
          <Card className="divide-y divide-line">
            {feedback.slice(0, 5).map((a) => (
              <Link key={a.id} href={`/s/attempts/${a.attempts[0].id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                <CheckCircle2 className="size-4 text-ok" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                  {a.exam.title}
                </span>
                <span className="text-sm font-semibold tabular">{formatScore(a.attempts[0].totalScore)}</span>
                <ChevronLeft className="size-4 text-ink-3" />
              </Link>
            ))}
          </Card>
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">הוגשו</h2>
          <Card className="divide-y divide-line">
            {done.map((a) => {
              const latest = a.attempts[0];
              const more = a.maxAttempts === null || a.attempts.filter((x) => x.status !== "IN_PROGRESS").length < a.maxAttempts;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="auto">
                      {a.exam.title}
                    </p>
                    <p className="text-xs text-ink-3">
                      הוגש {latest.submittedAt ? formatDateTime(latest.submittedAt) : ""} ·{" "}
                      {latest.gradingStatus === "PUBLISHED" ? `ציון ${formatScore(latest.totalScore)}` : "ממתין לבדיקה"}
                    </p>
                  </div>
                  <Link href={`/s/attempts/${latest.id}`} className="text-sm font-medium text-brand hover:underline">
                    פרטים
                  </Link>
                  {more && (!a.dueAt || a.dueAt > now || a.allowLate) && (
                    <Link href={`/s/assignments/${a.id}`} className="text-sm text-ink-2 hover:text-ink">
                      תרגול נוסף
                    </Link>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <CalendarClock className="size-4 text-ink-3" /> בקרוב
          </h2>
          <Card className="divide-y divide-line">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span dir="auto">{a.exam.title}</span>
                <span className="text-ink-3">נפתח {formatDateTime(a.opensAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {classes > 0 && (
        <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium text-ink-2">הצטרפות לכיתה נוספת</summary>
          <div className="mt-4">
            <JoinAnotherClass />
          </div>
        </details>
      )}
    </div>
  );
}
