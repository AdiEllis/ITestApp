"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppError, getStudentAssignment } from "@/lib/authz";
import { startOrResumeAttempt } from "@/lib/attempts";

export async function startAttemptAction(assignmentId: string): Promise<{ error: string } | void> {
  const user = await requireUser(["STUDENT"]);
  let attemptId: string;
  try {
    const assignment = await getStudentAssignment(user, assignmentId);
    const attempt = await startOrResumeAttempt(user.id, assignment);
    if (attempt.status !== "IN_PROGRESS") return { error: "הזמן למבחן זה הסתיים והוא הוגש אוטומטית" };
    attemptId = attempt.id;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  redirect(`/s/attempts/${attemptId}/run`);
}
