"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AppError, examHasAttempts, getEditableExam, getOwnExam, getViewableExam } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { cobeSimulationTemplate, COBE_DEFAULTS } from "@/lib/cobe";
import { COBE_RUBRIC_NAME, GENERAL_RUBRIC_NAME } from "@/lib/default-rubrics";
import { copyExam, deleteMediaIfUnreferenced, loadExam, newStorageKey, publishProblems } from "@/lib/exams";
import { examSettingsSchema, spokenText } from "@/lib/exam-types";
import { mediaCategory } from "@/lib/files";
import { storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { synthesize, ttsProvider, TTS_MAX_CHARS } from "@/lib/tts";
import { toBuilderState, type BuilderExam, type MediaMeta } from "@/lib/builder-state";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; problems?: string[] };

function fail(e: unknown): ActionResult {
  if (e instanceof AppError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: `נתונים לא תקינים: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message ?? ""}` };
  throw e;
}

const levelEnum = z.enum(["FOUR_POINTS", "FIVE_POINTS", "FOUR_AND_FIVE", "OTHER"]);
const subjectField = z.string().trim().max(60).nullish().transform((v) => v || null);
const modeEnum = z.enum(["PRACTICE", "SIMULATION"]);

/** The default system rubric: the COBE rubric for the English template, the general oral rubric otherwise. */
async function systemRubricId(kind: "general" | "cobe" = "general") {
  const name = kind === "cobe" ? COBE_RUBRIC_NAME : GENERAL_RUBRIC_NAME;
  const r =
    (await db.rubric.findFirst({ where: { ownerId: null, name } })) ??
    (await db.rubric.findFirst({ where: { ownerId: null }, orderBy: { createdAt: "asc" } }));
  return r?.id ?? null;
}

// ---------------- Create ----------------

const createSchema = z.object({
  title: z.string().trim().min(1, "יש להזין שם למבחן").max(140),
  subject: subjectField,
  mode: modeEnum,
  start: z.enum(["blank", "cobe"]),
});

export async function createExamAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await requireUser(["TEACHER"]);
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const simulation = d.mode === "SIMULATION";
  const settings = examSettingsSchema.parse({
    totalTimeLimitSec: simulation ? COBE_DEFAULTS.totalTimeLimitSec : null,
    allowBackNavigation: !simulation,
    allowReviewOwnRecording: true,
    // The English template shows the questions as text, as in the original COBE practice.
    deviceVoiceFallback: d.start === "cobe",
  });
  const template =
    d.start === "cobe"
      ? cobeSimulationTemplate()
      : [
          {
            title: "שאלות",
            instructions: "",
            kind: "GENERAL" as const,
            choiceMode: "ALL" as const,
            questions: [{ title: "", prompt: "", subQuestions: [] as string[], prepTimeSec: 30, maxRecordSec: 120, points: 25, allowReRecord: true, maxRecordings: 3 as number | null }],
          },
        ];
  const exam = await db.exam.create({
    data: {
      ownerId: user.id,
      title: d.title,
      subject: d.start === "cobe" ? "אנגלית" : d.subject,
      level: d.start === "cobe" ? "FOUR_AND_FIVE" : "OTHER",
      mode: d.mode,
      settings,
      rubricId: await systemRubricId(d.start === "cobe" ? "cobe" : "general"),
      sections: {
        create: template.map((s, i) => ({
          order: i,
          title: s.title,
          instructions: s.instructions || null,
          kind: s.kind,
          choiceMode: s.choiceMode,
          questions: {
            create: s.questions.map((q, j) => ({
              order: j,
              title: q.title,
              prompt: q.prompt,
              subQuestions: q.subQuestions,
              prepTimeSec: simulation ? q.prepTimeSec : 0,
              maxRecordSec: q.maxRecordSec,
              points: q.points,
              allowReRecord: q.allowReRecord,
              maxRecordings: simulation ? q.maxRecordings : null,
            })),
          },
        })),
      },
    },
  });
  await audit(user.id, "exam.create", { type: "Exam", id: exam.id }, { start: d.start });
  redirect(`/t/exams/${exam.id}`);
}

