import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReviewableAttempt } from "@/lib/authz";
import { snapshotOf } from "@/lib/attempts";
import { Alert } from "@/components/ui/alert";
import { Grader } from "./grader";

export const metadata = { title: "בדיקת הגשה" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const attempt = await getReviewableAttempt(user, id).catch(() => null);
  if (!attempt) notFound();
  if (attempt.status === "IN_PROGRESS")
    return (
      <Alert tone="info" title="התלמיד/ה עדיין לא הגיש/ה">
        <Link href={`/t/assignments/${attempt.assignmentId}`} className="text-brand">
          חזרה למשימה
        </Link>
      </Alert>
    );

  const [answers, siblings, history] = await Promise.all([
    db.answer.findMany({ where: { attemptId: id }, include: { recording: { select: { id: true, mimeType: true } } } }),
    db.attempt.findMany({
      where: { assignmentId: attempt.assignmentId, status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      select: { id: true, gradingStatus: true, student: { select: { name: true } } },
    }),
    db.attempt.findMany({
      where: { assignmentId: attempt.assignmentId, studentId: attempt.studentId, id: { not: id }, status: { not: "IN_PROGRESS" } },
      orderBy: { attemptNumber: "desc" },
      select: { id: true, attemptNumber: true, totalScore: true, gradingStatus: true },
    }),
  ]);
  const idx = siblings.findIndex((s) => s.id === id);
  const nextPending = siblings.slice(idx + 1).find((s) => s.gradingStatus === "NONE") ?? siblings.find((s) => s.gradingStatus === "NONE" && s.id !== id);

  return (
    <div>
      <Link href={`/t/assignments/${attempt.assignmentId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ArrowRight className="size-4" /> {attempt.assignment.classroom.name} · כל ההגשות
      </Link>
      <Grader
        attempt={{
          id,
          status: attempt.status,
          gradingStatus: attempt.gradingStatus,
          attemptNumber: attempt.attemptNumber,
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
          late: !!(attempt.submittedAt && attempt.assignment.dueAt && attempt.submittedAt > attempt.assignment.dueAt),
          overallFeedback: attempt.overallFeedback,
          choices: (attempt.choices ?? {}) as Record<string, string>,
          returnNote: attempt.returnNote,
        }}
        student={attempt.student}
        snapshot={snapshotOf(attempt)}
        answers={answers.map((a) => ({
          questionId: a.questionId,
          recordingId: a.recording?.id ?? null,
          recordingMime: a.recording?.mimeType ?? null,
          recordingCount: a.recordingCount,
          durationSec: a.durationSec,
          criterionScores: (a.criterionScores ?? null) as Record<string, number | null> | null,
          score: a.score,
          feedback: a.feedback,
        }))}
        prevId={idx > 0 ? siblings[idx - 1].id : null}
        nextId={idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null}
        nextPendingId={nextPending?.id ?? null}
        position={idx >= 0 ? { index: idx + 1, total: siblings.length } : null}
        history={history}
      />
    </div>
  );
}
