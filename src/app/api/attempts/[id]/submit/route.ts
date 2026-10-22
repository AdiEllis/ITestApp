import { getOwnAttempt } from "@/lib/authz";
import { json, withUser } from "@/lib/http";
import { submitAttempt } from "@/lib/attempts";
import { assertSebIfRequired } from "@/lib/seb";

export const POST = withUser<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const attempt = await getOwnAttempt(user, id);
  if (attempt.status !== "IN_PROGRESS") return json({ ok: true, alreadySubmitted: true });
  assertSebIfRequired(attempt.assignment, req.headers.get("user-agent"));
  const ok = await submitAttempt(id, user.id);
  return json({ ok: true, alreadySubmitted: !ok });
});
