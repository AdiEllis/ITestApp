"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem, requireUser } from "@/lib/auth";
import { friendlyCode, tempPassword } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { deleteUserCompletely } from "@/lib/users";
import type { FormState } from "@/components/ui/form-message";

export async function createSchoolAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser(["ADMIN"]);
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "יש להזין שם בית ספר" };
  const s = await db.school.create({ data: { name, teacherInviteCode: friendlyCode(8) } });
  await audit(admin.id, "admin.school_create", { type: "School", id: s.id });
  revalidatePath("/admin");
  return { ok: `בית הספר נוצר. קוד הצטרפות למורים: ${s.teacherInviteCode}` };
}

export async function updateRetentionAction(schoolId: string, _: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser(["ADMIN"]);
  const raw = String(form.get("days") ?? "").trim();
  const days = raw === "" ? null : Number(raw);
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 3650)) return { error: "מספר ימים לא תקין" };
  await db.school.update({ where: { id: schoolId }, data: { recordingRetentionDays: days } });
  await audit(admin.id, "admin.retention_update", { type: "School", id: schoolId }, { days });
  revalidatePath("/admin");
  return { ok: "נשמר" };
}

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["TEACHER", "ADMIN"]),
  schoolId: z.string().optional(),
});

export async function createStaffAction(_: (FormState & { password?: string }) | undefined, form: FormData): Promise<FormState & { password?: string }> {
  const admin = await requireUser(["ADMIN"]);
  const p = createUserSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "פרטים לא תקינים" };
  if (p.data.role === "TEACHER" && !p.data.schoolId) return { error: "יש לבחור בית ספר" };
  const password = tempPassword();
  try {
    const u = await db.user.create({
      data: {
        name: p.data.name,
        email: p.data.email,
        username: p.data.email,
        role: p.data.role,
        schoolId: p.data.role === "TEACHER" ? p.data.schoolId : null,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    });
    await audit(admin.id, "admin.user_create", { type: "User", id: u.id }, { role: u.role });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "כתובת הדוא״ל כבר קיימת" };
    throw e;
  }
  revalidatePath("/admin/users");
  return { ok: "החשבון נוצר", password };
}

export async function setUserActiveAction(userId: string, active: boolean) {
  const admin = await requireUser(["ADMIN"]);
  if (userId === admin.id) return;
  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  if (!active) await db.session.deleteMany({ where: { userId } });
  await audit(admin.id, active ? "admin.user_activate" : "admin.user_deactivate", { type: "User", id: userId });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(userId: string) {
  const admin = await requireUser(["ADMIN"]);
  if (userId === admin.id) return;
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) return;
  if (u.role === "TEACHER") {
    // Assignments reference exams with RESTRICT; remove the teacher's assignments (and their attempts/recordings) first.
    const recordings = await db.mediaFile.findMany({ where: { answers: { some: { attempt: { assignment: { classroom: { teacherId: userId } } } } } }, select: { id: true } });
    await db.assignment.deleteMany({ where: { OR: [{ createdById: userId }, { classroom: { teacherId: userId } }, { exam: { ownerId: userId } }] } });
    const { storage } = await import("@/lib/storage");
    const files = await db.mediaFile.findMany({ where: { id: { in: recordings.map((r) => r.id) } } });
    await db.mediaFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
    for (const f of files) await storage().delete(f.storageKey).catch(() => undefined);
  }
  const n = await deleteUserCompletely(userId);
  await audit(admin.id, "admin.user_delete", { type: "User", id: userId }, { role: u.role, files: n });
  revalidatePath("/admin/users");
}

export async function adminResetPasswordAction(userId: string): Promise<{ password?: string; error?: string }> {
  const admin = await requireUser(["ADMIN"]);
  const password = tempPassword();
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
  await db.session.deleteMany({ where: { userId } });
  await audit(admin.id, "admin.reset_password", { type: "User", id: userId });
  return { password };
}
