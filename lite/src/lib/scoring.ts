import type { Criterion, Exam } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function rubricPercent(criteria: Criterion[], scores: Record<string, number | null | undefined>): number | null {
  let total = 0;
  for (const c of criteria) {
    const v = scores[c.key];
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    total += (Math.min(100, Math.max(0, v)) * c.weight) / 100;
  }
  return round2(total);
}

/** Questions that count toward the grade, honoring CHOOSE_ONE sections. */
export function countedQuestions(exam: Exam, choices: Record<string, string>) {
  const out: { sectionId: string; questionId: string; points: number }[] = [];
  for (const s of exam.sections) {
    if (s.choiceMode === "CHOOSE_ONE") {
      const chosen = s.questions.find((q) => q.id === choices[s.id]);
      const q = chosen ?? s.questions[0];
      if (q) out.push({ sectionId: s.id, questionId: chosen ? q.id : `__unchosen__${s.id}`, points: q.points });
    } else for (const q of s.questions) out.push({ sectionId: s.id, questionId: q.id, points: q.points });
  }
  return out;
}

/** Final grade 0..100; unanswered or ungraded questions count as 0. */
export function totalGrade(exam: Exam, choices: Record<string, string>, scores: Record<string, number | null | undefined>) {
  const counted = countedQuestions(exam, choices);
  const max = counted.reduce((s, q) => s + q.points, 0);
  if (max <= 0) return 0;
  const got = counted.reduce((s, q) => s + Math.min(q.points, Math.max(0, scores[q.questionId] ?? 0)), 0);
  return round2((got / max) * 100);
}