const importSchema = z.object({
  title: z.string().trim().min(1, "יש להזין שם למבחן").max(140),
  subject: subjectField,
  mode: modeEnum,
  mediaIds: z.array(z.string()).min(1, "יש להעלות לפחות קובץ אחד").max(40),
});

/** Option B: create a draft exam from uploaded files; the teacher maps files to questions in the builder. */
export async function createImportedExamAction(input: z.infer<typeof importSchema>): Promise<ActionResult & { examId?: string }> {
  try {
    const user = await requireUser(["TEACHER"]);
    const d = importSchema.parse(input);
    const media = await db.mediaFile.findMany({ where: { id: { in: d.mediaIds }, ownerId: user.id, status: "READY", kind: "SOURCE_DOCUMENT" } });
    if (media.length !== new Set(d.mediaIds).size) throw new AppError(400, "חלק מהקבצים לא הועלו בהצלחה");
    const simulation = d.mode === "SIMULATION";
    const exam = await db.exam.create({
      data: {
        ownerId: user.id,
        title: d.title,
        subject: d.subject,
        level: "OTHER",
        mode: d.mode,
        rubricId: await systemRubricId(),
        settings: examSettingsSchema.parse({ totalTimeLimitSec: simulation ? COBE_DEFAULTS.totalTimeLimitSec : null, allowBackNavigation: !simulation }),
        sections: { create: [{ order: 0, title: "חלק 1", kind: "GENERAL", choiceMode: "ALL" }] },
        sourceFiles: { create: media.map((m) => ({ mediaId: m.id, label: m.originalName })) },
      },
    });
    await audit(user.id, "exam.import", { type: "Exam", id: exam.id }, { files: media.length });
    return { ok: true, examId: exam.id };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Save structure ----------------

const nullableId = z.string().max(40).nullable();
const questionInput = z.object({
  id: z.string().max(40).optional(),
  title: z.string().max(120).nullable(),
  prompt: z.string().max(4000),
  subQuestions: z.array(z.string().max(1000)).max(12),
  instructions: z.string().max(2000).nullable(),
  readText: z.string().max(TTS_MAX_CHARS).nullable().default(null),
  audioId: nullableId,
  audioSource: z.enum(["TTS", "TEACHER"]).nullable().default(null),
  audioText: z.string().max(20000).nullable().default(null),
  audioApproved: z.boolean().default(false),
  videoId: nullableId,
  imageId: nullableId,
  videoUrl: z.string().trim().max(500).nullable(),
  maxMediaPlays: z.number().int().min(1).max(20).nullable(),
  prepTimeSec: z.number().int().min(0).max(600),
  maxRecordSec: z.number().int().min(10).max(900),
  allowReRecord: z.boolean(),
  maxRecordings: z.number().int().min(1).max(20).nullable(),
  points: z.number().int().min(1).max(100),
});
const sectionInput = z.object({
  id: z.string().max(40).optional(),
  title: z.string().max(140),
  instructions: z.string().max(4000).nullable(),
  kind: z.enum(["PERSONAL_RESPONSE", "PROJECT", "AUDIO_VISUAL", "GENERAL"]),
  choiceMode: z.enum(["ALL", "CHOOSE_ONE"]),
  mediaId: nullableId,
  videoUrl: z.string().trim().max(500).nullable(),
  maxMediaPlays: z.number().int().min(1).max(20).nullable(),
  questions: z.array(questionInput).max(30),
});
const saveSchema = z.object({
  title: z.string().trim().min(1, "יש להזין שם למבחן").max(140),
  description: z.string().max(4000).nullable(),
  subject: z.string().trim().max(60).nullable().default(null),
  level: levelEnum,
  mode: modeEnum,
  topics: z.array(z.string().trim().min(1).max(40)).max(10),
  settings: examSettingsSchema,
  rubricId: z.string().max(40).nullable(),
  sections: z.array(sectionInput).max(12),
});
export type ExamSaveInput = z.infer<typeof saveSchema>;

/**
 * Replaces the exam structure with the builder's state in one transaction.
 * Every referenced id (sections, questions, media, rubric) is verified to belong to this teacher/exam.
 */
export async function saveExamAction(
  examId: string,
  input: ExamSaveInput,
): Promise<ActionResult & { state?: { exam: BuilderExam; media: MediaMeta } }> {
  try {
    const user = await requireUser(["TEACHER"]);
    const exam = await getEditableExam(user, examId);
    const d = saveSchema.parse(input);

    // Rubric must be a system rubric or the teacher's own.
    if (d.rubricId) {
      const r = await db.rubric.findFirst({ where: { id: d.rubricId, OR: [{ ownerId: null }, { ownerId: user.id }] } });
      if (!r) throw new AppError(400, "המחוון שנבחר אינו זמין");
    }

    // Media: must be owned by the teacher, ready, and of a matching category.
    const refs: { id: string; want: ("audio" | "video" | "image")[] }[] = [];
    for (const s of d.sections) {
      if (s.mediaId) refs.push({ id: s.mediaId, want: ["audio", "video"] });
      for (const q of s.questions) {
        if (q.audioId) refs.push({ id: q.audioId, want: ["audio"] });
        if (q.videoId) refs.push({ id: q.videoId, want: ["video"] });
        if (q.imageId) refs.push({ id: q.imageId, want: ["image"] });
      }
    }
    const media = await db.mediaFile.findMany({ where: { id: { in: refs.map((r) => r.id) }, ownerId: user.id, status: "READY", kind: { not: "RECORDING" } } });
    const byId = new Map(media.map((m) => [m.id, m]));
    for (const r of refs) {
      const m = byId.get(r.id);
      if (!m || !r.want.includes(mediaCategory(m.mimeType) as "audio")) throw new AppError(400, "אחד מקובצי המדיה אינו תקין או אינו שייך לך");
    }

    // Existing ids must belong to this exam.
    const current = await db.examSection.findMany({ where: { examId }, include: { questions: true } });
    const sectionIds = new Set(current.map((s) => s.id));
    const questionIds = new Set(current.flatMap((s) => s.questions.map((q) => q.id)));
    const previousQuestion = new Map(current.flatMap((s) => s.questions.map((q) => [q.id, q] as const)));
    const previousMedia = current.flatMap((s) => [s.mediaId, ...s.questions.flatMap((q) => [q.audioId, q.videoId, q.imageId])]);
    for (const s of d.sections) {
      if (s.id && !sectionIds.has(s.id)) delete s.id; // unknown id → treat as new
      for (const q of s.questions) if (q.id && !questionIds.has(q.id)) delete q.id;
    }
    // A question moved out of a section that is being deleted would be cascade-deleted: recreate it instead.
    const keptSectionIds = new Set(d.sections.map((s) => s.id).filter(Boolean));
    const originalSection = new Map(current.flatMap((s) => s.questions.map((q) => [q.id, s.id] as const)));
    for (const s of d.sections) for (const q of s.questions) if (q.id && !keptSectionIds.has(originalSection.get(q.id))) delete q.id;

    await db.$transaction(async (tx) => {
      await tx.exam.update({
        where: { id: examId },
        data: {
          title: d.title,
          description: d.description || null,
          subject: d.subject || null,
          level: d.level,
          mode: d.mode,
          topics: [...new Set(d.topics)],
          settings: d.settings as Prisma.InputJsonValue,
          rubricId: d.rubricId,
        },
      });
      const keepSections = d.sections.filter((s) => s.id).map((s) => s.id!);
      const keepQuestions = d.sections.flatMap((s) => s.questions.filter((q) => q.id).map((q) => q.id!));
      await tx.question.deleteMany({ where: { section: { examId }, id: { notIn: keepQuestions } } });
      await tx.examSection.deleteMany({ where: { examId, id: { notIn: keepSections } } });

      for (const [i, s] of d.sections.entries()) {
        const sectionData = {
          order: i,
          title: s.title,
          instructions: s.instructions || null,
          kind: s.kind,
          choiceMode: s.choiceMode,
          mediaId: s.mediaId,
          videoUrl: s.videoUrl || null,
          maxMediaPlays: s.maxMediaPlays,
        };
        const section = s.id
          ? await tx.examSection.update({ where: { id: s.id }, data: sectionData })
          : await tx.examSection.create({ data: { ...sectionData, examId } });
        for (const [j, q] of s.questions.entries()) {
          const { id: qid, ...rest } = q;
          const subQuestions = q.subQuestions.map((x) => x.trim()).filter(Boolean);
          const readText = q.readText?.trim() || null;
          // Read-aloud audio remembers the text it was made for, so a later change to the question is detected.
          // (The builder clears the teacher's approval whenever the audio file changes.)
          const prev = qid ? previousQuestion.get(qid) : undefined;
          const audioChanged = !prev || prev.audioId !== q.audioId;
          const audio = !q.audioId
            ? { audioSource: null, audioText: null, audioApproved: false }
            : {
                audioSource: q.audioSource ?? prev?.audioSource ?? "TEACHER",
                audioText: q.audioText ?? (audioChanged ? spokenText({ prompt: q.prompt, subQuestions, readText }) : prev!.audioText),
                audioApproved: q.audioApproved,
              };
          const data = { ...rest, ...audio, readText, videoUrl: q.videoUrl || null, order: j, sectionId: section.id, title: q.title || null, instructions: q.instructions || null, subQuestions };
          if (qid) await tx.question.update({ where: { id: qid }, data });
          else await tx.question.create({ data });
        }
      }
      // Publishing state is kept, but a published exam must remain valid.
      if (exam.status === "PUBLISHED") {
        const full = await tx.exam.findUniqueOrThrow({
          where: { id: examId },
          include: { sections: { include: { media: true, questions: { include: { audio: true, video: true, image: true } } } }, rubric: true },
        });
        const problems = publishProblems(full);
        if (problems.length) throw new AppError(400, `המבחן מפורסם ולכן חייב להישאר תקין: ${problems[0]}`);
      }
    });
    await deleteMediaIfUnreferenced(previousMedia);
    const fresh = await loadExam(examId);
    return { ok: true, state: toBuilderState(fresh!) };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Read-aloud ----------------

/**
 * Creates the read-aloud audio for a question with the automatic voice. The file is stored like a
 * teacher recording; the builder attaches it to the question, and the teacher must listen and approve it.
 */
export async function generateSpeechAction(
  examId: string,
  text: string,
): Promise<ActionResult & { mediaId?: string; meta?: MediaMeta[string] }> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getEditableExam(user, examId);
    const clean = text.trim();
    if (!clean) throw new AppError(400, "אין טקסט להקראה. כתבו קודם את השאלה.");
    if (clean.length > TTS_MAX_CHARS) throw new AppError(400, `הטקסט ארוך מדי להקראה אוטומטית (עד ${TTS_MAX_CHARS} תווים)`);
    if (!ttsProvider()) throw new AppError(400, "הקראה אוטומטית לא הוגדרה במערכת. אפשר להקליט את השאלה בקול.");
    if (!(await rateLimit(`tts:${user.id}`, 200, 3600))) throw new AppError(429, "יותר מדי בקשות הקראה. נסו שוב בעוד כמה דקות.");
    let result;
    try {
      result = await synthesize(clean);
    } catch (e) {
      console.error("[tts]", e);
      throw new AppError(502, "שירות ההקראה לא הגיב. נסו שוב בעוד רגע, או הקליטו את השאלה בקול.");
    }
    const key = newStorageKey("QUESTION_AUDIO", result.mimeType);
    await storage().put(key, result.audio, result.mimeType);
    const name = "הקראה אוטומטית";
    const media = await db.mediaFile.create({
      data: { ownerId: user.id, kind: "QUESTION_AUDIO", status: "READY", storageKey: key, mimeType: result.mimeType, sizeBytes: result.audio.length, originalName: name },
    });
    await audit(user.id, "exam.tts", { type: "Exam", id: examId }, { chars: clean.length });
    return { ok: true, mediaId: media.id, meta: { mimeType: result.mimeType, name, sizeBytes: result.audio.length } };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Lifecycle ----------------

export async function publishExamAction(examId: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getOwnExam(user, examId);
    const exam = await loadExam(examId);
    const problems = publishProblems(exam!);
    if (problems.length) return { ok: false, error: "לא ניתן לפרסם עדיין", problems };
    await db.exam.update({ where: { id: examId }, data: { status: "PUBLISHED" } });
    await audit(user.id, "exam.publish", { type: "Exam", id: examId });
    revalidatePath(`/t/exams/${examId}`);
    revalidatePath("/t/exams");
    return { ok: true, message: "המבחן פורסם וניתן להקצות אותו לכיתות" };
  } catch (e) {
    return fail(e);
  }
}

export async function unpublishExamAction(examId: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getOwnExam(user, examId);
    const assigned = await db.assignment.count({ where: { examId } });
    if (assigned > 0) throw new AppError(409, "המבחן מוקצה לכיתות. מחקו את המשימות או העבירו את המבחן לארכיון.");
    await db.exam.update({ where: { id: examId }, data: { status: "DRAFT" } });
    revalidatePath(`/t/exams/${examId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveExamAction(examId: string, archived: boolean) {
  const user = await requireUser(["TEACHER"]);
  const exam = await getOwnExam(user, examId);
  await db.exam.update({ where: { id: examId }, data: { status: archived ? "ARCHIVED" : exam.status === "ARCHIVED" ? "DRAFT" : exam.status } });
  await audit(user.id, archived ? "exam.archive" : "exam.unarchive", { type: "Exam", id: examId });
  revalidatePath("/t/exams");
  revalidatePath(`/t/exams/${examId}`);
}

export async function deleteExamAction(examId: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getOwnExam(user, examId);
    if (await db.assignment.count({ where: { examId } }))
      throw new AppError(409, "לא ניתן למחוק מבחן שהוקצה לכיתה. ניתן להעביר אותו לארכיון.");
    const exam = await loadExam(examId);
    const sourceFiles = await db.examSourceFile.findMany({ where: { examId } });
    const mediaIds = [
      ...exam!.sections.flatMap((s) => [s.mediaId, ...s.questions.flatMap((q) => [q.audioId, q.videoId, q.imageId])]),
      ...sourceFiles.map((f) => f.mediaId),
    ];
    await db.exam.delete({ where: { id: examId } });
    await deleteMediaIfUnreferenced(mediaIds);
    await audit(user.id, "exam.delete", { type: "Exam", id: examId });
  } catch (e) {
    return fail(e);
  }
  redirect("/t/exams");
}

export async function duplicateExamAction(examId: string): Promise<ActionResult> {
  let newId: string;
  try {
    const user = await requireUser(["TEACHER"]);
    const exam = await getOwnExam(user, examId);
    const copy = await copyExam(examId, user.id, { title: `${exam.title} (עותק)`, includeSourceFiles: true });
    newId = copy.id;
    await audit(user.id, "exam.duplicate", { type: "Exam", id: copy.id }, { from: examId });
  } catch (e) {
    return fail(e);
  }
  redirect(`/t/exams/${newId}`);
}

export async function addSourceFilesAction(examId: string, mediaIds: string[]): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getOwnExam(user, examId);
    const media = await db.mediaFile.findMany({ where: { id: { in: mediaIds }, ownerId: user.id, status: "READY", kind: "SOURCE_DOCUMENT" } });
    for (const m of media) {
      await db.examSourceFile.upsert({
        where: { examId_mediaId: { examId, mediaId: m.id } },
        create: { examId, mediaId: m.id, label: m.originalName },
        update: {},
      });
    }
    revalidatePath(`/t/exams/${examId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSourceFileAction(examId: string, mediaId: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER"]);
    await getOwnExam(user, examId);
    await db.examSourceFile.deleteMany({ where: { examId, mediaId } });
    await deleteMediaIfUnreferenced([mediaId]);
    revalidatePath(`/t/exams/${examId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Shared library ----------------

/**
 * Publishes an immutable copy of the exam to the shared library. Requires an explicit
 * rights confirmation. Student data is never part of an exam, so nothing personal is shared.
 */
export async function shareToLibraryAction(examId: string, rightsConfirmed: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER"]);
    const exam = await getOwnExam(user, examId);
    if (!rightsConfirmed) throw new AppError(400, "יש לאשר שיש לך זכות לשתף את התכנים");
    if (exam.status !== "PUBLISHED") throw new AppError(400, "ניתן לשתף רק מבחן מפורסם");
    const previous = await db.exam.findMany({ where: { libraryOfExamId: examId, isLibraryEntry: true, status: "PUBLISHED" } });
    const entry = await copyExam(examId, user.id, { asLibraryEntry: true });
    await db.exam.update({ where: { id: entry.id }, data: { rightsConfirmedAt: new Date() } });
    // Replace the previous shared version (copies other teachers made are unaffected).
    for (const p of previous) await removeLibraryEntry(p.id);
    await audit(user.id, "library.share", { type: "Exam", id: entry.id }, { from: examId });
    revalidatePath("/t/library");
    revalidatePath(`/t/exams/${examId}`);
    return { ok: true, message: previous.length ? "הגרסה במאגר עודכנה" : "המבחן שותף במאגר" };
  } catch (e) {
    return fail(e);
  }
}

async function removeLibraryEntry(entryId: string) {
  const exam = await loadExam(entryId);
  if (!exam) return;
  const mediaIds = exam.sections.flatMap((s) => [s.mediaId, ...s.questions.flatMap((q) => [q.audioId, q.videoId, q.imageId])]);
  if (await db.assignment.count({ where: { examId: entryId } })) {
    await db.exam.update({ where: { id: entryId }, data: { status: "ARCHIVED" } });
    return;
  }
  await db.exam.delete({ where: { id: entryId } });
  await deleteMediaIfUnreferenced(mediaIds);
}

export async function unshareAction(entryId: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["TEACHER", "ADMIN"]);
    const entry = await db.exam.findUnique({ where: { id: entryId } });
    if (!entry || !entry.isLibraryEntry) throw new AppError(404, "הפריט לא נמצא");
    if (user.role !== "ADMIN" && entry.ownerId !== user.id) throw new AppError(403, "רק מי ששיתף/ה יכול/ה להסיר");
    await removeLibraryEntry(entryId);
    await audit(user.id, "library.unshare", { type: "Exam", id: entryId });
    revalidatePath("/t/library");
    return { ok: true, message: "המבחן הוסר מהמאגר" };
  } catch (e) {
    return fail(e);
  }
}

export async function copyFromLibraryAction(entryId: string): Promise<ActionResult> {
  let newId: string;
  try {
    const user = await requireUser(["TEACHER"]);
    const entry = await getViewableExam(user, entryId);
    if (!entry.isLibraryEntry) throw new AppError(404, "הפריט לא נמצא");
    const copy = await copyExam(entryId, user.id);
    await db.exam.update({ where: { id: entryId }, data: { copyCount: { increment: 1 } } });
    newId = copy.id;
    await audit(user.id, "library.copy", { type: "Exam", id: copy.id }, { from: entryId });
  } catch (e) {
    return fail(e);
  }
  redirect(`/t/exams/${newId}?copied=1`);
}

export async function examLockState(examId: string) {
  const user = await requireUser(["TEACHER"]);
  await getOwnExam(user, examId);
  return examHasAttempts(examId);
}
