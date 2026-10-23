import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, getOwnAttempt } from "@/lib/authz";
import { json, withUser } from "@/lib/http";
import { findQuestion, snapshotOf } from "@/lib/attempts";
import { assertSebIfRequired } from "@/lib/seb";

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play"), mediaKey: z.string().max(200) }),
  z.object({ type: z.literal("prep"), questionId: z.string() }),
  z.object({ type: z.literal("choose"), sectionId: z.string(), questionId: z.string() }),
  z.object({ type: z.literal("position"), index: z.number().int().min(0).max(500) }),
]);

type Progress = { plays?: Record<string, number>; prepStarted?: Record<string, string>; position?: number };

/** Records runner progress so simulation rules (media plays, prep timers, topic choice) survive reloads. */
export const POST = withUser<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = bodySchema.parse(await req.json());
  const own = await getOwnAttempt(user, id);
  assertSebIfRequired(own.assignment, req.headers.get("user-agent"));
  // Every query inside uses `tx`: on Vercel the pool has a single connection, so `db` here would wait forever.
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Attempt" WHERE id = ${id} FOR UPDATE`;
    const attempt = await tx.attempt.findUniqueOrThrow({ where: { id } });
    if (attempt.status !== "IN_PROGRESS") throw new AppError(409, "המבחן כבר הוגש");
    const snapshot = snapshotOf(attempt);
    const progress = { ...((attempt.progress ?? {}) as Progress) };
    let choices = { ...((attempt.choices ?? {}) as Record<string, string>) };

    if (body.type === "play") {
      const plays = { ...(progress.plays ?? {}) };
      const limit = playLimit(snapshot, body.mediaKey);
      if (limit === undefined) throw new AppError(400, "מדיה לא מוכרת");
      if (limit !== null && (plays[body.mediaKey] ?? 0) >= limit) throw new AppError(409, "ניצלת את מספר ההשמעות המותר");
      plays[body.mediaKey] = (plays[body.mediaKey] ?? 0) + 1;
      progress.plays = plays;
    } else if (body.type === "prep") {
      if (!findQuestion(snapshot, body.questionId)) throw new AppError(400, "שאלה לא מוכרת");
      progress.prepStarted = { ...(progress.prepStarted ?? {}) };
      progress.prepStarted[body.questionId] ??= new Date().toISOString();
    } else if (body.type === "choose") {
      const section = snapshot.sections.find((s) => s.id === body.sectionId);
      if (!section || section.choiceMode !== "CHOOSE_ONE" || !section.questions.some((q) => q.id === body.questionId))
        throw new AppError(400, "בחירה לא תקינה");
      const current = choices[body.sectionId];
      if (current && current !== body.questionId) {
        // Changing topic is only allowed while nothing was recorded for the current one.
        const answered = await tx.answer.count({
          where: { attemptId: id, questionId: current, OR: [{ recordingId: { not: null } }, { textAnswer: { not: null } }] },
        });
        if (answered > 0) throw new AppError(409, "כבר ענית על הנושא שבחרת");
      }
      choices = { ...choices, [body.sectionId]: body.questionId };
    } else if (body.type === "position") {
      progress.position = body.index;
    }
    const updated = await tx.attempt.update({ where: { id }, data: { progress, choices } });
    return { progress: updated.progress, choices: updated.choices };
  });
  return json(result);
});

/** mediaKey is "<sectionId>:section" or "<questionId>:audio|video". Returns null for unlimited, undefined if unknown. */
function playLimit(snapshot: ReturnType<typeof snapshotOf>, mediaKey: string): number | null | undefined {
  const [id, what] = mediaKey.split(":");
  for (const s of snapshot.sections) {
    if (s.id === id && what === "section" && s.mediaId) return s.maxMediaPlays;
    for (const q of s.questions) {
      if (q.id === id && ((what === "audio" && q.audioId) || (what === "video" && q.videoId))) return q.maxMediaPlays;
    }
  }
  return undefined;
}
