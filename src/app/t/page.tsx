import Link from "next/link";
import { AlertCircle, BookOpen, ChevronLeft, ClipboardCheck, Inbox, ListChecks, Plus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreTrend } from "@/components/score-trend";
import { formatDate, formatDateTime, formatScore } from "@/lib/format";
import { snapshotOf } from "@/lib/attempts";

export const metadata = { title: "לוח בקרה" };

function Stat({ label, value, icon: Icon, href }: { label: string; value: number; icon: typeof Users; href: string }) {
  return (
    <Link href={href} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-2">{label}</p>
        <Icon className="size-4 text-ink-3" aria-hidden />
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular">{value}</p>
    </Link>
  );
}

export default async function TeacherDashboard() {
  const user = await requireUser(["TEACHER"]);
  const mine = { classroom: { teacherId: user.id } };
  const now = new Date();
  const [students, assignments, submissions, pending, pendingList, dueSoon, publishedAttempts, classes] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", enrollments: { some: { classroom: { teacherId: user.id, archived: false } } } } }),
    db.assignment.count({ where: mine }),
    db.attempt.count({ where: { assignment: mine, status: { not: "IN_PROGRESS" } } }),
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

  if (classes === 0) {
    return (
      <>
        <PageHeader title={`שלום, ${user.name.split(" ")[0]}`} description="כמה צעדים כדי להתחיל:" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: 1, t: "יצירת כיתה", d: "והוספת תלמידים או שיתוף קוד הצטרפות.", href: "/t/classes", cta: "לכיתות" },
            { n: 2, t: "יצירת מבחן", d: "מתבנית COBE, ממבחן ריק, מקבצים מוכנים או מהמאגר המשותף.", href: "/t/exams/new", cta: "מבחן חדש" },
            { n: 3, t: "הקצאה ובדיקה", d: "קובעים מועד הגשה, ומאזינים להקלטות כשהתלמידים מגישים.", href: "/t/assignments/new", cta: "הקצאה" },
          ].map((s) => (
            <Card key={s.n} className="flex flex-col p-5">
              <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{s.n}</span>
              <h2 className="mt-3 font-semibold">{s.t}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-2">{s.d}</p>
              <LinkButton href={s.href} variant={s.n === 1 ? "primary" : "secondary"} size="sm" className="mt-4 self-start">
                {s.cta}
              </LinkButton>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`שלום, ${user.name.split(" ")[0]}`}
        description={pending ? `${pending} הגשות ממתינות לבדיקה.` : "אין הגשות שממתינות לבדיקה."}
        actions={
          <>
            <LinkButton href="/t/exams/new" variant="secondary" size="sm">
              <Plus className="size-4" /> מבחן חדש
            </LinkButton>
            <LinkButton href="/t/assignments/new" size="sm">
              <ListChecks className="size-4" /> הקצאה
            </LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="תלמידים" value={students} icon={Users} href="/t/classes" />
        <Stat label="מבחנים שהוקצו" value={assignments} icon={BookOpen} href="/t/assignments" />
        <Stat label="הגשות שהתקבלו" value={submissions} icon={Inbox} href="/t/review?f=published" />
        <Stat label="ממתינות לבדיקה" value={pending} icon={ClipboardCheck} href="/t/review" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
          <CardHeader title="תלמידים שלא הגישו" description="משימות פתוחות, ומשימות שמועד ההגשה שלהן עבר בשבוע האחרון" />
          {missing.length === 0 ? (
            <EmptyState icon={AlertCircle} title="אין חוסרים" body="כל התלמידים הגישו את המשימות הקרובות." />
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

      <Card className="mt-6">
        <CardHeader title="ממוצע ציונים לפי משימה" description="ממוצע הציונים שפורסמו, לפי סדר כרונולוגי" />
        <div className="p-5">
          {trend.length < 2 ? (
            <p className="py-6 text-center text-sm text-ink-3">הגרף יופיע אחרי שיפורסמו ציונים בשתי משימות לפחות.</p>
          ) : (
            <>
              <ScoreTrend points={trend} />
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">ממוצע ציונים לפי משימה</caption>
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
    </>
  );
}
