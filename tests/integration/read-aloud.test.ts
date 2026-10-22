import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadExam, publishProblems, copyExam, buildSnapshot } from "@/lib/exams";
import { makeMedia, resetDb, scenario } from "./helpers";

beforeEach(resetDb);

async function problemsFor(examId: string) {
  return publishProblems((await loadExam(examId))!);
}

describe("read-aloud before publishing", () => {
  it("requires approved audio for every question unless the device voice is allowed", async () => {
    const s = await scenario();
    await db.exam.update({ where: { id: s.exam.id }, data: { settings: { allowBackNavigation: true, allowReviewOwnRecording: true, deviceVoiceFallback: false } } });
    const p = await problemsFor(s.exam.id);
    // two topics without audio, one question with audio that was never approved
    expect(p.filter((x) => x.includes("אין עדיין הקראה"))).toHaveLength(2);
    expect(p.filter((x) => x.includes("ולאשר"))).toHaveLength(1);

    await db.exam.update({ where: { id: s.exam.id }, data: { settings: { deviceVoiceFallback: true } } });
    const p2 = await problemsFor(s.exam.id);
    expect(p2.some((x) => x.includes("אין עדיין הקראה"))).toBe(false);
    expect(p2.filter((x) => x.includes("ולאשר"))).toHaveLength(1);
  });

  it("approved audio passes, and stops passing when the question text changes", async () => {
    const s = await scenario();
    await db.exam.update({ where: { id: s.exam.id }, data: { settings: { deviceVoiceFallback: true } } });
    const q = s.exam.sections[1].questions[0];
    await db.question.update({ where: { id: q.id }, data: { audioApproved: true, audioSource: "TTS", audioText: "Q" } });
    expect(await problemsFor(s.exam.id)).toEqual([]);
    await db.question.update({ where: { id: q.id }, data: { prompt: "Q changed" } });
    expect((await problemsFor(s.exam.id)).some((x) => x.includes("השתנתה"))).toBe(true);
    // fixing the pronunciation text makes it match again only if the audio was made from it
    await db.question.update({ where: { id: q.id }, data: { readText: "Q" } });
    expect(await problemsFor(s.exam.id)).toEqual([]);
  });

  it("copies keep the approved reading, and the student snapshot carries the reading text", async () => {
    const s = await scenario();
    const q = s.exam.sections[1].questions[0];
    await db.question.update({ where: { id: q.id }, data: { audioApproved: true, audioSource: "TEACHER", audioText: "Q", readText: "קְרִיאָה" } });
    await db.exam.update({ where: { id: s.exam.id }, data: { subject: "היסטוריה" } });
    const copy = await copyExam(s.exam.id, s.teacher.id);
    const loaded = (await loadExam(copy.id))!;
    expect(loaded.subject).toBe("היסטוריה");
    const cq = loaded.sections[1].questions[0];
    expect(cq.audioApproved).toBe(true);
    expect(cq.audioId).not.toBe(q.audioId);
    expect(buildSnapshot(loaded).sections[1].questions[0].readText).toBe("קְרִיאָה");
  });

  it("a new audio file is not approved by default", async () => {
    const s = await scenario();
    const m = await makeMedia(s.teacher.id, "QUESTION_AUDIO");
    const q = await db.question.create({ data: { sectionId: s.exam.sections[1].id, order: 5, prompt: "חדשה", audioId: m.id } });
    expect(q.audioApproved).toBe(false);
  });
});
