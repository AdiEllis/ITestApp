import { Prisma, type Attempt, type Assignment } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./authz";
import { buildSnapshot, loadExam } from "./exams";
import { storage } from "./storage";
import type { ExamSnapshot, SnapshotQuestion, SnapshotSection } from "./exam-types";
import { audit } from "./audit";

/** Grace period after the deadline for in-flight uploads (network latency, retries). */
export const DEADLINE_GRACE_MS = 2 * 60_000;

export function snapshotOf(attempt: Pick<Attempt, "examSnapshot">): ExamSnapshot {
  return attempt.examSnapshot as unknown as ExamSnapshot;
}

export function findQuestion(snapshot: ExamSnapshot, questionId: string): { section: SnapshotSection; question: SnapshotQuestion } | null {
  for (const section of snapshot.sections) {
    const question = section.questions.find((q) => q.id === questionId);
    if (question) return { section, question };
  }
  return null;
}

export type AttemptAvailability =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: "not_open" | "closed" | "max_attempts" | "unpublished" };

export function assignmentAvailability(
  a: Pick<Assignment, "opensAt" | "dueAt" | "allowLate" | "maxAttempts">,
  examStatus: string,
  finishedAttempts: number,
  now = new Date(),
): AttemptAvailability {
  if (examStatus !== "PUBLISHED") return { ok: false, reason: "unpublished" };
  if (a.opensAt > now) return { ok: false, reason: "not_open" };
  if (a.dueAt && a.dueAt < now && !a.allowLate) return { ok: false, reason: "closed" };
  if (a.maxAttempts !== null && finishedAttempts >= a.maxAttempts) return { ok: false, reason: "max_attempts" };
  return { ok: true };
}

/**
 * Starts (or resumes) the student's attempt. Serialised per (assignment, student) with a
 * Postgres advisory lock, so double clicks / parallel requests never create two attempts.
 */
