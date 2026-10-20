"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { AppError, getManagedStudent, getOwnClassroom } from "@/lib/authz";
import { friendlyCode, tempPassword } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { createStudentAccount, deleteUserCompletely } from "@/lib/users";
import type { FormState } from "@/components/ui/form-message";

async function teacher() {
  const user = await requireUser(["TEACHER"]);
  if (!user.schoolId) throw new AppError(400, "החשבון אינו משויך לבית ספר");
  return user as typeof user & { schoolId: string };
}

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "נתונים לא תקינים" };
  throw e;
}

const classSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם כיתה").max(60),
  gradeLevel: z.string().trim().max(30).optional(),
});

export async function createClassroomAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await teacher();
  const parsed = classSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const c = await db.classroom.create({
    data: { ...parsed.data, gradeLevel: parsed.data.gradeLevel || null, schoolId: user.schoolId, teacherId: user.id, joinCode: friendlyCode(6) },
  });
  await audit(user.id, "classroom.create", { type: "Classroom", id: c.id });
  redirect(`/t/classes/${c.id}`);
}

export async function updateClassroomAction(classroomId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await teacher();
    await getOwnClassroom(user, classroomId);
    const d = classSchema.parse(Object.fromEntries(form));
    await db.classroom.update({
      where: { id: classroomId },
      data: { name: d.name, gradeLevel: d.gradeLevel || null, joinEnabled: form.get("joinEnabled") === "on" },
    });
    revalidatePath(`/t/classes/${classroomId}`);
    return { ok: "הפרטים נשמרו" };
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateJoinCodeAction(classroomId: string) {
  const user = await teacher();
  await getOwnClassroom(user, classroomId);
  await db.classroom.update({ where: { id: classroomId }, data: { joinCode: friendlyCode(6) } });
  revalidatePath(`/t/classes/${classroomId}`);
}

export async function archiveClassroomAction(classroomId: string, archived: boolean) {
  const user = await teacher();
  await getOwnClassroom(user, classroomId);
  await db.classroom.update({ where: { id: classroomId }, data: { archived } });
  await audit(user.id, archived ? "classroom.archive" : "classroom.unarchive", { type: "Classroom", id: classroomId });
  revalidatePath("/t/classes");
  revalidatePath(`/t/classes/${classroomId}`);
}

export type CreatedCredentials = { name: string; username: string; password: string }[];
export type AddStudentsState = (FormState & { created?: CreatedCredentials }) | undefined;

/** Adds students by name (one per line). Returns one-time credentials to hand out. */
export async function addStudentsAction(classroomId: string, _: AddStudentsState, form: FormData): Promise<AddStudentsState> {
  try {
    const user = await teacher();
    const classroom = await getOwnClassroom(user, classroomId);
    const names = String(form.get("names") ?? "")
      .split(/\r?\n/)
      .map((n) => n.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (names.length === 0) return { error: "יש להזין לפחות שם אחד" };
    if (names.length > 60) return { error: "ניתן להוסיף עד 60 תלמידים בכל פעם" };
    if (names.some((n) => n.length > 80)) return { error: "שם ארוך מדי" };
    const created: CreatedCredentials = [];
    for (const name of names) {
      const r = await createStudentAccount(name, classroom.schoolId, classroom.id);
      created.push({ name, username: r.username, password: r.password });
    }
    await audit(user.id, "student.create_bulk", { type: "Classroom", id: classroomId }, { count: created.length });
    revalidatePath(`/t/classes/${classroomId}`);
    return { ok: `נוספו ${created.length} תלמידים`, created };
  } catch (e) {
    return fail(e);
  }
}

/** Adds an existing student account (same school) by username. */
export async function addExistingStudentAction(classroomId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await teacher();
    const classroom = await getOwnClassroom(user, classroomId);
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const student = await db.user.findFirst({ where: { username, role: "STUDENT", schoolId: classroom.schoolId } });
    if (!student) return { error: "לא נמצא תלמיד עם שם משתמש זה בבית הספר" };
    await db.enrollment.upsert({
      where: { classroomId_studentId: { classroomId, studentId: student.id } },
      create: { classroomId, studentId: student.id },
      update: {},
    });
    revalidatePath(`/t/classes/${classroomId}`);
    return { ok: `${student.name} נוסף/ה לכיתה` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeFromClassAction(classroomId: string, studentId: string) {
  const user = await teacher();
  await getOwnClassroom(user, classroomId);
  await db.enrollment.deleteMany({ where: { classroomId, studentId } });
  await audit(user.id, "student.remove_from_class", { type: "User", id: studentId }, { classroomId });
  revalidatePath(`/t/classes/${classroomId}`);
}

export type ResetState = (FormState & { password?: string; username?: string }) | undefined;

export async function resetStudentPasswordAction(studentId: string, _: ResetState): Promise<ResetState> {
  try {
    const user = await teacher();
    const student = await getManagedStudent(user, studentId);
    const password = tempPassword();
    await db.user.update({
      where: { id: student.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
    });
    await db.session.deleteMany({ where: { userId: student.id } });
    await audit(user.id, "student.reset_password", { type: "User", id: student.id });
    return { ok: "נוצרה סיסמה זמנית חדשה", password, username: student.username };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Permanently deletes a student and all their recordings. Refused if the student also
 * belongs to another teacher's class (then only removal from the class is possible).
 */
export async function deleteStudentAction(studentId: string, _: FormState): Promise<FormState> {
  try {
    const user = await teacher();
    const student = await getManagedStudent(user, studentId);
    const other = await db.enrollment.count({ where: { studentId, classroom: { teacherId: { not: user.id } } } });
    if (other > 0) return { error: "התלמיד/ה רשום/ה גם בכיתה של מורה אחר/ת. ניתן רק להסיר מהכיתה שלך; מחיקה מלאה — דרך מנהל המערכת." };
    const files = await deleteUserCompletely(student.id);
    await audit(user.id, "student.delete", { type: "User", id: studentId }, { files });
  } catch (e) {
    return fail(e);
  }
  redirect("/t/classes");
}
