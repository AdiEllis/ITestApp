import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { env } from "./env";

export const SESSION_COOKIE = "cobe_session";
const SESSION_DAYS = 14;
const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
let dummyHash: string | undefined;

export type SessionUser = Pick<
  User,
  "id" | "name" | "username" | "email" | "role" | "schoolId" | "mustChangePassword" | "isDemo"
>;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "הסיסמה חייבת להכיל לפחות 8 תווים";
  if (password.length > 200) return "הסיסמה ארוכה מדי";
  if (!/[A-Za-z֐-׿]/.test(password) || !/\d/.test(password)) return "הסיסמה חייבת לכלול אותיות ומספרים";
  return null;
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.session.create({ data: { id: sha256(token), userId, expiresAt, userAgent: ua } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: {
      user: {
        select: { id: true, name: true, username: true, email: true, role: true, schoolId: true, mustChangePassword: true, isDemo: true, isActive: true },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { isActive: _ignored, ...user } = session.user;
  return user;
}

/** For server components/actions. Redirects when not signed in or wrong role. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  return role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/t" : "/s";
}

/** Verifies credentials with lockout after repeated failures. */
export async function authenticate(identifier: string, password: string) {
  const id = identifier.trim().toLowerCase();
  const user = await db.user.findFirst({ where: { OR: [{ username: id }, { email: id }] } });
  if (!user || !user.isActive) {
    // Spend comparable time to avoid user enumeration by timing.
    dummyHash ??= await bcrypt.hash("timing-equalizer", 12);
    await bcrypt.compare(password, dummyHash);
    return { ok: false as const, reason: "invalid" as const };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false as const, reason: "locked" as const };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return { ok: false as const, reason: "invalid" as const };
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return { ok: true as const, user };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}
