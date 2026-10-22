"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  authenticate,
  clientIp,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  homeFor,
  passwordProblem,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { friendlyCode } from "@/lib/crypto";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/ui/form-message";

function safeNext(next: unknown, fallback: string) {
  return typeof next === "string" && /^\/(t|s|admin)(\/|$)/.test(next) ? next : fallback;
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!identifier || !password) return { error: "יש להזין שם משתמש וסיסמה" };
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 30, 15 * 60)) || !(await rateLimit(`login-id:${identifier.toLowerCase()}`, 10, 15 * 60)))
    return { error: "יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות." };
  const r = await authenticate(identifier, password);
  if (!r.ok) {
    return {
      error:
        r.reason === "locked"
          ? "החשבון ננעל זמנית עקב ניסיונות כושלים. נסו שוב בעוד 15 דקות."
          : r.reason === "google"
            ? "החשבון הזה מתחבר עם Google. לחצו על \"התחברות עם Google\"."
            : "שם המשתמש או הסיסמה שגויים",
    };
  }
  await createSession(r.user.id);
  await audit(r.user.id, "auth.login");
  if (r.user.mustChangePassword) redirect("/change-password");
  redirect(safeNext(form.get("next"), homeFor(r.user.role)));
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "auth.logout");
  redirect("/login");
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "שם משתמש: 3–32 תווים באנגלית, ספרות, נקודה, מקף או קו תחתון");

const registerSchema = z.object({
  name: z.string().trim().min(2, "יש להזין שם מלא").max(80),
  email: z.string().trim().toLowerCase().email("כתובת דוא״ל לא תקינה").max(120),
  password: z.string(),
  schoolMode: z.enum(["new", "join"]),
  schoolName: z.string().trim().max(120).optional(),
  inviteCode: z.string().trim().toUpperCase().max(20).optional(),
  terms: z.literal("on", { message: "יש לאשר את תנאי השימוש והפרטיות" }),
});

export async function registerTeacherAction(_: FormState, form: FormData): Promise<FormState> {
  if (!env.allowTeacherSignup) return { error: "ההרשמה העצמית סגורה. פנו למנהל המערכת." };
  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 10, 3600))) return { error: "יותר מדי ניסיונות. נסו שוב מאוחר יותר." };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const pw = passwordProblem(d.password);
  if (pw) return { error: pw };

  let schoolId: string;
  if (d.schoolMode === "join") {
    const school = d.inviteCode ? await db.school.findUnique({ where: { teacherInviteCode: d.inviteCode } }) : null;
    if (!school) return { error: "קוד בית הספר אינו תקין" };
    schoolId = school.id;
  } else {
    if (!d.schoolName || d.schoolName.length < 2) return { error: "יש להזין את שם בית הספר" };
    const school = await db.school.create({ data: { name: d.schoolName, teacherInviteCode: friendlyCode(8) } });
    schoolId = school.id;
  }
  try {
    const user = await db.user.create({
      data: {
        username: d.email,
        email: d.email,
        name: d.name,
        passwordHash: await hashPassword(d.password),
        role: "TEACHER",
        schoolId,
      },
    });
    await audit(user.id, "auth.register_teacher", { type: "School", id: schoolId });
    await createSession(user.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "כבר קיים חשבון עם כתובת דוא״ל זו" };
    throw e;
  }
  redirect("/t");
}

const joinSchema = z.object({
  code: z.string().trim().toUpperCase().min(4, "יש להזין קוד כיתה").max(12),
  name: z.string().trim().min(2, "יש להזין שם מלא").max(80),
  username: usernameSchema,
  password: z.string(),
});

/** Student self-registration with a class join code (no email required). */
export async function joinClassAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimit(`join:${ip}`, 20, 3600))) return { error: "יותר מדי ניסיונות. נסו שוב מאוחר יותר." };
  if (form.get("terms") !== "on") return { error: "יש לאשר את מדיניות הפרטיות" };
  const parsed = joinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const pw = passwordProblem(d.password);
  if (pw) return { error: pw };
  const classroom = await db.classroom.findUnique({ where: { joinCode: d.code } });
  if (!classroom || !classroom.joinEnabled || classroom.archived) return { error: "קוד הכיתה אינו תקין או שההצטרפות סגורה" };
  try {
    const user = await db.user.create({
      data: {
        username: d.username,
        name: d.name,
        passwordHash: await hashPassword(d.password),
        role: "STUDENT",
        schoolId: classroom.schoolId,
        enrollments: { create: { classroomId: classroom.id } },
      },
    });
    await audit(user.id, "auth.join_class", { type: "Classroom", id: classroom.id });
    await createSession(user.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "שם המשתמש תפוס. בחרו שם אחר." };
    throw e;
  }
  redirect("/s");
}

/** Existing student joins another class. */
export async function joinAnotherClassAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return { error: "יש להתחבר כתלמיד" };
  if (!(await rateLimit(`join2:${user.id}`, 20, 3600))) return { error: "יותר מדי ניסיונות" };
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const classroom = code ? await db.classroom.findUnique({ where: { joinCode: code } }) : null;
  if (!classroom || !classroom.joinEnabled || classroom.archived || classroom.schoolId !== user.schoolId)
    return { error: "קוד הכיתה אינו תקין" };
  await db.enrollment.upsert({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId: user.id } },
    create: { classroomId: classroom.id, studentId: user.id },
    update: {},
  });
  return { ok: `הצטרפת לכיתה ${classroom.name}` };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next !== confirm) return { error: "הסיסמאות אינן תואמות" };
  const pw = passwordProblem(next);
  if (pw) return { error: pw };
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!full.passwordHash) return { error: "החשבון הזה מתחבר עם Google ואין לו סיסמה" };
  if (!(await verifyPassword(current, full.passwordHash))) return { error: "הסיסמה הנוכחית שגויה" };
  if (current === next) return { error: "הסיסמה החדשה חייבת להיות שונה מהנוכחית" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } });
  // Invalidate all other sessions.
  await db.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  await audit(user.id, "auth.change_password");
  redirect(homeFor(user.role));
}
