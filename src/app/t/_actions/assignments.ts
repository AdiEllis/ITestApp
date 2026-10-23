"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AppError, getOwnAssignment, getOwnClassroom, getOwnExam, getReviewableAttempt } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { fromLocalInput } from "@/lib/format";
import { snapshotOf } from "@/lib/attempts";
import { questionScore, rubricPercent, totalGrade, round2, countedQuestions } from "@/lib/scoring";
import { storage } from "@/lib/storage";
import type { FormState } from "@/components/ui/form-message";
import { newQuitPassword, newSebKey } from "@/lib/seb";
import { emailNewAssignment } from "@/lib/email";

const assignSchema = z.object({
  examId: z.string().min(1, "יש לבחור מבחן"),
  classroomId: z.string().min(1, "יש לבחור כיתה"),
  opensAt: z.string().optional(),
  dueAt: z.string().optional(),
  allowLate: z.boolean(),
  maxAttempts: z.string().optional(),
  instructions: z.string().max(2000).optional(),
  studentIds: z.array(z.string()).max(200),
  target: z.enum(["class", "students"]),
  requireSeb: z.boolean(),
  sebQuitPassword: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z]{4,20}$/, "סיסמת היציאה: 4–20 ספרות או אותיות באנגלית")
    .optional(),
});

export async function createAssignmentAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["TEACHER"]);
  let id: string;
  try {
    const d = assignSchema.parse({
      examId: form.get("examId"),
      classroomId: form.get("classroomId"),
      opensAt: form.get("opensAt") || undefined,
      dueAt: form.get("dueAt") || undefined,
      allowLate: form.get("allowLate") === "on",
      maxAttempts: form.get("maxAttempts") || undefined,
      instructions: form.get("instructions") || undefined,
      studentIds: form.getAll("studentIds").map(String),
      target: form.get("target") ?? "class",
      requireSeb: form.get("requireSeb") === "on",
      sebQuitPassword: form.get("sebQuitPassword") || undefined,
    });
    const exam = await getOwnExam(user, d.examId);
    if (exam.status !== "PUBLISHED") throw new AppError(400, "יש לפרסם את המבחן לפני השליחה לכיתה");
    const classroom = await getOwnClassroom(user, d.classroomId);
    const opensAt = d.opensAt ? fromLocalInput(d.opensAt) : new Date();
    const dueAt = d.dueAt ? fromLocalInput(d.dueAt) : null;
    if (!opensAt) throw new AppError(400, "מועד פתיחה לא תקין");
    if (dueAt && dueAt <= opensAt) throw new AppError(400, "מועד ההגשה חייב להיות אחרי מועד הפתיחה");
    const maxAttempts = d.maxAttempts ? Number(d.maxAttempts) : null;
    if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 50)) throw new AppError(400, "מספר ניסיונות לא תקין");
    let studentIds: string[] = [];
    if (d.target === "students") {
      const enrolled = await db.enrollment.findMany({ where: { classroomId: classroom.id, studentId: { in: d.studentIds } }, select: { studentId: true } });
      studentIds = enrolled.map((e) => e.studentId);
      if (studentIds.length === 0) throw new AppError(400, "יש לבחור לפחות תלמיד/ה אחד/ת");
    }
    const a = await db.assignment.create({
      data: {
        examId: exam.id,
        classroomId: classroom.id,
        createdById: user.id,
        opensAt,
        dueAt,
        allowLate: d.allowLate,
        maxAttempts,
        instructions: d.instructions?.trim() || null,
        specificStudents: d.target === "students",
        requireSeb: d.requireSeb,
        sebKey: d.requireSeb ? newSebKey() : null,
        sebQuitPassword: d.requireSeb ? (d.sebQuitPassword ?? newQuitPassword()) : null,
        students: { create: studentIds.map((studentId) => ({ studentId })) },
      },
    });
    id = a.id;
    // Email students after the response, so the teacher doesn't wait for the mail server.
    if (form.get("notify") === "on" && opensAt <= new Date()) after(() => emailNewAssignment(a));
    await audit(user.id, "assignment.create", { type: "Assignment", id: a.id }, { examId: exam.id, classroomId: classroom.id });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0].message };
    throw e;
  }
  redirect(`/t/assignments/${id}`);
}

