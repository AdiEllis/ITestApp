export interface Criterion {
  key: string;
  label: string;
  weight: number;
  description: string;
  bands: { label: string; min: number; max: number; descriptor: string }[];
}

export interface Question {
  id: string;
  title: string;
  prompt: string;
  subQuestions: string[];
  instructions: string;
  /** YouTube / Vimeo / Google Drive / direct video URL */
  videoUrl: string;
  /** Let students hear the question read aloud by the device's built-in voice */
  tts: boolean;
  maxPlays: number | null;
  prepTimeSec: number;
  maxRecordSec: number;
  allowReRecord: boolean;
  maxRecordings: number | null;
  points: number;
}

export interface Section {
  id: string;
  title: string;
  instructions: string;
  kind: "PERSONAL_RESPONSE" | "PROJECT" | "AUDIO_VISUAL" | "GENERAL";
  choiceMode: "ALL" | "CHOOSE_ONE";
  videoUrl: string;
  questions: Question[];
}

export interface ExamSettings {
  totalTimeLimitSec: number | null;
  allowBackNavigation: boolean;
  allowReviewOwnRecording: boolean;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  mode: "PRACTICE" | "SIMULATION";
  level: "FOUR_POINTS" | "FIVE_POINTS" | "FOUR_AND_FIVE" | "OTHER";
  settings: ExamSettings;
  sections: Section[];
  createdAt: number;
  updatedAt: number;
}

/** What a student link carries. */
export interface ExamLink {
  v: 1;
  exam: Exam;
  className: string;
  teacher: string;
}

export interface Answer {
  mime: string;
  data: Blob;
  durationSec: number;
  count: number;
}

export interface QuestionGrade {
  criteria: Record<string, number | null>;
  score: number | null;
  feedback: string;
}

export interface Submission {
  id: string;
  exam: Exam;
  className: string;
  studentName: string;
  startedAt: number;
  submittedAt: number;
  choices: Record<string, string>;
  answers: Record<string, Answer>;
  importedAt: number;
  grading?: {
    questions: Record<string, QuestionGrade>;
    overall: string;
    total: number;
    status: "draft" | "done";
    gradedAt: number;
  };
}

/** Feedback link payload sent back to a student. */
export interface FeedbackLink {
  v: 1;
  examTitle: string;
  studentName: string;
  total: number;
  overall: string;
  date: number;
  items: { section: string; title: string; score: number | null; points: number; feedback: string }[];
}

export const LEVEL_LABELS: Record<Exam["level"], string> = {
  FOUR_POINTS: "4 יח״ל",
  FIVE_POINTS: "5 יח״ל",
  FOUR_AND_FIVE: "4 ו־5 יח״ל",
  OTHER: "אחר",
};
export const MODE_LABELS: Record<Exam["mode"], string> = { PRACTICE: "תרגול", SIMULATION: "סימולציה" };
export const KIND_LABELS: Record<Section["kind"], string> = {
  PERSONAL_RESPONSE: "Personal Response",
  PROJECT: "Project",
  AUDIO_VISUAL: "Audio-Visual Prompt",
  GENERAL: "כללי",
};
