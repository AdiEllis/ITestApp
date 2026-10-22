"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rubricCriteriaSchema } from "@/lib/exam-types";
import { generalOralRubric } from "@/lib/default-rubrics";
import { audit } from "@/lib/audit";

export async function createRubricAction(fromId?: string) {
  const user = await requireUser(["TEACHER"]);
  const src = fromId ? await db.rubric.findFirst({ where: { id: fromId, OR: [{ ownerId: null }, { ownerId: user.id }] } }) : null;
  const r = await db.rubric.create({
    data: {
      ownerId: user.id,
      name: src ? `${src.name} (עותק)` : "מחוון חדש",
      description: src?.description ?? null,
      criteria: (src?.criteria ?? generalOralRubric()) as Prisma.InputJsonValue,
    },
  });
  redirect(`/t/rubrics/${r.id}`);
}

const saveSchema = z.object({ name: z.string().trim().min(1, "יש להזין שם").max(100), description: z.string().max(1000).nullable(), criteria: rubricCriteriaSchema });

export async function saveRubricAction(id: string, input: z.infer<typeof saveSchema>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser(["TEACHER"]);
  const r = await db.rubric.findUnique({ where: { id } });
  if (!r || r.ownerId !== user.id) return { ok: false, error: "המחוון לא נמצא" };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  for (const c of parsed.data.criteria)
    for (const b of c.bands) if (b.min > b.max) return { ok: false, error: `טווח לא תקין ברמה "${b.label}" של ${c.label}` };
  await db.rubric.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description, criteria: parsed.data.criteria as Prisma.InputJsonValue } });
  revalidatePath("/t/rubrics");
  return { ok: true };
}

export async function deleteRubricAction(id: string) {
  const user = await requireUser(["TEACHER"]);
  const r = await db.rubric.findUnique({ where: { id } });
  if (!r || r.ownerId !== user.id) return;
  // Exams fall back to "no rubric"; attempts keep their snapshot so past grading is unaffected.
  await db.rubric.delete({ where: { id } });
  await audit(user.id, "rubric.delete", { type: "Rubric", id });
  redirect("/t/rubrics");
}
