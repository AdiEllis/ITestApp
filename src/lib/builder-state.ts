import type { ExamWithContent } from "./exams";
import { parseSettings, type ExamSettings } from "./exam-types";

export interface BuilderQuestion {
  id?: string;
  /** client-only stable key for React lists */
  key: string;
  title: string | null;
  prompt: string;
  subQuestions: string[];
  instructions: string | null;
  readText: string | null;
  audioId: string | null;
  audioSource: "TTS" | "TEACHER" | null;
  audioText: string | null;
  audioApproved: boolean;
  videoId: string | null;
  imageId: string | null;
  videoUrl: string | null;
  maxMediaPlays: number | null;
  prepTimeSec: number;
  maxRecordSec: number;
  allowReRecord: boolean;
  maxRecordings: number | null;
  points: number;
}
export interface BuilderSection {
  id?: string;
  key: string;
  title: string;
  instructions: string | null;
  kind: "PERSONAL_RESPONSE" | "PROJECT" | "AUDIO_VISUAL" | "GENERAL";
  choiceMode: "ALL" | "CHOOSE_ONE";
  mediaId: string | null;
  videoUrl: string | null;
  maxMediaPlays: number | null;
  questions: BuilderQuestion[];
}
export interface BuilderExam {
  title: string;
  description: string | null;
  subject: string | null;
  level: "FOUR_POINTS" | "FIVE_POINTS" | "FOUR_AND_FIVE" | "OTHER";
  mode: "PRACTICE" | "SIMULATION";
  topics: string[];
  settings: ExamSettings;
  rubricId: string | null;
  sections: BuilderSection[];
}
export type MediaMeta = Record<string, { mimeType: string; name: string | null; sizeBytes: number }>;

export function toBuilderState(exam: ExamWithContent): { exam: BuilderExam; media: MediaMeta } {
  const media: MediaMeta = {};
  const track = (m: { id: string; mimeType: string; originalName: string | null; sizeBytes: number } | null) => {
    if (m) media[m.id] = { mimeType: m.mimeType, name: m.originalName, sizeBytes: m.sizeBytes };
  };
  return {
    media,
    exam: {
      title: exam.title,
      description: exam.description,
      subject: exam.subject,
      level: exam.level,
      mode: exam.mode,
      topics: exam.topics,
      settings: parseSettings(exam.settings),
      rubricId: exam.rubricId,
      sections: exam.sections.map((s) => {
        track(s.media);
        return {
          id: s.id,
          key: s.id,
          title: s.title,
          instructions: s.instructions,
          kind: s.kind,
          choiceMode: s.choiceMode,
          mediaId: s.mediaId,
          videoUrl: s.videoUrl,
          maxMediaPlays: s.maxMediaPlays,
          questions: s.questions.map((q) => {
            track(q.audio);
            track(q.video);
            track(q.image);
            return {
              id: q.id,
              key: q.id,
              title: q.title,
              prompt: q.prompt,
              subQuestions: q.subQuestions,
              instructions: q.instructions,
              readText: q.readText,
              audioId: q.audioId,
              audioSource: q.audioSource === "TTS" ? "TTS" : q.audioSource === "TEACHER" ? "TEACHER" : null,
              audioText: q.audioText,
              audioApproved: q.audioApproved,
              videoId: q.videoId,
              imageId: q.imageId,
              videoUrl: q.videoUrl,
              maxMediaPlays: q.maxMediaPlays,
              prepTimeSec: q.prepTimeSec,
              maxRecordSec: q.maxRecordSec,
              allowReRecord: q.allowReRecord,
              maxRecordings: q.maxRecordings,
              points: q.points,
            };
          }),
        };
      }),
    },
  };
}

/** Strips client-only keys before sending to the server. */
export function toSaveInput(e: BuilderExam) {
  return {
    ...e,
    sections: e.sections.map(({ key: _k, ...s }) => ({ ...s, questions: s.questions.map(({ key: _q, ...q }) => q) })),
  };
}
