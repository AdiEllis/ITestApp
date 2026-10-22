import Link from "next/link";
import { ChevronLeft, ListChecks, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { MODE_LABELS } from "@/lib/exam-types";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "משימות" };

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ classroomId?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { classroomId } = await searchParams;
  const classes = await db.classroom.findMany({ where: { teacherId: user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const assignments = await db.assignment.findMany({
    where: { classroom: { teacherId: user.id }, ...(classroomId ? { classroomId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      exam: { select: { title: true, mode: true } },
      classroom: { select: { name: true, _count: { select: { enrollments: true } } } },
      _count: { select: { students: true } },
      attempts: { select: { studentId: true, status: true, gradingStatus: true } },
    },
  });
  const now = new Date();
  return (
    <>
      <PageHeader
        title="משימות"
        description="מבחנים ותרגולים שהוקצו לכיתות, ומצב ההגשות."
        actions={
          <>
          <HelpButton topic="assignments" />
          <LinkButton href="/t/assignments/new">
            <Plus className="size-4" /> הקצאה חדשה
          </LinkButton>
          </>
        }
      />
      {classes.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
          <Link href="/t/assignments" className={`rounded-full border px-3 py-1 ${!classroomId ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
            כל הכיתות
          </Link>
          {classes.map((c) => (
            <Link key={c.id} href={`/t/assignments?classroomId=${c.id}`} className={`rounded-full border px-3 py-1 ${classroomId === c.id ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-2"}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <Card>
        {assignments.length === 0 ? (
          <EmptyState icon={ListChecks} title="אין משימות עדיין" body="פרסמו מבחן ואז הקצו אותו לכיתה או לתלמידים מסוימים." action={<LinkButton href="/t/assignments/new">הקצאה חדשה</LinkButton>} />
        ) : (
          <ul className="divide-y divide-line">
            {assignments.map((a) => {
              const targets = a.specificStudents ? a._count.students : a.classroom._count.enrollments;
              const submittedStudents = new Set(a.attempts.filter((x) => x.status !== "IN_PROGRESS").map((x) => x.studentId)).size;
              const pending = a.attempts.filter((x) => x.status === "SUBMITTED" && x.gradingStatus !== "PUBLISHED").length;
              const closed = a.dueAt && a.dueAt < now;
              return (
                <li key={a.id}>
                  <Link href={`/t/assignments/${a.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium" dir="auto">
                          {a.exam.title}
                        </p>
                        <Badge tone={a.exam.mode === "SIMULATION" ? "brand" : "neutral"}>{MODE_LABELS[a.exam.mode]}</Badge>
                        {pending > 0 && <Badge tone="warn">{pending} לבדיקה</Badge>}
                        {a.isDemo && <Badge tone="warn">הדגמה</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-3">
                        {a.classroom.name}
                        {a.specificStudents ? ` (${targets} תלמידים נבחרים)` : ""} · {a.dueAt ? `${closed ? "נסגר" : "להגשה עד"} ${formatDateTime(a.dueAt)}` : "ללא מועד הגשה"}
                      </p>
                    </div>
                    <div className="hidden w-32 sm:block">
                      <p className="mb-1 text-xs text-ink-3 tabular">
                        הגישו {submittedStudents}/{targets}
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-ok" style={{ width: `${targets ? (submittedStudents / targets) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <ChevronLeft className="size-4 shrink-0 text-ink-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
