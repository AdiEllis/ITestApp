import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getManagedStudent } from "@/lib/authz";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreTrend } from "@/components/score-trend";
import { formatDate, formatDateTime, formatScore } from "@/lib/format";
import { snapshotOf } from "@/lib/attempts";
import { StudentAdmin } from "./student-admin";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "התקדמות תלמיד/ה" };

export default async function StudentProgress({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const student = await getManagedStudent(user, id).catch(() => null);
  if (!student) notFound();
  const [attempts, classes, assignedCount] = await Promise.all([
    db.attempt.findMany({
      where: { studentId: id, assignment: { classroom: { teacherId: user.id } } },
      orderBy: { startedAt: "desc" },
      include: { assignment: { select: { classroom: { select: { name: true } }, dueAt: true } } },
    }),
    db.classroom.findMany({ where: { teacherId: user.id, enrollments: { some: { studentId: id } } }, select: { id: true, name: true } }),
    db.assignment.count({ where: { classroom: { teacherId: user.id, enrollments: { some: { studentId: id } } }, OR: [{ specificStudents: false }, { students: { some: { studentId: id } } }] } }),
  ]);
  const graded = attempts.filter((a) => a.gradingStatus === "PUBLISHED" && a.totalScore !== null).reverse();
  const avg = graded.length ? graded.reduce((s, a) => s + a.totalScore!, 0) / graded.length : null;
  const submittedAssignments = new Set(attempts.filter((a) => a.status !== "IN_PROGRESS").map((a) => a.assignmentId)).size;

  return (
    <>
      <PageHeader
        back={
          classes[0] && (
            <Link href={`/t/classes/${classes[0].id}`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
              <ArrowRight className="size-4" /> {classes[0].name}
            </Link>
          )
        }
        title={student.name}
        actions={<HelpButton topic="student" />}
        description={
          <>
            <span dir="ltr" className="font-mono text-sm">
              {student.username}
            </span>{" "}
            · {classes.map((c) => c.name).join(", ")}
          </>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        {[
          ["משימות שהוקצו", assignedCount],
          ["הוגשו", submittedAssignments],
          ["ממוצע", avg === null ? "—" : formatScore(Math.round(avg * 10) / 10)],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <p className="text-sm text-ink-2">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{v}</p>
          </Card>
        ))}
      </div>
      {graded.length >= 2 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-[15px] font-semibold">מגמת ציונים לאורך השנה</h2>
          <ScoreTrend points={graded.map((a) => ({ label: snapshotOf(a).title, date: formatDate(a.submittedAt ?? a.startedAt), score: Math.round(a.totalScore!) }))} />
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader title="היסטוריית תרגולים ומבחנים" />
        {attempts.length === 0 ? (
          <EmptyState icon={History} title="אין עדיין ניסיונות" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle/70 text-xs text-ink-3">
                <tr>
                  <th className="px-5 py-2.5 text-start font-medium">מבחן</th>
                  <th className="px-3 py-2.5 text-start font-medium">כיתה</th>
                  <th className="px-3 py-2.5 text-start font-medium">הוגש</th>
                  <th className="px-3 py-2.5 text-start font-medium">סטטוס</th>
                  <th className="px-5 py-2.5 text-start font-medium">ציון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-subtle/40">
                    <td className="px-5 py-3">
                      {a.status === "IN_PROGRESS" ? (
                        <span dir="auto">{snapshotOf(a).title}</span>
                      ) : (
                        <Link href={`/t/review/${a.id}`} className="font-medium hover:text-brand" dir="auto">
                          {snapshotOf(a).title}
                        </Link>
                      )}
                      {a.attemptNumber > 1 && <span className="ms-1 text-xs text-ink-3">(ניסיון {a.attemptNumber})</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-3">{a.assignment.classroom.name}</td>
                    <td className="px-3 py-3 text-ink-3">{a.submittedAt ? formatDateTime(a.submittedAt) : "—"}</td>
                    <td className="px-3 py-3">
                      {a.status === "IN_PROGRESS" ? <Badge tone="brand">בתהליך</Badge> : a.status === "RETURNED" ? <Badge tone="rec">הוחזר</Badge> : a.gradingStatus === "PUBLISHED" ? <Badge tone="ok">פורסם</Badge> : <Badge tone="warn">ממתין</Badge>}
                    </td>
                    <td className="px-5 py-3 font-semibold tabular">{a.totalScore !== null ? formatScore(a.totalScore) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <StudentAdmin studentId={id} name={student.name} />
    </>
  );
}
