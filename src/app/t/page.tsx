import Link from "next/link";
import { AlertCircle, ChevronLeft, ClipboardCheck, ListChecks, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreTrend } from "@/components/score-trend";
import { formatDate, formatDateTime, formatScore } from "@/lib/format";
import { snapshotOf } from "@/lib/attempts";
import { GettingStarted, type StartStep } from "@/components/help/getting-started";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "ראשי" };

export default async function TeacherDashboard() {
  const user = await requireUser(["TEACHER"]);
  const mine = { classroom: { teacherId: user.id } };
  const now = new Date();
  const [assignments, pending, pendingList, dueSoon, publishedAttempts, classes] = await Promise.all([
    db.assignment.count({ where: mine }),
    db.attempt.count({ where: { assignment: mine, status: "SUBMITTED", gradingStatus: { not: "PUBLISHED" } } }),
    db.attempt.findMany({
      where: { assignment: mine, status: "SUBMITTED", gradingStatus: { not: "PUBLISHED" } },
      orderBy: { submittedAt: "asc" },
      take: 6,
      include: { student: { select: { name: true } } },
    }),
    db.assignment.findMany({
      where: {
        ...mine,
        opensAt: { lte: now },
        OR: [{ dueAt: { gte: new Date(now.getTime() - 7 * 86400_000) } }, { dueAt: null, createdAt: { gte: new Date(now.getTime() - 30 * 86400_000) } }],
      },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 8,
      include: {
        exam: { select: { title: true } },
        classroom: { select: { name: true, enrollments: { select: { studentId: true } } } },
        students: { select: { studentId: true } },
        attempts: { where: { status: { not: "IN_PROGRESS" } }, select: { studentId: true } },
      },
    }),
    db.attempt.findMany({
      where: { assignment: mine, gradingStatus: "PUBLISHED", totalScore: { not: null } },
      select: { totalScore: true, assignmentId: true, submittedAt: true, examSnapshot: true },
      orderBy: { submittedAt: "asc" },
    }),
    db.classroom.count({ where: { teacherId: user.id } }),
  ]);
  const [enrolled, publishedExams, gradedCount, firstClass] = await Promise.all([
    db.enrollment.count({ where: { classroom: { teacherId: user.id } } }),
    db.exam.count({ where: { ownerId: user.id, isLibraryEntry: false, status: "PUBLISHED" } }),
    db.attempt.count({ where: { assignment: mine, gradingStatus: "PUBLISHED" } }),
    db.classroom.findFirst({ where: { teacherId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  const steps: StartStep[] = [
    { title: "יצירת כיתה", body: "נותנים שם לכיתה — למשל י״א 3.", href: "/t/classes", cta: "יצירת כיתה", done: classes > 0 },
    { title: "צירוף תלמידים", body: "שולחים לקבוצת הכיתה קישור הצטרפות. כל תלמיד נכנס עם Google.", href: firstClass ? `/t/classes/${firstClass.id}` : "/t/classes", cta: "לקישור ההצטרפות", done: enrolled > 0 },
    { title: "יצירת מבחן ופרסום", body: "כותבים שאלות על החומר שנלמד, ומאשרים את ההקראה של כל שאלה.", href: "/t/exams/new", cta: "מבחן חדש", done: publishedExams > 0 },
    { title: "שליחת המבחן לכיתה", body: "בוחרים מבחן, כיתה ותאריך הגשה.", href: "/t/assignments/new", cta: "שליחה לכיתה", done: assignments > 0 },
    { title: "בדיקת הגשה ראשונה", body: "מאזינים, בוחרים רמה בכל קריטריון ומפרסמים משוב.", href: "/t/review", cta: "לבדיקת הגשות", done: gradedCount > 0 },
  ];
  const setupDone = steps.every((x) => x.done);

  // Average published score per assignment, in chronological order.
  const byAssignment = new Map<string, { title: string; date: Date; sum: number; n: number }>();
  for (const a of publishedAttempts) {
    const e = byAssignment.get(a.assignmentId) ?? { title: snapshotOf(a).title, date: a.submittedAt ?? new Date(), sum: 0, n: 0 };
    e.sum += a.totalScore!;
    e.n++;
    byAssignment.set(a.assignmentId, e);
  }
  const trend = [...byAssignment.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).map((e) => ({ label: e.title, date: formatDate(e.date), score: Math.round(e.sum / e.n) }));

  const missing = dueSoon
    .map((a) => {
      const targets = a.specificStudents ? a.students.map((s) => s.studentId) : a.classroom.enrollments.map((e) => e.studentId);
      const done = new Set(a.attempts.map((x) => x.studentId));
      return { a, missing: targets.filter((t) => !done.has(t)).length, total: targets.length };
    })
    .filter((x) => x.missing > 0);

  return (
    <>
      <PageHeader
        title={`שלום, ${user.name.split(" ")[0]}`}
        description={pending === 1 ? "הגשה אחת ממתינה לבדיקה." : pending ? `${pending} הגשות ממתינות לבדיקה.` : "אין הגשות שממתינות לבדיקה."}
        actions={
          <>
            <HelpButton topic="dashboard" />
            <LinkButton href="/t/exams/new" variant="secondary" size="sm">
              <Plus className="size-4" /> מבחן חדש
            </LinkButton>
            <LinkButton href="/t/assignments/new" size="sm">
              <ListChecks className="size-4" /> שליחה לכיתה
            </LinkButton>
          </>
        }
      />
      {!setupDone && (
        <div className="mb-6">
          <GettingStarted steps={steps} />
        </div>
      )}
      {assignments > 0 && (
        <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="ממתינות לבדיקה" actions={pending > 0 ? <Link href="/t/review" className="text-sm text-brand hover:underline">לכל ההגשות</Link> : undefined} />
          {pendingList.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="הכול נבדק" />
          ) : (
            <ul className="divide-y divide-line">
              {pendingList.map((a) => (
                <li key={a.id}>
                  <Link href={`/t/review/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.student.name}</p>
                      <p className="truncate text-xs text-ink-3" dir="auto">
                        {snapshotOf(a).title} · {a.submittedAt ? formatDateTime(a.submittedAt) : ""}
                      </p>
                    </div>
                    <ChevronLeft className="size-4 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="תלמידים שלא הגישו" description="מבחנים פתוחים, ומבחנים שמועד ההגשה שלהם עבר בשבוע האחרון" />
          {missing.length === 0 ? (
            <EmptyState icon={AlertCircle} title="אין חוסרים" body="כל התלמידים הגישו." />
          ) : (
            <ul className="divide-y divide-line">
              {missing.map(({ a, missing: m, total }) => (
                <li key={a.id}>
                  <Link href={`/t/assignments/${a.id}?status=not_started`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" dir="auto">
                        {a.exam.title}
                      </p>
                      <p className="text-xs text-ink-3">
                        {a.classroom.name} · {a.dueAt ? `${a.dueAt < now ? "נסגר" : "עד"} ${formatDateTime(a.dueAt)}` : "ללא מועד הגשה"}
                      </p>
                    </div>
                    <span className="text-sm text-warn tabular">
                      {m}/{total} לא הגישו
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {trend.length >= 2 && (
      <Card className="mt-6">
        <CardHeader title="ממוצע ציונים לפי מבחן" description="ממוצע הציונים שפורסמו, לפי סדר כרונולוגי" />
        <div className="p-5">
          {(
            <>
              <ScoreTrend points={trend} />
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">ממוצע ציונים לפי מבחן</caption>
                <tbody className="divide-y divide-line">
                  {trend.slice(-5).reverse().map((t, i) => (
                    <tr key={i}>
                      <td className="py-2 text-ink-2" dir="auto">{t.label}</td>
                      <td className="py-2 text-ink-3">{t.date}</td>
                      <td className="py-2 text-end font-semibold tabular">{formatScore(t.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </Card>
      )}
        </>
      )}
    </>
  );
}
