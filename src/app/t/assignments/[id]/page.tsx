import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnAssignment } from "@/lib/authz";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { formatDateTime, formatScore, toLocalInput } from "@/lib/format";
import { MODE_LABELS } from "@/lib/exam-types";
import { deleteAssignmentAction } from "../../_actions/assignments";
import { AssignmentSettings } from "./settings";
import { SebPanel } from "./seb-panel";

type RowStatus = "not_started" | "in_progress" | "submitted" | "draft" | "published" | "returned";
const STATUS: Record<RowStatus, { label: string; tone: Tone }> = {
  not_started: { label: "לא התחיל/ה", tone: "neutral" },
  in_progress: { label: "בתהליך", tone: "brand" },
  submitted: { label: "ממתין לבדיקה", tone: "warn" },
  draft: { label: "בבדיקה (טיוטה)", tone: "warn" },
  published: { label: "ציון פורסם", tone: "ok" },
  returned: { label: "הוחזר", tone: "rec" },
};

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const assignment = await getOwnAssignment(user, id).catch(() => null);
  if (!assignment) notFound();
  const filter = (await searchParams).status as RowStatus | undefined;

  const students = assignment.specificStudents
    ? (await db.assignmentStudent.findMany({ where: { assignmentId: id }, include: { student: { select: { id: true, name: true } } } })).map((x) => x.student)
    : (await db.enrollment.findMany({ where: { classroomId: assignment.classroomId }, include: { student: { select: { id: true, name: true } } } })).map((x) => x.student);
  students.sort((a, b) => a.name.localeCompare(b.name, "he"));
  const attempts = await db.attempt.findMany({ where: { assignmentId: id }, orderBy: { attemptNumber: "desc" } });
  const latestBy = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!latestBy.has(a.studentId)) latestBy.set(a.studentId, a);

  const rows = students.map((s) => {
    const a = latestBy.get(s.id);
    const status: RowStatus = !a
      ? "not_started"
      : a.status === "IN_PROGRESS"
        ? "in_progress"
        : a.status === "RETURNED"
          ? "returned"
          : a.gradingStatus === "PUBLISHED"
            ? "published"
            : a.gradingStatus === "DRAFT"
              ? "draft"
              : "submitted";
    const late = a?.submittedAt && assignment.dueAt && a.submittedAt > assignment.dueAt;
    return { student: s, attempt: a, status, late, count: attempts.filter((x) => x.studentId === s.id).length };
  });
  const counts = rows.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  const shown = filter ? rows.filter((r) => r.status === filter) : rows;

  return (
    <>
      <PageHeader
        back={
          <Link href="/t/assignments" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> מבחנים שנשלחו
          </Link>
        }
        title={<span dir="auto">{assignment.exam.title}</span>}
        description={`${assignment.classroom.name} · ${MODE_LABELS[assignment.exam.mode]} · ${assignment.dueAt ? `להגשה עד ${formatDateTime(assignment.dueAt)}` : "ללא מועד הגשה"}`}
        actions={
          <>
            <LinkButton href={`/preview/${assignment.examId}`} variant="secondary" size="sm">
              תצוגת המבחן
            </LinkButton>
            <ConfirmAction
              action={deleteAssignmentAction.bind(null, id)}
              trigger="מחיקה"
              title="למחוק את השליחה לכיתה?"
              body={attempts.length ? `יימחקו גם ${attempts.length} ניסיונות של תלמידים, כולל ההקלטות והציונים. לא ניתן לשחזר.` : "המשימה תוסר מהתלמידים."}
              confirmLabel="מחיקה"
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="הגשות" description={`${students.length} תלמידים`} />
          <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3 text-sm">
            <Link href={`/t/assignments/${id}`} className={`rounded-full border px-3 py-1 ${!filter ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-2"}`}>
              הכול ({rows.length})
            </Link>
            {(Object.keys(STATUS) as RowStatus[])
              .filter((k) => counts[k])
              .map((k) => (
                <Link key={k} href={`/t/assignments/${id}?status=${k}`} className={`rounded-full border px-3 py-1 ${filter === k ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-2"}`}>
                  {STATUS[k].label} ({counts[k]})
                </Link>
              ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={Users} title="אין תלמידים להצגה" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-subtle/70 text-xs text-ink-3">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium sm:px-5">תלמיד/ה</th>
                    <th className="px-3 py-2.5 text-start font-medium">סטטוס</th>
                    <th className="hidden px-3 py-2.5 text-start font-medium sm:table-cell">הוגש</th>
                    <th className="px-3 py-2.5 text-start font-medium">ציון</th>
                    <th className="px-4 py-2.5 sm:px-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((r) => (
                    <tr key={r.student.id} className="hover:bg-subtle/40">
                      <td className="px-4 py-3 font-medium sm:px-5">{r.student.name}</td>
                      <td className="px-3 py-3">
                        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                        {r.late && <Badge tone="danger" className="ms-1">באיחור</Badge>}
                      </td>
                      <td className="hidden px-3 py-3 text-ink-3 sm:table-cell">
                        {r.attempt?.submittedAt ? formatDateTime(r.attempt.submittedAt) : "—"}
                        {r.count > 1 && <span className="ms-1 text-xs">(ניסיון {r.attempt?.attemptNumber})</span>}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular">{r.attempt?.totalScore !== null && r.attempt?.totalScore !== undefined ? formatScore(r.attempt.totalScore) : "—"}</td>
                      <td className="px-4 py-3 text-end sm:px-5">
                        {r.attempt && r.attempt.status !== "IN_PROGRESS" && (
                          <LinkButton href={`/t/review/${r.attempt.id}`} size="sm" variant={r.status === "submitted" || r.status === "draft" ? "primary" : "secondary"}>
                            {r.status === "submitted" ? "בדיקה" : "צפייה"}
                          </LinkButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="h-fit p-5">
            <SebPanel id={id} requireSeb={assignment.requireSeb} quitPassword={assignment.sebQuitPassword} />
          </Card>
          <Card className="h-fit p-5">
            <h2 className="mb-4 text-[15px] font-semibold">הגדרות</h2>
            <AssignmentSettings id={id} dueAt={toLocalInput(assignment.dueAt)} allowLate={assignment.allowLate} maxAttempts={assignment.maxAttempts} />
            <p className="mt-4 text-xs text-ink-3">נפתח {formatDateTime(assignment.opensAt)}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
