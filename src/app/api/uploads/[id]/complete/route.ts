import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/authz";
import { checkContent } from "@/lib/files";
import { json, withUser } from "@/lib/http";
import { storage } from "@/lib/storage";
import { attachRecording } from "@/lib/attempts";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  attemptId: z.string().optional(),
  questionId: z.string().optional(),
  durationSec: z.number().min(0).max(3600).nullable().optional(),
});

/** Step 2 of an upload: verify what actually landed in storage, then mark the file READY. */
export const POST = withUser<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = bodySchema.parse(await req.json().catch(() => ({})));
  const media = await db.mediaFile.findUnique({ where: { id } });
  if (!media || media.ownerId !== user.id) throw notFound();
  if (media.status === "READY") return json({ ok: true, mediaId: media.id });

  const fail = async (status: number, message: string) => {
    await storage().delete(media.storageKey).catch(() => undefined);
    await db.mediaFile.delete({ where: { id: media.id } }).catch(() => undefined);
    throw new AppError(status, message);
  };

  const stat = await storage().stat(media.storageKey);
  if (!stat) throw new AppError(409, "הקובץ עדיין לא הועלה");
  if (stat.size === 0) await fail(400, "הקובץ ריק");
  if (stat.size !== media.sizeBytes) await fail(400, "גודל הקובץ אינו תואם — ההעלאה לא הושלמה");
  const head = await storage().readHead(media.storageKey, 64);
  const contentProblem = checkContent(media.kind, media.mimeType, head);
  if (contentProblem) await fail(400, contentProblem);

  if (media.kind === "RECORDING") {
    if (!body.attemptId || !body.questionId) await fail(400, "חסרים פרטי שאלה");
    try {
      await attachRecording(body.attemptId!, user.id, body.questionId!, media.id, body.durationSec ?? null);
    } catch (e) {
      await storage().delete(media.storageKey).catch(() => undefined);
      await db.mediaFile.delete({ where: { id: media.id } }).catch(() => undefined);
      throw e;
    }
  } else {
    await db.mediaFile.update({ where: { id: media.id }, data: { status: "READY", durationSec: body.durationSec ?? null } });
    await audit(user.id, "media.upload", { type: "MediaFile", id: media.id }, { kind: media.kind, size: media.sizeBytes });
  }
  return json({ ok: true, mediaId: media.id });
});
