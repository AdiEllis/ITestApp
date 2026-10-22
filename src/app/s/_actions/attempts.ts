"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { AppError, getStudentAssignment } from "@/lib/authz";
import { startOrResumeAttempt } from "@/lib/attempts";
import { assertSebIfRequired } from "@/lib/seb";

export async function startAttemptAction(assignmentId: string): Promise<{ error: string } | void> {
  const user = await requireUser(["STUDENT"]);
  let attemptId: string;
  let timedOut = false;
  try {
    const assignment = await getStudentAssignment(user, assignmentId);
    assertSebIfRequired(assignment, (await headers()).get("user-agent"));
    const attempt = await startOrResumeAttempt(user.id, assignment);
    attemptId = attempt.id;
    // Time ran out while the student was away: show what was saved instead of an error.
    if (attempt.status !== "IN_PROGRESS") timedOut = true;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  redirect(timedOut ? `/s/attempts/${attemptId}?timeout=1` : `/s/attempts/${attemptId}/run`);
}
