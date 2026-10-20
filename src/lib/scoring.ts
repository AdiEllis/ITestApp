import type { ExamSnapshot, RubricCriterion } from "./exam-types";

/** Weighted rubric percentage (0..100) from per-criterion scores (each 0..100). Missing criteria => null. */
export function rubricPercent(criteria: RubricCriterion[], scores: Record<string, number | null | undefined>): number | null {
  let total = 0;
  for (const c of criteria) {
    const v = scores[c.key];
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    total += (Math.min(100, Math.max(0, v)) * c.weight) / 100;
  }
  return round2(total);
}

/** Question score in points from a rubric percentage. */
export function questionScore(points: number, percent: number): number {
  return round2((points * percent) / 100);
}

/** The questions that count toward the grade, honoring CHOOSE_ONE sections. */
export function countedQuestions(snapshot: ExamSnapshot, choices: Record<string, string>) {
  const out: { sectionId: string; questionId: string; points: number }[] = [];
  for (const s of snapshot.sections) {
    if (s.choiceMode === "CHOOSE_ONE") {
      const chosen = s.questions.find((q) => q.id === choices[s.id]) ?? null;
      // If the student never chose, the section still counts (as 0) using its first option's points.
      const q = chosen ?? s.questions[0];
      if (q) out.push({ sectionId: s.id, questionId: chosen ? q.id : `__unchosen__${s.id}`, points: q.points });
    } else {
      for (const q of s.questions) out.push({ sectionId: s.id, questionId: q.id, points: q.points });
    }
  }
  return out;
}

/**
 * Final grade 0..100. Unanswered/ungraded counted questions score 0
 * (as in the official exam, an empty answer receives 0).
 */
export function totalGrade(
  snapshot: ExamSnapshot,
  choices: Record<string, string>,
  scores: Record<string, number | null | undefined>,
): number {
  const counted = countedQuestions(snapshot, choices);
  const max = counted.reduce((s, q) => s + q.points, 0);
  if (max <= 0) return 0;
  const got = counted.reduce((s, q) => s + Math.min(q.points, Math.max(0, scores[q.questionId] ?? 0)), 0);
  return round2((got / max) * 100);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
