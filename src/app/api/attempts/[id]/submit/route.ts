import { getOwnAttempt } from "@/lib/authz";
import { json, withUser } from "@/lib/http";
import { submitAttempt } from "@/lib/attempts";

export const POST = withUser<{ params: Promise<{ id: string }> }>(async (_req, user, { params }) => {
  const { id } = await params;
  const attempt = await getOwnAttempt(user, id);
  if (attempt.status !== "IN_PROGRESS") return json({ ok: true, alreadySubmitted: true });
  const ok = await submitAttempt(id, user.id);
  return json({ ok: true, alreadySubmitted: !ok });
});
