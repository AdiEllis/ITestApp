import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnAttempt } from "@/lib/authz";
import { finalizeIfExpired, snapshotOf } from "@/lib/attempts";
import { ExamRunner } from "@/components/runner/exam-runner";
import type { SavedAnswer } from "@/components/runner/use-uploads";

export const metadata = { title: "מבחן" };
export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["STUDENT"]);
  const { id } = await params;
  const found = await getOwnAttempt(user, id).catch(() => null);
  if (!found) notFound();
  const attempt = await finalizeIfExpired(found);
  if (attempt.status !== "IN_PROGRESS") redirect(found.status === "IN_PROGRESS" ? `/s/attempts/${id}?timeout=1` : `/s/attempts/${id}`);

  const answers = await db.answer.findMany({ where: { attemptId: id }, include: { recording: { select: { mimeType: true } } } });
  const initialAnswers: Record<string, SavedAnswer> = {};
  for (const a of answers)
    initialAnswers[a.questionId] = { recordingId: a.recordingId, recordingCount: a.recordingCount, durationSec: a.durationSec, mimeType: a.recording?.mimeType ?? null };

  return (
    <ExamRunner
      attemptId={id}
      snapshot={snapshotOf(attempt)}
      initialAnswers={initialAnswers}
      initialChoices={(attempt.choices ?? {}) as Record<string, string>}
      initialProgress={(attempt.progress ?? {}) as Record<string, never>}
      deadlineAt={attempt.deadlineAt?.toISOString() ?? null}
      serverNow={new Date().toISOString()}
      exitHref="/s"
    />
  );
}
