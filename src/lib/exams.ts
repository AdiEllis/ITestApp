import type { MediaFile, Prisma } from "@prisma/client";
import { db } from "./db";
import { randomToken } from "./crypto";
import { extensionFor } from "./files";
import { storage } from "./storage";
import { audioMatchesText, parseSettings, rubricCriteriaSchema, spokenText, type ExamSnapshot } from "./exam-types";
import { parseVideo } from "./video";

export function newStorageKey(kind: string, mimeType: string) {
  const d = new Date();
  const month = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${kind.toLowerCase()}/${month}/${randomToken(18)}.${extensionFor(mimeType)}`;
}

export const examWithContent = {
  sections: {
    orderBy: { order: "asc" },
    include: {
      media: true,
      questions: { orderBy: { order: "asc" }, include: { audio: true, video: true, image: true } },
    },
  },
  rubric: true,
} satisfies Prisma.ExamInclude;

export type ExamWithContent = Prisma.ExamGetPayload<{ include: typeof examWithContent }>;

export async function loadExam(examId: string) {
  return db.exam.findUnique({ where: { id: examId }, include: examWithContent });
}

export function buildSnapshot(exam: ExamWithContent): ExamSnapshot {
  const media: ExamSnapshot["media"] = {};
  const track = (m: MediaFile | null) => {
    if (m) media[m.id] = { mimeType: m.mimeType };
    return m?.id ?? null;
  };
  const criteria = exam.rubric ? rubricCriteriaSchema.safeParse(exam.rubric.criteria) : null;
  return {
    examId: exam.id,
    title: exam.title,
    description: exam.description,
    subject: exam.subject,
    mode: exam.mode,
    level: exam.level,
    settings: parseSettings(exam.settings),
    rubric: exam.rubric && criteria?.success ? { id: exam.rubric.id, name: exam.rubric.name, criteria: criteria.data } : null,
    media,
    sections: exam.sections.map((s) => ({
      id: s.id,
      title: s.title,
      instructions: s.instructions,
      kind: s.kind,
      choiceMode: s.choiceMode,
      mediaId: track(s.media),
      mediaMime: s.media?.mimeType ?? null,
      videoUrl: s.videoUrl,
      maxMediaPlays: s.maxMediaPlays,
      questions: s.questions.map((q) => ({
        id: q.id,
        title: q.title,
        prompt: q.prompt,
        subQuestions: q.subQuestions,
        instructions: q.instructions,
        readText: q.readText,
        audioId: track(q.audio),
        videoId: track(q.video),
        imageId: track(q.image),
        videoUrl: q.videoUrl,
        maxMediaPlays: q.maxMediaPlays,
        prepTimeSec: q.prepTimeSec,
        maxRecordSec: q.maxRecordSec,
        allowReRecord: q.allowReRecord,
        maxRecordings: q.maxRecordings,
        points: q.points,
      })),
    })),
  };
}

/** Returns a list of human-readable (Hebrew) problems that prevent publishing. */
export function publishProblems(exam: ExamWithContent): string[] {
  const problems: string[] = [];
  const settings = parseSettings(exam.settings);
  if (!exam.title.trim()) problems.push("חסר שם למבחן");
  if (exam.sections.length === 0) problems.push("המבחן חייב לכלול לפחות חלק אחד");
  exam.sections.forEach((s, i) => {
    const name = s.title || `חלק ${i + 1}`;
    if (s.questions.length === 0) problems.push(`ב${name} אין שאלות`);
    if (s.choiceMode === "CHOOSE_ONE" && s.questions.length < 2) problems.push(`ב${name} מוגדרת בחירה בין נושאים אך יש פחות משתי אפשרויות`);
    s.questions.forEach((q, j) => {
      if (q.videoUrl && !parseVideo(q.videoUrl)) problems.push(`קישור הסרטון בשאלה ${j + 1} ב${name} אינו נתמך`);
      if (!q.prompt.trim() && !q.audioId && !q.videoId && !q.videoUrl && q.subQuestions.length === 0)
        problems.push(`שאלה ${j + 1} ב${name} ריקה — יש להוסיף טקסט או מדיה`);
      if (q.maxRecordSec < 10) problems.push(`זמן ההקלטה בשאלה ${j + 1} ב${name} קצר מדי`);
      // Read-aloud: students must hear exactly what the teacher checked.
      const hasText = !!spokenText(q);
      if (q.audioId && !audioMatchesText(q)) problems.push(`השאלה ${j + 1} ב${name} השתנתה אחרי שההקראה נוצרה. צרו או הקליטו את ההקראה מחדש`);
      else if (q.audioId && !q.audioApproved) problems.push(`יש להאזין להקראה של שאלה ${j + 1} ב${name} ולאשר שהיא נכונה`);
      else if (!q.audioId && hasText && !settings.deviceVoiceFallback) problems.push(`לשאלה ${j + 1} ב${name} אין עדיין הקראה. צרו הקראה אוטומטית או הקליטו את השאלה`);
      if (q.points <= 0) problems.push(`לשאלה ${j + 1} ב${name} יש להגדיר ניקוד חיובי`);
    });
    if (s.videoUrl && !parseVideo(s.videoUrl)) problems.push(`קישור הסרטון ב${name} אינו נתמך (YouTube, Vimeo, Google Drive או קובץ mp4)`);
    if (s.kind === "AUDIO_VISUAL" && !s.mediaId && !s.videoUrl && !s.questions.some((q) => q.videoId || q.audioId || q.videoUrl))
      problems.push(`ב${name} (Audio-Visual) יש להעלות סרטון או קטע שמע, או להדביק קישור לסרטון`);
  });
  return problems;
}

/** Copies a media object into a new private file owned by `ownerId`. */
async function cloneMedia(tx: Prisma.TransactionClient, m: MediaFile | null, ownerId: string, cache: Map<string, string>) {
  if (!m) return null;
  const cached = cache.get(m.id);
  if (cached) return cached;
  const key = newStorageKey(m.kind, m.mimeType);
  await storage().copy(m.storageKey, key);
  const copy = await tx.mediaFile.create({
    data: {
      ownerId,
      kind: m.kind,
      status: "READY",
      storageKey: key,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      originalName: m.originalName,
      durationSec: m.durationSec,
    },
  });
  cache.set(m.id, copy.id);
  return copy.id;
}

/**
 * Deep-copies an exam (sections, questions, media). Copies never share media with the
 * original, so deleting or editing either side never affects the other.
 */
export async function copyExam(
  sourceExamId: string,
  ownerId: string,
  opts: { asLibraryEntry?: boolean; title?: string; includeSourceFiles?: boolean } = {},
) {
  const src = await db.exam.findUnique({
    where: { id: sourceExamId },
    include: { ...examWithContent, sourceFiles: { include: { media: true } } },
  });
  if (!src) throw new Error("source exam not found");
  const cache = new Map<string, string>();

  return db.$transaction(
    async (tx) => {
      // Rubric: system rubrics are shared; private rubrics are copied for the new owner.
      let rubricId: string | null = src.rubricId;
      if (src.rubric && src.rubric.ownerId && src.rubric.ownerId !== ownerId) {
        const r = await tx.rubric.create({
          data: { ownerId, name: src.rubric.name, description: src.rubric.description, criteria: src.rubric.criteria as Prisma.InputJsonValue },
        });
        rubricId = r.id;
      }
      const exam = await tx.exam.create({
        data: {
          ownerId,
          title: opts.title ?? src.title,
          description: src.description,
          subject: src.subject,
          level: src.level,
          mode: src.mode,
          topics: src.topics,
          settings: src.settings as Prisma.InputJsonValue,
          rubricId,
          status: opts.asLibraryEntry ? "PUBLISHED" : "DRAFT",
          sourceExamId: src.id,
          isLibraryEntry: !!opts.asLibraryEntry,
          libraryOfExamId: opts.asLibraryEntry ? src.id : null,
          sharedAt: opts.asLibraryEntry ? new Date() : null,
        },
      });
      for (const s of src.sections) {
        const section = await tx.examSection.create({
          data: {
            examId: exam.id,
            order: s.order,
            title: s.title,
            instructions: s.instructions,
            kind: s.kind,
            choiceMode: s.choiceMode,
            maxMediaPlays: s.maxMediaPlays,
            videoUrl: s.videoUrl,
            mediaId: await cloneMedia(tx, s.media, ownerId, cache),
          },
        });
        for (const q of s.questions) {
          await tx.question.create({
            data: {
              sectionId: section.id,
              order: q.order,
              title: q.title,
              prompt: q.prompt,
              subQuestions: q.subQuestions,
              instructions: q.instructions,
              readText: q.readText,
              audioSource: q.audioSource,
              audioText: q.audioText,
              audioApproved: q.audioApproved,
              audioId: await cloneMedia(tx, q.audio, ownerId, cache),
              videoId: await cloneMedia(tx, q.video, ownerId, cache),
              imageId: await cloneMedia(tx, q.image, ownerId, cache),
              videoUrl: q.videoUrl,
              maxMediaPlays: q.maxMediaPlays,
              prepTimeSec: q.prepTimeSec,
              maxRecordSec: q.maxRecordSec,
              allowReRecord: q.allowReRecord,
              maxRecordings: q.maxRecordings,
              points: q.points,
            },
          });
        }
      }
      if (opts.includeSourceFiles) {
        for (const f of src.sourceFiles) {
          const mediaId = await cloneMedia(tx, f.media, ownerId, cache);
          if (mediaId) await tx.examSourceFile.create({ data: { examId: exam.id, mediaId, label: f.label } });
        }
      }
      return exam;
    },
    { timeout: 120_000 },
  );
}

/** Deletes media rows + objects that are no longer referenced anywhere. */
export async function deleteMediaIfUnreferenced(mediaIds: (string | null | undefined)[]) {
  for (const id of new Set(mediaIds.filter(Boolean) as string[])) {
    const m = await db.mediaFile.findUnique({
      where: { id },
      include: { _count: { select: { questionAudio: true, questionVideo: true, questionImage: true, sections: true, sourceOf: true, answers: true } } },
    });
    if (!m) continue;
    const refs = Object.values(m._count).reduce((a, b) => a + b, 0);
    if (refs > 0) continue;
    // Media referenced by attempt snapshots must survive for grading.
    const inSnapshot = await db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Attempt" WHERE "examSnapshot"::text LIKE ${"%" + id + "%"}`;
    if (Number(inSnapshot[0]?.n ?? 0) > 0) continue;
    await storage().delete(m.storageKey).catch(() => undefined);
    await db.mediaFile.delete({ where: { id } }).catch(() => undefined);
  }
}
