import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { assertRecordingAllowed, attachRecording, finalizeIfExpired, startOrResumeAttempt, submitAttempt } from "@/lib/attempts";
import { makeMedia, resetDb, scenario } from "./helpers";

beforeEach(resetDb);

describe("attempt lifecycle", () => {
  it("start is idempotent: a second start resumes the same attempt", async () => {
    const s = await scenario();
    const [a, b] = await Promise.all([startOrResumeAttempt(s.student.id, s.assignment), startOrResumeAttempt(s.student.id, s.assignment)]);
    expect(a.id).toBe(b.id);
    expect(await db.attempt.count()).toBe(1);
  });

  it("freezes the exam in a snapshot so later edits do not affect the attempt", async () => {
    const s = await scenario();
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    await db.question.updateMany({ where: { sectionId: s.exam.sections[1].id }, data: { prompt: "CHANGED" } });
    const snap = (await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).examSnapshot as { sections: { questions: { prompt: string }[] }[] };
    expect(snap.sections[1].questions[0].prompt).toBe("Q");
  });

  it("re-recording replaces the previous file and enforces the recording limit", async () => {
    const s = await scenario({ maxRecordings: 2 });
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    const qid = s.exam.sections[1].questions[0].id;
    const r1 = await makeMedia(s.student.id, "RECORDING", "audio/webm");
    await attachRecording(attempt.id, s.student.id, qid, r1.id, 10);
    const r2 = await makeMedia(s.student.id, "RECORDING", "audio/webm");
    await attachRecording(attempt.id, s.student.id, qid, r2.id, 12);
    expect(await db.mediaFile.findUnique({ where: { id: r1.id } })).toBeNull();
    expect(await storage().stat(r1.storageKey)).toBeNull();
    const ans = await db.answer.findFirstOrThrow({ where: { attemptId: attempt.id } });
    expect(ans.recordingId).toBe(r2.id);
    expect(ans.recordingCount).toBe(2);
    const fresh = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    await expect(assertRecordingAllowed(fresh, qid)).rejects.toThrow(/המרבי/);
  });

  it("refuses re-recording when not allowed", async () => {
    const s = await scenario({ allowReRecord: false, maxRecordings: null });
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    const qid = s.exam.sections[1].questions[0].id;
    await attachRecording(attempt.id, s.student.id, qid, (await makeMedia(s.student.id, "RECORDING", "audio/webm")).id, 5);
    const fresh = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    await expect(assertRecordingAllowed(fresh, qid)).rejects.toThrow(/מחדש/);
  });

  it("locks the topic choice after recording in a CHOOSE_ONE section", async () => {
    const s = await scenario();
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    const [t1, t2] = s.exam.sections[0].questions;
    await attachRecording(attempt.id, s.student.id, t1.id, (await makeMedia(s.student.id, "RECORDING", "audio/webm")).id, 5);
    const fresh = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect((fresh.choices as Record<string, string>)[s.exam.sections[0].id]).toBe(t1.id);
    await expect(assertRecordingAllowed(fresh, t2.id)).rejects.toThrow(/נושא אחר/);
  });

  it("rejects recordings for questions outside the exam and over-long recordings", async () => {
    const s = await scenario();
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    await expect(assertRecordingAllowed(attempt, "not-a-question")).rejects.toThrow();
    const rec = await makeMedia(s.student.id, "RECORDING", "audio/webm");
    await expect(attachRecording(attempt.id, s.student.id, s.exam.sections[1].questions[0].id, rec.id, 9999)).rejects.toThrow(/ארוכה/);
  });

  it("submits exactly once (no duplicate submission) and blocks recording afterwards", async () => {
    const s = await scenario();
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    const results = await Promise.all([submitAttempt(attempt.id, s.student.id), submitAttempt(attempt.id, s.student.id), submitAttempt(attempt.id, s.student.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const fresh = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(fresh.status).toBe("SUBMITTED");
    await expect(assertRecordingAllowed(fresh, s.exam.sections[1].questions[0].id)).rejects.toThrow(/הוגש/);
    expect(await db.auditLog.count({ where: { action: "attempt.submit" } })).toBe(1);
  });

  it("another student cannot attach to someone else's attempt", async () => {
    const s = await scenario();
    const other = await scenario();
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    const rec = await makeMedia(other.student.id, "RECORDING", "audio/webm");
    await expect(attachRecording(attempt.id, other.student.id, s.exam.sections[1].questions[0].id, rec.id, 5)).rejects.toThrow();
  });

  it("auto-submits an attempt after its time limit (plus grace)", async () => {
    const s = await scenario({ timeLimitSec: 60 });
    const attempt = await startOrResumeAttempt(s.student.id, s.assignment);
    expect(attempt.deadlineAt).not.toBeNull();
    await db.attempt.update({ where: { id: attempt.id }, data: { deadlineAt: new Date(Date.now() - 10 * 60_000) } });
    const expired = await finalizeIfExpired(await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } }));
    expect(expired.status).toBe("SUBMITTED");
  });

  it("respects maxAttempts and allows another try after the teacher returns the attempt", async () => {
    const s = await scenario();
    await db.assignment.update({ where: { id: s.assignment.id }, data: { maxAttempts: 1 } });
    const a = { ...s.assignment, maxAttempts: 1 };
    const first = await startOrResumeAttempt(s.student.id, a);
    await submitAttempt(first.id, s.student.id);
    await expect(startOrResumeAttempt(s.student.id, a)).rejects.toThrow(/ניסיונות/);
    await db.attempt.update({ where: { id: first.id }, data: { status: "RETURNED" } });
    const second = await startOrResumeAttempt(s.student.id, a);
    expect(second.attemptNumber).toBe(2);
  });

  it("closed assignments (due date passed, no late submissions) cannot be started", async () => {
    const s = await scenario();
    const a = { ...s.assignment, dueAt: new Date(Date.now() - 1000), allowLate: false };
    await expect(startOrResumeAttempt(s.student.id, a)).rejects.toThrow(/מועד/);
  });
});
