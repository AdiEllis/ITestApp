import { Prisma, type User } from "@prisma/client";
import { db } from "./db";
import { friendlyCode } from "./crypto";
import { audit } from "./audit";
import type { GoogleProfile } from "./google";

/** What the person was trying to do when they clicked "Sign in with Google". */
export interface GoogleIntent {
  kind: "login" | "teacher" | "student";
  classCode?: string;
  schoolName?: string;
  inviteCode?: string;
}

export type GoogleLoginResult =
  | { ok: true; user: User; created: boolean; joinedClass?: string }
  | { ok: false; error: "unverified" | "inactive" | "no_account" | "bad_class" | "bad_invite" | "signup_closed" | "wrong_school" };

async function enroll(user: User, classCode: string | undefined): Promise<string | undefined> {
  if (!classCode || user.role !== "STUDENT") return undefined;
  const c = await db.classroom.findUnique({ where: { joinCode: classCode.toUpperCase() } });
  if (!c || !c.joinEnabled || c.archived || c.schoolId !== user.schoolId) return undefined;
  await db.enrollment.upsert({
    where: { classroomId_studentId: { classroomId: c.id, studentId: user.id } },
    create: { classroomId: c.id, studentId: user.id },
    update: {},
  });
  return c.name;
}

/**
 * Finds or creates the account for a Google identity.
 * 1. Known Google id → that account.  2. Same e-mail (e.g. a teacher pre-added the student) → link it.
 * 3. Otherwise create a teacher (teacher sign-up) or a student (class join link); a plain login with
 *    no account is refused so strangers cannot create accounts.
 */
export async function resolveGoogleUser(p: GoogleProfile, intent: GoogleIntent, allowTeacherSignup: boolean): Promise<GoogleLoginResult> {
  if (!p.emailVerified) return { ok: false, error: "unverified" };

  let user = await db.user.findUnique({ where: { googleSub: p.sub } });
  if (!user) {
    const byEmail = await db.user.findFirst({ where: { OR: [{ email: p.email }, { username: p.email }] } });
    if (byEmail) {
      user = await db.user.update({
        where: { id: byEmail.id },
        // Teacher-added students start with the e-mail as their name: take the Google name.
        data: { googleSub: p.sub, email: p.email, name: byEmail.name === byEmail.email ? p.name : byEmail.name },
      });
    }
  }
  if (user) {
    if (!user.isActive) return { ok: false, error: "inactive" };
    const joinedClass = intent.kind === "student" ? await enroll(user, intent.classCode) : undefined;
    return { ok: true, user, created: false, joinedClass };
  }

  if (intent.kind === "teacher") {
    if (!allowTeacherSignup) return { ok: false, error: "signup_closed" };
    let schoolId: string;
    if (intent.inviteCode) {
      const s = await db.school.findUnique({ where: { teacherInviteCode: intent.inviteCode.toUpperCase() } });
      if (!s) return { ok: false, error: "bad_invite" };
      schoolId = s.id;
    } else {
      const s = await db.school.create({ data: { name: intent.schoolName?.trim().slice(0, 120) || `בית הספר של ${p.name}`, teacherInviteCode: friendlyCode(8) } });
      schoolId = s.id;
    }
    const created = await createUser({ username: p.email, email: p.email, name: p.name, role: "TEACHER", schoolId, googleSub: p.sub });
    await audit(created.id, "auth.register_teacher_google", { type: "School", id: schoolId });
    return { ok: true, user: created, created: true };
  }

  if (intent.kind === "student" && intent.classCode) {
    const c = await db.classroom.findUnique({ where: { joinCode: intent.classCode.toUpperCase() } });
    if (!c || !c.joinEnabled || c.archived) return { ok: false, error: "bad_class" };
    const created = await createUser({
      username: p.email,
      email: p.email,
      name: p.name,
      role: "STUDENT",
      schoolId: c.schoolId,
      googleSub: p.sub,
      enrollments: { create: { classroomId: c.id } },
    });
    await audit(created.id, "auth.join_class_google", { type: "Classroom", id: c.id });
    return { ok: true, user: created, created: true, joinedClass: c.name };
  }

  return { ok: false, error: "no_account" };
}

async function createUser(data: Prisma.UserUncheckedCreateInput) {
  try {
    return await db.user.create({ data });
  } catch (e) {
    // Two tabs racing on first sign-in: return the account the other one created.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const u = await db.user.findFirst({ where: { OR: [{ googleSub: data.googleSub ?? undefined }, { username: data.username }] } });
      if (u) return u;
    }
    throw e;
  }
}

export const GOOGLE_ERRORS: Record<string, string> = {
  unverified: "כתובת המייל בחשבון Google הזה לא אומתה.",
  inactive: "החשבון הושבת. פנו למורה או למנהל המערכת.",
  no_account: "לא מצאנו חשבון עם המייל הזה. תלמידים — היכנסו דרך קישור ההצטרפות שקיבלתם מהמורה. מורים — \"פתיחת חשבון מורה\".",
  bad_class: "קישור ההצטרפות לכיתה אינו תקין או שההצטרפות סגורה. בקשו מהמורה קישור חדש.",
  bad_invite: "קוד בית הספר אינו תקין.",
  signup_closed: "פתיחת חשבונות מורים סגורה. פנו למנהל המערכת.",
  wrong_school: "הכיתה שייכת לבית ספר אחר.",
  failed: "ההתחברות עם Google לא הושלמה. נסו שוב.",
  disabled: "התחברות עם Google עדיין לא הוגדרה באתר הזה.",
  blocked: "Google חסם את ההתחברות. אם זה חשבון של בית הספר, ייתכן שבית הספר לא מאפשר כניסה לאתרים חיצוניים — נסו עם Gmail אישי, או השתמשו ב\"אין לי חשבון Google\".",
};
