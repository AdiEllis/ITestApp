import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { canReadMedia, getManagedStudent, getOwnClassroom, getReviewableAttempt, getStudentAssignment, getViewableExam, getEditableExam } from "@/lib/authz";
import { attachRecording, startOrResumeAttempt } from "@/lib/attempts";
import { copyExam } from "@/lib/exams";
import { storage } from "@/lib/storage";
import { makeMedia, makeUser, resetDb, scenario } from "./helpers";

beforeEach(resetDb);

describe("permissions between teachers, students and schools", () => {
  it("a teacher cannot see another teacher's classroom, students, exams or attempts", async () => {
    const a = await scenario();
    const b = await scenario();
    await expect(getOwnClassroom(b.teacher, a.classroom.id)).rejects.toThrow();
    await expect(getManagedStudent(b.teacher, a.student.id)).rejects.toThrow();
    await expect(getViewableExam(b.teacher, a.exam.id)).rejects.toThrow();
    const attempt = await startOrResumeAttempt(a.student.id, a.assignment);
    await expect(getReviewableAttempt(b.teacher, attempt.id)).rejects.toThrow();
    expect((await getReviewableAttempt(a.teacher, attempt.id)).id).toBe(attempt.id);
  });

  it("students cannot use teacher-only accessors", async () => {
    const a = await scenario();
    await expect(getOwnClassroom(a.student, a.classroom.id)).rejects.toThrow();
    await expect(getViewableExam(a.student, a.exam.id)).rejects.toThrow();
  });

  it("assignments to specific students are invisible to other classmates", async () => {
    const a = await scenario();
    const mate = await makeUser("STUDENT", a.school.id);
    await db.enrollment.create({ data: { classroomId: a.classroom.id, studentId: mate.id } });
    const targeted = await db.assignment.create({ data: { examId: a.exam.id, classroomId: a.classroom.id, createdById: a.teacher.id, specificStudents: true, students: { create: { studentId: a.student.id } } } });
    expect((await getStudentAssignment(a.student, targeted.id)).id).toBe(targeted.id);
    await expect(getStudentAssignment(mate, targeted.id)).rejects.toThrow();
    expect((await getStudentAssignment(mate, a.assignment.id)).id).toBe(a.assignment.id);
  });

  it("recordings: only the student and their teacher may listen", async () => {
    const a = await scenario();
    const b = await scenario();
    const admin = await makeUser("ADMIN", null);
    const attempt = await startOrResumeAttempt(a.student.id, a.assignment);
    const rec = await makeMedia(a.student.id, "RECORDING", "audio/webm");
    await attachRecording(attempt.id, a.student.id, a.exam.sections[1].questions[0].id, rec.id, 5);
    expect(await canReadMedia(a.student, rec.id)).toBe(true);
    expect(await canReadMedia(a.teacher, rec.id)).toBe(true);
    expect(await canReadMedia(b.student, rec.id)).toBe(false);
    expect(await canReadMedia(b.teacher, rec.id)).toBe(false);
    expect(await canReadMedia(admin, rec.id)).toBe(false);
  });

  it("question media: students only via their attempt snapshot", async () => {
    const a = await scenario();
    const b = await scenario();
    expect(await canReadMedia(a.student, a.audio.id)).toBe(false); // not started yet
    await startOrResumeAttempt(a.student.id, a.assignment);
    expect(await canReadMedia(a.student, a.audio.id)).toBe(true);
    expect(await canReadMedia(b.student, a.audio.id)).toBe(false);
    expect(await canReadMedia(b.teacher, a.audio.id)).toBe(false);
  });

  it("pending (unverified) uploads are never served", async () => {
    const a = await scenario();
    const m = await makeMedia(a.teacher.id, "QUESTION_AUDIO");
    await db.mediaFile.update({ where: { id: m.id }, data: { status: "PENDING" } });
    expect(await canReadMedia(a.teacher, m.id)).toBe(false);
  });
});

describe("shared library", () => {
  it("library entries are viewable by any teacher; copies are independent, with their own media", async () => {
    const a = await scenario();
    const b = await scenario();
    const entry = await copyExam(a.exam.id, a.teacher.id, { asLibraryEntry: true });
    expect((await getViewableExam(b.teacher, entry.id)).id).toBe(entry.id);
    const entryAudio = (await db.question.findFirstOrThrow({ where: { section: { examId: entry.id }, audioId: { not: null } } })).audioId!;
    expect(entryAudio).not.toBe(a.audio.id);
    expect(await canReadMedia(b.teacher, entryAudio)).toBe(true);
    expect(await canReadMedia(b.student, entryAudio)).toBe(false);

    const mine = await copyExam(entry.id, b.teacher.id);
    expect(mine.ownerId).toBe(b.teacher.id);
    expect(mine.status).toBe("DRAFT");
    await db.question.updateMany({ where: { section: { examId: mine.id } }, data: { prompt: "edited copy" } });
    const original = await db.question.findMany({ where: { section: { examId: entry.id } } });
    expect(original.every((q) => q.prompt !== "edited copy")).toBe(true);

    // Removing the library entry does not break the copy's media.
    await db.exam.delete({ where: { id: entry.id } });
    const m = await db.mediaFile.findUniqueOrThrow({ where: { id: (await db.question.findFirstOrThrow({ where: { section: { examId: mine.id }, audioId: { not: null } } })).audioId! } });
    expect(await storage().stat(m.storageKey)).not.toBeNull();
  });

  it("private (non-library) exams are not visible to other teachers, and exams with attempts are locked", async () => {
    const a = await scenario();
    const b = await scenario();
    await expect(getViewableExam(b.teacher, a.exam.id)).rejects.toThrow();
    await startOrResumeAttempt(a.student.id, a.assignment);
    await expect(getEditableExam(a.teacher, a.exam.id)).rejects.toThrow(/שכפלו/);
  });
});
