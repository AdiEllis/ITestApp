import { db } from "./db";
import { storage } from "./storage";
import { friendlyCode, tempPassword } from "./crypto";
import { hashPassword } from "./auth";

/** Permanently deletes a user and every file they own (recordings, uploads). */
export async function deleteUserCompletely(userId: string) {
  const media = await db.mediaFile.findMany({ where: { ownerId: userId }, select: { storageKey: true } });
  await db.user.delete({ where: { id: userId } });
  for (const m of media) await storage().delete(m.storageKey).catch((e) => console.error("storage delete failed", e));
  return media.length;
}

function slug(name: string) {
  // Hebrew names produce empty slugs — fall back to "student".
  const s = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 16);
  return s.length >= 2 ? s : "student";
}

export async function uniqueUsername(name: string) {
  const base = slug(name);
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}.${friendlyCode(4).toLowerCase()}`;
    if (!(await db.user.findUnique({ where: { username: candidate } }))) return candidate;
  }
  throw new Error("could not allocate username");
}

/** Creates a student with a temporary password that must be changed at first login. */
export async function createStudentAccount(name: string, schoolId: string, classroomId: string) {
  const username = await uniqueUsername(name);
  const password = tempPassword();
  const user = await db.user.create({
    data: {
      username,
      name,
      role: "STUDENT",
      schoolId,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      enrollments: { create: { classroomId } },
    },
  });
  return { user, username, password };
}
