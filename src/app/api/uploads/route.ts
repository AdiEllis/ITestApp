import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, forbidden, getOwnAttempt } from "@/lib/authz";
import { checkDeclared, baseMime } from "@/lib/files";
import { json, withUser } from "@/lib/http";
import { newStorageKey } from "@/lib/exams";
import { storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { assertRecordingAllowed } from "@/lib/attempts";

const bodySchema = z.object({
  kind: z.enum(["QUESTION_AUDIO", "QUESTION_VIDEO", "QUESTION_IMAGE", "SOURCE_DOCUMENT", "RECORDING"]),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  originalName: z.string().max(200).optional(),
  attemptId: z.string().optional(),
  questionId: z.string().optional(),
});

/** Step 1 of an upload: validate the declared file and hand out a short-lived upload URL. */
export const POST = withUser(async (req, user) => {
  const body = bodySchema.parse(await req.json());
  if (!(await rateLimit(`upload:${user.id}`, 120, 3600))) throw new AppError(429, "יותר מדי העלאות. נסו שוב מאוחר יותר.");

  const problem = checkDeclared(body.kind, body.mimeType, body.sizeBytes);
  if (problem) throw new AppError(400, problem);

  if (body.kind === "RECORDING") {
    if (!body.attemptId || !body.questionId) throw new AppError(400, "חסרים פרטי שאלה");
    const attempt = await getOwnAttempt(user, body.attemptId);
    await assertRecordingAllowed(attempt, body.questionId);
  } else if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw forbidden();
  }

  const mimeType = baseMime(body.mimeType);
  const key = newStorageKey(body.kind, mimeType);
  const media = await db.mediaFile.create({
    data: {
      ownerId: user.id,
      kind: body.kind,
      status: "PENDING",
      storageKey: key,
      mimeType,
      sizeBytes: body.sizeBytes,
      originalName: body.originalName?.replace(/[\u0000-\u001f]/g, "").slice(0, 200),
    },
  });
  const target = await storage().createUploadTarget(key, mimeType, body.sizeBytes, 15 * 60);
  return json({ mediaId: media.id, upload: target });
});
