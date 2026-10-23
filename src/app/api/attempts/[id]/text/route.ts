import { z } from "zod";
import { getOwnAttempt } from "@/lib/authz";
import { json, withUser } from "@/lib/http";
import { saveTextAnswer, TEXT_ANSWER_MAX } from "@/lib/attempts";
import { assertSebIfRequired } from "@/lib/seb";

const bodySchema = z.object({ questionId: z.string().max(100), text: z.string().max(TEXT_ANSWER_MAX) });

/** Autosave of a typed answer. */
export const POST = withUser<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = bodySchema.parse(await req.json());
  const own = await getOwnAttempt(user, id);
  assertSebIfRequired(own.assignment, req.headers.get("user-agent"));
  await saveTextAnswer(id, user.id, body.questionId, body.text);
  return json({ ok: true });
});