export async function updateAssignmentAction(assignmentId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getOwnAssignment(user, assignmentId);
    const dueRaw = String(form.get("dueAt") ?? "");
    const dueAt = dueRaw ? fromLocalInput(dueRaw) : null;
    if (dueRaw && !dueAt) return { error: "תאריך לא תקין" };
    const maxRaw = String(form.get("maxAttempts") ?? "");
    const maxAttempts = maxRaw ? Number(maxRaw) : null;
    if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 50)) return { error: "מספר ניסיונות לא תקין" };
    await db.assignment.update({ where: { id: assignmentId }, data: { dueAt, allowLate: form.get("allowLate") === "on", maxAttempts } });
    revalidatePath(`/t/assignments/${assignmentId}`);
    return { ok: "נשמר" };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

/** Turns the classroom (Safe Exam Browser) requirement on or off. A new config file is needed after turning it on. */
export async function setRequireSebAction(assignmentId: string, on: boolean): Promise<FormState> {
  const user = await requireUser(["TEACHER"]);
  const a = await getOwnAssignment(user, assignmentId);
  await db.assignment.update({
    where: { id: assignmentId },
    data: on ? { requireSeb: true, sebKey: a.sebKey ?? newSebKey(), sebQuitPassword: a.sebQuitPassword ?? newQuitPassword() } : { requireSeb: false },
  });
  await audit(user.id, on ? "assignment.seb.on" : "assignment.seb.off", { type: "Assignment", id: assignmentId });
  revalidatePath(`/t/assignments/${assignmentId}`);
  return { ok: on ? "המבחן ייפתח רק במחשב הנעול" : "המבחן ייפתח בכל דפדפן" };
}

/** Deletes an assignment with all attempts and their recordings. */
export async function deleteAssignmentAction(assignmentId: string) {
  const user = await requireUser(["TEACHER"]);
  await getOwnAssignment(user, assignmentId);
  const recordings = await db.mediaFile.findMany({ where: { answers: { some: { attempt: { assignmentId } } } }, select: { id: true, storageKey: true } });
  await db.assignment.delete({ where: { id: assignmentId } });
  await db.mediaFile.deleteMany({ where: { id: { in: recordings.map((r) => r.id) } } });
  for (const r of recordings) await storage().delete(r.storageKey).catch(() => undefined);
  await audit(user.id, "assignment.delete", { type: "Assignment", id: assignmentId }, { recordings: recordings.length });
  redirect("/t/assignments");
}

// ---------------- Grading ----------------

const gradeSchema = z.object({
  overallFeedback: z.string().max(5000).nullable(),
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        criterionScores: z.record(z.string(), z.number().min(0).max(100).nullable()).nullable(),
        score: z.number().min(0).max(100).nullable(),
        feedback: z.string().max(3000).nullable(),
      }),
    )
    .max(60),
  publish: z.boolean(),
});
export type GradeInput = z.infer<typeof gradeSchema>;

/**
 * Saves the teacher's grading (draft or published). Scores are computed on the server from
 * rubric criteria (or a direct score when the exam has no rubric). No automated scoring is used.
 */