export async function startOrResumeAttempt(studentId: string, assignment: Assignment & { exam: { status: string } }) {
  const exam = await loadExam(assignment.examId);
  if (!exam) throw new AppError(404, "המבחן לא נמצא");
  const snapshot = buildSnapshot(exam);
  const limit = snapshot.settings.totalTimeLimitSec;

  const { attempt, created } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${assignment.id + ":" + studentId}))`;
    const existing = await tx.attempt.findFirst({ where: { assignmentId: assignment.id, studentId, status: "IN_PROGRESS" } });
    if (existing) return { attempt: existing, created: false };
    // Returned attempts do not count toward the attempt limit (the teacher granted another try).
    const counted = await tx.attempt.count({ where: { assignmentId: assignment.id, studentId, status: "SUBMITTED" } });
    const avail = assignmentAvailability(assignment, assignment.exam.status, counted);
    if (!avail.ok) throw new AppError(409, availabilityMessage(avail.reason));
    const last = await tx.attempt.findFirst({ where: { assignmentId: assignment.id, studentId }, orderBy: { attemptNumber: "desc" }, select: { attemptNumber: true } });
    const attempt = await tx.attempt.create({
      data: {
        assignmentId: assignment.id,
        studentId,
        attemptNumber: (last?.attemptNumber ?? 0) + 1,
        examSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        deadlineAt: limit ? new Date(Date.now() + limit * 1000) : null,
      },
    });
    return { attempt, created: true };
  });
  if (created) await audit(studentId, "attempt.start", { type: "Attempt", id: attempt.id });
  return created ? attempt : finalizeIfExpired(attempt);
}

export function availabilityMessage(reason: "not_open" | "closed" | "max_attempts" | "unpublished") {
  switch (reason) {
    case "not_open":
      return "המשימה עדיין לא נפתחה";
    case "closed":
      return "מועד ההגשה עבר";
    case "max_attempts":
      return "ניצלת את כל הניסיונות המותרים";
    case "unpublished":
      return "המבחן אינו זמין כרגע";
  }
}

/** Auto-submits an attempt whose time limit has passed (plus grace). */
export async function finalizeIfExpired<T extends Attempt>(attempt: T): Promise<T> {
  if (attempt.status === "IN_PROGRESS" && attempt.deadlineAt && attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS < Date.now()) {
    await submitAttempt(attempt.id, attempt.studentId, "timeout");
    return { ...attempt, status: "SUBMITTED", submittedAt: new Date() };
  }
  return attempt;
}

/** Atomic submit: only the first call succeeds, preventing duplicate submissions. */
export async function submitAttempt(attemptId: string, studentId: string, reason: "student" | "timeout" = "student") {
  const r = await db.attempt.updateMany({
    where: { id: attemptId, studentId, status: "IN_PROGRESS" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (r.count === 1) await audit(studentId, "attempt.submit", { type: "Attempt", id: attemptId }, { reason });
  return r.count === 1;
}

/** `client` is the transaction when called inside one: on Vercel the pool has a single connection. */
export async function assertRecordingAllowed(attempt: Attempt, questionId: string, client: Pick<Prisma.TransactionClient, "answer"> = db) {
  if (attempt.status !== "IN_PROGRESS") throw new AppError(409, "המבחן כבר הוגש");
  if (attempt.deadlineAt && attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS < Date.now())
    throw new AppError(409, "הזמן להקלטה הסתיים");
  const snapshot = snapshotOf(attempt);
  const found = findQuestion(snapshot, questionId);
  if (!found) throw new AppError(400, "השאלה אינה חלק מהמבחן");
  if (found.section.choiceMode === "CHOOSE_ONE") {
    const choices = (attempt.choices ?? {}) as Record<string, string>;
    if (choices[found.section.id] && choices[found.section.id] !== questionId)
      throw new AppError(409, "כבר בחרת נושא אחר בחלק זה");
  }
  const answer = await client.answer.findUnique({ where: { attemptId_questionId: { attemptId: attempt.id, questionId } } });
  const count = answer?.recordingCount ?? 0;
  if (count > 0 && !found.question.allowReRecord) throw new AppError(409, "לא ניתן להקליט מחדש בשאלה זו");
  if (found.question.maxRecordings !== null && count >= found.question.maxRecordings)
    throw new AppError(409, "הגעת למספר ההקלטות המרבי לשאלה זו");
  return found;
}

/**
 * Attaches a verified recording to the answer. Runs in a transaction with a row lock on the
 * attempt so concurrent uploads cannot exceed the recording limit. The previous recording
 * (if any) is deleted from storage.
 */
export async function attachRecording(attemptId: string, studentId: string, questionId: string, mediaId: string, durationSec: number | null) {
  const replaced = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Attempt" WHERE id = ${attemptId} FOR UPDATE`;
    const attempt = await tx.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== studentId) throw new AppError(404, "הניסיון לא נמצא");
    const found = await assertRecordingAllowed(attempt, questionId, tx);
    if (durationSec !== null && durationSec > found.question.maxRecordSec + 15)
      throw new AppError(400, "ההקלטה ארוכה מהזמן המותר");

    if (found.section.choiceMode === "CHOOSE_ONE") {
      const choices = { ...((attempt.choices ?? {}) as Record<string, string>), [found.section.id]: questionId };
      await tx.attempt.update({ where: { id: attemptId }, data: { choices } });
    }
    const prev = await tx.answer.findUnique({ where: { attemptId_questionId: { attemptId, questionId } } });
    await tx.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, recordingId: mediaId, recordingCount: 1, durationSec },
      update: { recordingId: mediaId, recordingCount: { increment: 1 }, durationSec },
    });
    await tx.mediaFile.update({ where: { id: mediaId }, data: { status: "READY", durationSec } });
    if (prev?.recordingId && prev.recordingId !== mediaId) {
      const old = await tx.mediaFile.delete({ where: { id: prev.recordingId } });
      return old.storageKey;
    }
    return null;
  });
  if (replaced) await storage().delete(replaced).catch((e) => console.error("failed to delete old recording", e));
}
