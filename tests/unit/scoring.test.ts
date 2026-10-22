import { describe, expect, it } from "vitest";
import { countedQuestions, questionScore, rubricPercent, totalGrade } from "@/lib/scoring";
import { defaultCobeRubric } from "@/lib/cobe";
import type { ExamSnapshot } from "@/lib/exam-types";

const q = (id: string, points = 25) => ({
  id, title: id, prompt: "p", subQuestions: [], instructions: null, audioId: null, videoId: null, imageId: null,
  maxMediaPlays: null, prepTimeSec: 0, maxRecordSec: 60, allowReRecord: true, maxRecordings: null, points,
});
const snapshot: ExamSnapshot = {
  examId: "e", title: "t", description: null, mode: "SIMULATION", level: "FOUR_AND_FIVE",
  settings: { totalTimeLimitSec: null, allowBackNavigation: true, allowReviewOwnRecording: true, deviceVoiceFallback: false },
  rubric: null, media: {},
  sections: [
    { id: "A", title: "A", instructions: null, kind: "PERSONAL_RESPONSE", choiceMode: "CHOOSE_ONE", mediaId: null, mediaMime: null, maxMediaPlays: null, questions: [q("a1"), q("a2")] },
    { id: "B", title: "B", instructions: null, kind: "PROJECT", choiceMode: "ALL", mediaId: null, mediaMime: null, maxMediaPlays: null, questions: [q("b1")] },
    { id: "C", title: "C", instructions: null, kind: "AUDIO_VISUAL", choiceMode: "ALL", mediaId: null, mediaMime: null, maxMediaPlays: null, questions: [q("c1"), q("c2")] },
  ],
};

describe("rubric scoring", () => {
  const criteria = defaultCobeRubric();
  it("default rubric weights sum to 100", () => {
    expect(criteria.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });
  it("computes weighted percent", () => {
    expect(rubricPercent(criteria, { topic: 100, delivery: 100, vocabulary: 100, language: 100 })).toBe(100);
    expect(rubricPercent(criteria, { topic: 80, delivery: 60, vocabulary: 70, language: 50 })).toBe(40 + 9 + 14 + 7.5);
  });
  it("returns null when a criterion is missing", () => {
    expect(rubricPercent(criteria, { topic: 80 })).toBeNull();
  });
  it("clamps out-of-range criterion scores", () => {
    expect(rubricPercent(criteria, { topic: 150, delivery: -5, vocabulary: 100, language: 100 })).toBe(50 + 0 + 20 + 15);
  });
  it("scales to question points", () => {
    expect(questionScore(25, 80)).toBe(20);
  });
});

describe("total grade", () => {
  it("counts only the chosen topic in CHOOSE_ONE sections", () => {
    const counted = countedQuestions(snapshot, { A: "a2" }).map((x) => x.questionId);
    expect(counted).toEqual(["a2", "b1", "c1", "c2"]);
  });
  it("normalises to 100 and treats unanswered questions as 0", () => {
    expect(totalGrade(snapshot, { A: "a1" }, { a1: 25, b1: 25, c1: 25, c2: 25 })).toBe(100);
    expect(totalGrade(snapshot, { A: "a1" }, { a1: 20, b1: 15 })).toBe(35);
  });
  it("ignores scores for the unchosen topic", () => {
    expect(totalGrade(snapshot, { A: "a1" }, { a2: 25 })).toBe(0);
  });
  it("an unchosen section still counts in the maximum", () => {
    expect(totalGrade(snapshot, {}, { b1: 25, c1: 25, c2: 25 })).toBe(75);
  });
});
