import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./auth";
import type { ExamSnapshot } from "./exam-types";

/** Error with a safe, user-facing message. Anything else is reported as a generic error. */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = () => new AppError(404, "הפריט לא נמצא או שאין לך הרשאה אליו");
export const forbidden = () => new AppError(403, "אין לך הרשאה לבצע פעולה זו");

export function assertRole(user: SessionUser, ...roles: SessionUser["role"][]) {
  if (!roles.includes(user.role)) throw forbidden();
}

// ---------- Classrooms ----------

export async function getOwnClassroom(user: SessionUser, classroomId: string) {
  assertRole(user, "TEACHER", "ADMIN");
  const c = await db.classroom.findUnique({ where: { id: classroomId } });
  if (!c) throw notFound();
  if (user.role === "TEACHER" && c.teacherId !== user.id) throw notFound();
  return c;
}

/** Teacher may manage a student only if the student is enrolled in one of their classrooms (same school). */
export async function getManagedStudent(user: SessionUser, studentId: string) {
  assertRole(user, "TEACHER", "ADMIN");
  const student = await db.user.findFirst({
    where: {
      id: studentId,
      role: "STUDENT",
      ...(user.role === "TEACHER" ? { enrollments: { some: { classroom: { teacherId: user.id } } } } : {}),
    },
  });
  if (!student) throw notFound();
  return student;
}

// ---------- Exams ----------

export async function getOwnExam(user: SessionUser, examId: string) {
  assertRole(user, "TEACHER", "ADMIN");
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.isLibraryEntry) throw notFound();
  if (exam.ownerId !== user.id) throw notFound();
  return exam;
}

/** An exam is locked for editing once any student started an attempt on it. */
export async function examHasAttempts(examId: string) {
  const n = await db.attempt.count({ where: { assignment: { examId } } });
  return n > 0;
}

export async function getEditableExam(user: SessionUser, examId: string) {
  const exam = await getOwnExam(user, examId);
  if (await examHasAttempts(examId))
    throw new AppError(409, "לא ניתן לערוך מבחן שתלמידים כבר התחילו לבצע. שכפלו אותו כדי ליצור גרסה חדשה.");
  return exam;
}

/** Owner, or any teacher for published library entries, or admin. */
export async function getViewableExam(user: SessionUser, examId: string) {
  assertRole(user, "TEACHER", "ADMIN");
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) throw notFound();
  if (user.role === "ADMIN") return exam;
  if (exam.ownerId === user.id) return exam;
  if (exam.isLibraryEntry && exam.status === "PUBLISHED") return exam;
  throw notFound();
}

// ---------- Assignments & attempts ----------

export function studentAssignmentWhere(studentId: string): Prisma.AssignmentWhereInput {
  return {
    classroom: { archived: false, enrollments: { some: { studentId } } },
    OR: [{ specificStudents: false }, { students: { some: { studentId } } }],
  };
}

export async function getStudentAssignment(user: SessionUser, assignmentId: string) {
  assertRole(user, "STUDENT");
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, ...studentAssignmentWhere(user.id) },
    include: { exam: true },
  });
  if (!a) throw notFound();
  return a;
}

export async function getOwnAttempt(user: SessionUser, attemptId: string) {
  assertRole(user, "STUDENT");
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, include: { assignment: true } });
  if (!attempt || attempt.studentId !== user.id) throw notFound();
  return attempt;
}

/** Teacher who created the assignment's classroom (or admin) may review it. */
export async function getReviewableAttempt(user: SessionUser, attemptId: string) {
  assertRole(user, "TEACHER", "ADMIN");
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { assignment: { include: { classroom: true } }, student: { select: { id: true, name: true, username: true } } },
  });
  if (!attempt) throw notFound();
  if (user.role === "TEACHER" && attempt.assignment.classroom.teacherId !== user.id) throw notFound();
  return attempt;
}

export async function getOwnAssignment(user: SessionUser, assignmentId: string) {
  assertRole(user, "TEACHER", "ADMIN");
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, include: { classroom: true, exam: true } });
  if (!a) throw notFound();
  if (user.role === "TEACHER" && a.classroom.teacherId !== user.id) throw notFound();
  return a;
}

// ---------- Media ----------

function snapshotMediaIds(snapshot: ExamSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const s of snapshot.sections) {
    if (s.mediaId) ids.add(s.mediaId);
    for (const q of s.questions) for (const id of [q.audioId, q.videoId, q.imageId]) if (id) ids.add(id);
  }
  return ids;
}

/**
 * Central media read check. Every file download goes through here.
 * - Recordings: the student who made it, or the teacher of the class the attempt belongs to.
 * - Question media: the owner; any teacher if used in a published library entry; a student
 *   if referenced by the snapshot of one of their attempts; admins (non-recordings only).
 */
export async function canReadMedia(user: SessionUser, mediaId: string): Promise<boolean> {
  const media = await db.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media || media.status !== "READY") return false;

  if (media.kind === "RECORDING") {
    if (media.ownerId === user.id) return true;
    if (user.role !== "TEACHER") return false;
    const n = await db.answer.count({
      where: { recordingId: mediaId, attempt: { assignment: { classroom: { teacherId: user.id } } } },
    });
    return n > 0;
  }

  if (media.ownerId === user.id || user.role === "ADMIN") return true;

  if (user.role === "TEACHER") {
    const inLibrary = await db.exam.count({
      where: {
        isLibraryEntry: true,
        status: "PUBLISHED",
        sections: {
          some: {
            OR: [
              { mediaId },
              { questions: { some: { OR: [{ audioId: mediaId }, { videoId: mediaId }, { imageId: mediaId }] } } },
            ],
          },
        },
      },
    });
    return inLibrary > 0;
  }

  if (user.role === "STUDENT") {
    const attempts = await db.attempt.findMany({
      where: { studentId: user.id },
      select: { examSnapshot: true },
      orderBy: { startedAt: "desc" },
      take: 200,
    });
    return attempts.some((a) => snapshotMediaIds(a.examSnapshot as unknown as ExamSnapshot).has(mediaId));
  }
  return false;
}
