import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Layers, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudentAssignment } from "@/lib/authz";
import { assignmentAvailability, availabilityMessage } from "@/lib/attempts";
import { loadExam } from "@/lib/exams";
import { parseSettings } from "@/lib/exam-types";
import { SIMULATION_DISCLAIMER } from "@/lib/cobe";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { En } from "@/components/ui/en";
import { formatDateTime, formatScore } from "@/lib/format";
import { StartPanel } from "./start-panel";

export default async function AssignmentIntro({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["STUDENT"]);
  const { id } = await params;
  const assignment = await getStudentAssignment(user, id).catch(() => null);
  if (!assignment || assignment.exam.status === "DRAFT") notFound();
  const [exam, attempts, classroom] = await Promise.all([
    loadExam(assignment.examId),
    db.attempt.findMany({ where: { assignmentId: id, studentId: user.id }, orderBy: { attemptNumber: "desc" } }),
    db.classroom.findUnique({ where: { id: assignment.classroomId }, select: { name: true } }),
  ]);
  if (!exam) notFound();
  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
  const submitted = attempts.filter((a) => a.status === "SUBMITTED").length;
  const avail = assignmentAvailability(assignment, assignment.exam.status, submitted);
  const settings = parseSettings(exam.settings);
  const simulation = exam.mode === "SIMULATION";
  const returned = attempts[0]?.status === "RETURNED" ? attempts[0] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/s" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ArrowRight className="size-4" /> המשימות שלי
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={simulation ? "brand" : "neutral"}>{simulation ? "סימולציה" : "תרגול"}</Badge>
          <span className="text-sm text-ink-3">{classroom?.name}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight" dir="auto">
          {exam.title}
        </h1>
        {assignment.dueAt && <p className="mt-1 text-sm text-ink-2">להגשה עד {formatDateTime(assignment.dueAt)}</p>}
      </div>

      {returned && (
        <Alert tone="warn" title="המורה החזיר/ה את המבחן לתרגול נוסף">
          {returned.returnNote || "בצעו את המבחן שוב."}
        </Alert>
      )}
      {(exam.description || assignment.instructions) && (
        <Card className="space-y-2 p-5 text-[15px] leading-relaxed text-ink-2">
          {assignment.instructions && <p dir="auto">{assignment.instructions}</p>}
          {exam.description && <p dir="auto">{exam.description}</p>}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Layers className="size-4 text-ink-3" /> מבנה
        </h2>
        <ol className="space-y-2">
          {exam.sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm">
              <En as="span" className="font-medium">
                {s.title}
              </En>
              <span className="text-ink-3">{s.choiceMode === "CHOOSE_ONE" ? `בחירת נושא 1 מתוך ${s.questions.length}` : `${s.questions.length} שאלות`}</span>
            </li>
          ))}
        </ol>
        <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
          {settings.totalTimeLimitSec && (
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-ink-3" /> זמן כולל: {Math.round(settings.totalTimeLimitSec / 60)} דקות. השעון מתחיל עם תחילת המבחן ולא נעצר.
            </li>
          )}
          {!settings.allowBackNavigation && <li>• לא ניתן לחזור לשאלות קודמות.</li>}
          {simulation && <li>• בכל שאלה יש זמן הכנה, וההקלטה מתחילה אוטומטית בסיומו.</li>}
          <li>• ענו על כל השאלות בסט בהקלטה אחת רציפה.</li>
          {assignment.maxAttempts !== null && <li>• מספר ניסיונות: {assignment.maxAttempts}</li>}
        </ul>
      </Card>

      {simulation && <p className="text-xs leading-relaxed text-ink-3">{SIMULATION_DISCLAIMER}</p>}

      {inProgress ? (
        <StartPanel assignmentId={id} resume requireMicCheck={false} />
      ) : avail.ok || returned ? (
        <StartPanel assignmentId={id} requireMicCheck={simulation} />
      ) : (
        <Alert tone="info" title={availabilityMessage(avail.reason)} />
      )}

      {attempts.filter((a) => a.status !== "IN_PROGRESS").length > 0 && (
        <Card>
          <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold">ניסיונות קודמים</h2>
          <ul className="divide-y divide-line">
            {attempts
              .filter((a) => a.status !== "IN_PROGRESS")
              .map((a) => (
                <li key={a.id}>
                  <Link href={`/s/attempts/${a.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-subtle/60">
                    <RotateCcw className="size-4 text-ink-3" />
                    <span className="flex-1">ניסיון {a.attemptNumber}{a.submittedAt ? ` · ${formatDateTime(a.submittedAt)}` : ""}</span>
                    <span className="font-medium tabular">{a.gradingStatus === "PUBLISHED" ? formatScore(a.totalScore) : a.status === "RETURNED" ? "הוחזר" : "ממתין לבדיקה"}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
