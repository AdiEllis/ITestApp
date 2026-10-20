import { db } from "@/lib/db";
import { friendlyCode, randomToken } from "@/lib/crypto";
import { storage } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth";
import type { Role } from "@prisma/client";

export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "AuditLog","Answer","Attempt","AssignmentStudent","Assignment","ExamSourceFile","Question","ExamSection","Exam","MediaFile","Rubric","Enrollment","Classroom","Session","RateLimit","User","School" CASCADE`,
  );
}

export async function makeSchool() {
  return db.school.create({ data: { name: "School " + randomToken(3), teacherInviteCode: friendlyCode(8) } });
}

export async function makeUser(role: Role, schoolId: string | null): Promise<SessionUser> {
  const u = await db.user.create({ data: { username: `${role.toLowerCase()}.${randomToken(5)}`.toLowerCase(), name: role + " user", role, schoolId, passwordHash: "x" } });
  return { id: u.id, name: u.name, username: u.username, email: null, role, schoolId, mustChangePassword: false, isDemo: false };
}

export async function makeMedia(ownerId: string, kind: "QUESTION_AUDIO" | "QUESTION_VIDEO" | "RECORDING" | "SOURCE_DOCUMENT", mime = "audio/mpeg") {
  const key = `${kind.toLowerCase()}/test/${randomToken(10)}.bin`;
  await storage().put(key, Buffer.from("ID3test-bytes"), mime);
  return db.mediaFile.create({ data: { ownerId, kind, status: "READY", storageKey: key, mimeType: mime, sizeBytes: 13 } });
}

/** Teacher + class + student + published 2-section exam (CHOOSE_ONE + ALL) + assignment. */
export async function scenario(opts: { timeLimitSec?: number | null; maxRecordings?: number | null; allowReRecord?: boolean } = {}) {
  const school = await makeSchool();
  const teacher = await makeUser("TEACHER", school.id);
  const student = await makeUser("STUDENT", school.id);
  const classroom = await db.classroom.create({ data: { name: "C", schoolId: school.id, teacherId: teacher.id, joinCode: friendlyCode(6), enrollments: { create: { studentId: student.id } } } });
  const audio = await makeMedia(teacher.id, "QUESTION_AUDIO");
  const exam = await db.exam.create({
    data: {
      ownerId: teacher.id,
      title: "Exam",
      status: "PUBLISHED",
      mode: "SIMULATION",
      settings: { totalTimeLimitSec: opts.timeLimitSec ?? null, allowBackNavigation: true, allowReviewOwnRecording: true },
      sections: {
        create: [
          {
            order: 0, title: "A", kind: "PERSONAL_RESPONSE", choiceMode: "CHOOSE_ONE",
            questions: { create: [{ order: 0, prompt: "Topic 1" }, { order: 1, prompt: "Topic 2" }] },
          },
          {
            order: 1, title: "B", kind: "GENERAL", choiceMode: "ALL",
            questions: { create: [{ order: 0, prompt: "Q", audioId: audio.id, maxRecordings: opts.maxRecordings === undefined ? 2 : opts.maxRecordings, allowReRecord: opts.allowReRecord ?? true }] },
          },
        ],
      },
    },
    include: { sections: { orderBy: { order: "asc" }, include: { questions: { orderBy: { order: "asc" } } } } },
  });
  const assignment = await db.assignment.create({ data: { examId: exam.id, classroomId: classroom.id, createdById: teacher.id }, include: { exam: true } });
  return { school, teacher, student, classroom, exam, assignment, audio };
}