export async function saveGradesAction(attemptId: string, input: GradeInput): Promise<{ ok: boolean; error?: string; total?: number }> {
  try {
    const user = await requireUser(["TEACHER"]);
    const attempt = await getReviewableAttempt(user, attemptId);
    if (attempt.status === "IN_PROGRESS") throw new AppError(409, "התלמיד/ה עדיין לא הגיש/ה");
    if (attempt.status === "RETURNED") throw new AppError(409, "המבחן הוחזר לתלמיד/ה");
    const d = gradeSchema.parse(input);
    const snapshot = snapshotOf(attempt);
    const choices = (attempt.choices ?? {}) as Record<string, string>;
    const counted = new Map(countedQuestions(snapshot, choices).map((q) => [q.questionId, q.points]));
    const criteria = snapshot.rubric?.criteria ?? null;
    const scores: Record<string, number | null> = {};

    await db.$transaction(async (tx) => {
      for (const a of d.answers) {
        const points = counted.get(a.questionId);
        if (points === undefined) continue; // not part of this attempt's graded questions
        let score: number | null = null;
        let criterionScores: Record<string, number | null> | null = null;
        if (criteria) {
          criterionScores = {};
          for (const c of criteria) criterionScores[c.key] = a.criterionScores?.[c.key] ?? null;
          const pct = rubricPercent(criteria, criterionScores);
          score = pct === null ? null : questionScore(points, pct);
        } else if (a.score !== null) {
          score = round2(Math.min(points, Math.max(0, a.score)));
        }
        scores[a.questionId] = score;
        await tx.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
          create: { attemptId, questionId: a.questionId, score, criterionScores: (criterionScores ?? undefined) as Prisma.InputJsonValue | undefined, feedback: a.feedback?.trim() || null },
          update: { score, criterionScores: (criterionScores ?? undefined) as Prisma.InputJsonValue | undefined, feedback: a.feedback?.trim() || null },
        });
      }
      if (d.publish) {
        const missing = [...counted.keys()].filter((qid) => !qid.startsWith("__unchosen__") && (scores[qid] === null || scores[qid] === undefined));
        // Unanswered questions may be left ungraded (they count as 0); answered ones must be graded.
        const answered = await tx.answer.findMany({ where: { attemptId, recordingId: { not: null } }, select: { questionId: true } });
        const answeredSet = new Set(answered.map((x) => x.questionId));
        if (missing.some((qid) => answeredSet.has(qid))) throw new AppError(400, "יש לתת ציון לכל השאלות שנענו לפני פרסום");
      }
      const total = totalGrade(snapshot, choices, scores);
      await tx.attempt.update({
        where: { id: attemptId },
        data: {
          overallFeedback: d.overallFeedback?.trim() || null,
          totalScore: total,
          gradedAt: new Date(),
          gradingStatus: d.publish ? "PUBLISHED" : "DRAFT",
          publishedAt: d.publish ? new Date() : attempt.publishedAt,
        },
      });
    });
    await audit(user.id, d.publish ? "grade.publish" : "grade.draft", { type: "Attempt", id: attemptId });
    revalidatePath(`/t/review/${attemptId}`);
    revalidatePath(`/t/assignments/${attempt.assignmentId}`);
    return { ok: true, total: totalGrade(snapshot, choices, scores) };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "נתונים לא תקינים" };
    throw e;
  }
}

export async function unpublishGradesAction(attemptId: string) {
  const user = await requireUser(["TEACHER"]);
  await getReviewableAttempt(user, attemptId);
  await db.attempt.update({ where: { id: attemptId }, data: { gradingStatus: "DRAFT" } });
  await audit(user.id, "grade.unpublish", { type: "Attempt", id: attemptId });
  revalidatePath(`/t/review/${attemptId}`);
}

/** Returns a submitted attempt to the student for another try (keeps the recordings for history). */
export async function returnAttemptAction(attemptId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser(["TEACHER"]);
  const attempt = await getReviewableAttempt(user, attemptId);
  if (attempt.status !== "SUBMITTED") return { ok: false, error: "ניתן להחזיר רק מבחן שהוגש" };
  await db.attempt.update({ where: { id: attemptId }, data: { status: "RETURNED", returnedAt: new Date(), returnNote: note.trim().slice(0, 1000) || null } });
  await audit(user.id, "attempt.return", { type: "Attempt", id: attemptId });
  revalidatePath(`/t/review/${attemptId}`);
  return { ok: true };
}
