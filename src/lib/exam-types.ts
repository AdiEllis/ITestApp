import { z } from "zod";

export const examSettingsSchema = z.object({
  /** Whole-exam time limit in seconds. null = no limit. */
  totalTimeLimitSec: z.number().int().min(60).max(4 * 3600).nullable().default(null),
  /** May the student go back to earlier questions? */
  allowBackNavigation: z.boolean().default(true),
  /** May the student listen to their own recording before submitting? */
  allowReviewOwnRecording: z.boolean().default(true),
  /**
   * Questions without an approved audio file are read by the device's own voice.
   * Off by default: every question then needs audio the teacher listened to and approved,
   * so every student hears exactly the same, checked reading.
   */
  deviceVoiceFallback: z.boolean().default(false),
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
  /** Text read aloud by the device voice when the question has no audio file (see deviceVoiceFallback). */
  readText?: string | null;
  audioId: string | null;
  videoId: string | null;
  imageId: string | null;
  videoUrl?: string | null;
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
  videoUrl?: string | null;
  maxMediaPlays: number | null;
  questions: SnapshotQuestion[];
}
export interface ExamSnapshot {
  examId: string;
  title: string;
  description: string | null;
  subject?: string | null;
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
export const MODE_LABELS: Record<string, string> = { PRACTICE: "תרגול", SIMULATION: "מבחן" };
export const SECTION_KIND_LABELS: Record<string, string> = {
  GENERAL: "שאלות",
  AUDIO_VISUAL: "צפייה או האזנה ואז שאלות",
  PERSONAL_RESPONSE: "Personal Response (אנגלית)",
  PROJECT: "Project (אנגלית)",
};

/** Subjects offered as suggestions. Teachers can type any other subject. */
export const SUBJECT_SUGGESTIONS = [
  "היסטוריה",
  "תנ״ך",
  "ספרות",
  "לשון",
  "אזרחות",
  "גאוגרפיה",
  "ביולוגיה",
  "כימיה",
  "פיזיקה",
  "מתמטיקה",
  "אנגלית",
  "ערבית",
  "מדעי המחשב",
  "תולדות עם ישראל",
  "מחשבת ישראל",
];

/**
 * Recording time for a question without a time limit. The proctor decides when to stop;
 * this is only a safety cap so a forgotten recording doesn't run forever.
 */
export const OPEN_RECORD_SEC = 900;

export function hasRecordLimit(maxRecordSec: number) {
  return maxRecordSec < OPEN_RECORD_SEC;
}

/** Whether a question has any time or attempt limit (prep time, recording time or number of recordings). */
export function hasQuestionLimits(q: { prepTimeSec: number; maxRecordSec: number; maxRecordings: number | null }) {
  return q.prepTimeSec > 0 || hasRecordLimit(q.maxRecordSec) || q.maxRecordings != null;
}

/**
 * The text a question's read-aloud voice speaks: the teacher's reading text (for example with niqqud)
 * or, when there is none, the question and its follow-up questions.
 */
export function spokenText(q: { prompt: string; subQuestions: string[]; readText?: string | null }): string {
  const custom = q.readText?.trim();
  if (custom) return custom;
  const subs = q.subQuestions.map((s) => s.trim()).filter(Boolean);
  return [q.prompt.trim(), ...subs.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join("\n");
}

/** Audio that was made for a different text (the question changed afterwards) is stale. */
export function audioMatchesText(q: { prompt: string; subQuestions: string[]; readText?: string | null; audioText?: string | null }) {
  return q.audioText == null || q.audioText === spokenText(q);
}

/** Hebrew, Arabic or English voice, picked from the text itself. */
export function detectLanguage(text: string): "he-IL" | "ar-SA" | "en-US" {
  const he = (text.match(/[\u0590-\u05FF]/g) ?? []).length;
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (he >= ar && he >= en && he > 0) return "he-IL";
  if (ar > en) return "ar-SA";
  return "en-US";
}
