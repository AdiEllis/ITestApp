import { z } from "zod";

export const examSettingsSchema = z.object({
  /** Whole-exam time limit in seconds. null = no limit. */
  totalTimeLimitSec: z.number().int().min(60).max(4 * 3600).nullable().default(null),
  /** May the student go back to earlier questions? */
  allowBackNavigation: z.boolean().default(true),
  /** May the student listen to their own recording before submitting? */
  allowReviewOwnRecording: z.boolean().default(true),
});
export type ExamSettings = z.infer<typeof examSettingsSchema>;

export function parseSettings(raw: unknown): ExamSettings {
  const r = examSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : examSettingsSchema.parse({});
}

export const rubricBandSchema = z.object({
  label: z.string().max(60),
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  descriptor: z.string().max(1000),
});
export const rubricCriterionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().min(1).max(80),
  weight: z.number().min(0).max(100),
  description: z.string().max(1000).default(""),
  bands: z.array(rubricBandSchema).max(8).default([]),
});
export const rubricCriteriaSchema = z
  .array(rubricCriterionSchema)
  .min(1)
  .max(10)
  .refine((c) => Math.abs(c.reduce((s, x) => s + x.weight, 0) - 100) < 0.01, "סכום המשקלים חייב להיות 100")
  .refine((c) => new Set(c.map((x) => x.key)).size === c.length, "מפתחות קריטריונים חייבים להיות ייחודיים");
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export interface SnapshotQuestion {
  id: string;
  title: string | null;
  prompt: string;
  subQuestions: string[];
  instructions: string | null;
  audioId: string | null;
  videoId: string | null;
  imageId: string | null;
  maxMediaPlays: number | null;
  prepTimeSec: number;
  maxRecordSec: number;
  allowReRecord: boolean;
  maxRecordings: number | null;
  points: number;
}
export interface SnapshotSection {
  id: string;
  title: string;
  instructions: string | null;
  kind: "PERSONAL_RESPONSE" | "PROJECT" | "AUDIO_VISUAL" | "GENERAL";
  choiceMode: "ALL" | "CHOOSE_ONE";
  mediaId: string | null;
  mediaMime: string | null;
  maxMediaPlays: number | null;
  questions: SnapshotQuestion[];
}
export interface ExamSnapshot {
  examId: string;
  title: string;
  description: string | null;
  mode: "PRACTICE" | "SIMULATION";
  level: string;
  settings: ExamSettings;
  rubric: { id: string; name: string; criteria: RubricCriterion[] } | null;
  sections: SnapshotSection[];
  /** mime types of every media id referenced, for rendering */
  media: Record<string, { mimeType: string }>;
}

export const LEVEL_LABELS: Record<string, string> = {
  FOUR_POINTS: "4 יח״ל",
  FIVE_POINTS: "5 יח״ל",
  FOUR_AND_FIVE: "4 ו־5 יח״ל",
  OTHER: "אחר",
};
export const MODE_LABELS: Record<string, string> = { PRACTICE: "תרגול", SIMULATION: "סימולציה" };
export const SECTION_KIND_LABELS: Record<string, string> = {
  PERSONAL_RESPONSE: "Personal Response",
  PROJECT: "Project",
  AUDIO_VISUAL: "Audio-Visual Prompt",
  GENERAL: "כללי",
};
