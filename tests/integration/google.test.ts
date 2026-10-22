import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { profileFromIdToken, type GoogleProfile } from "@/lib/google";
import { resolveGoogleUser } from "@/lib/google-login";
import { friendlyCode } from "@/lib/crypto";
import { makeSchool, makeUser, resetDb } from "./helpers";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (claims: object) => `${b64({ alg: "RS256" })}.${b64(claims)}.sig`;
const now = Math.floor(Date.now() / 1000);

describe("Google ID token claims", () => {
  const ok = { iss: "https://accounts.google.com", aud: "client-1", exp: now + 600, sub: "123", email: "Noa@Gmail.com", email_verified: true, name: "Noa Cohen" };
  it("accepts a valid token and normalises the e-mail", () => {
    expect(profileFromIdToken(token(ok), "client-1")).toEqual({ sub: "123", email: "noa@gmail.com", emailVerified: true, name: "Noa Cohen" });
  });
  it("rejects wrong issuer, audience or expired tokens", () => {
    expect(() => profileFromIdToken(token({ ...ok, iss: "https://evil.example" }), "client-1")).toThrow();
    expect(() => profileFromIdToken(token({ ...ok, aud: "other" }), "client-1")).toThrow();
    expect(() => profileFromIdToken(token({ ...ok, exp: now - 3600 }), "client-1")).toThrow();
    expect(() => profileFromIdToken("garbage", "client-1")).toThrow();
  });
});

describe("Google sign-in account resolution", () => {
  beforeEach(resetDb);
  const p = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({ sub: "g-1", email: "noa@gmail.com", emailVerified: true, name: "Noa Cohen", ...over });

  it("refuses unknown people on plain login (no self-created accounts)", async () => {
    expect(await resolveGoogleUser(p(), { kind: "login" }, true)).toEqual({ ok: false, error: "no_account" });
    expect(await db.user.count()).toBe(0);
  });

  it("teacher sign-up creates a school + teacher; a second sign-in reuses the account", async () => {
    const r = await resolveGoogleUser(p(), { kind: "teacher", schoolName: "Herzl High" }, true);
    expect(r.ok && r.created && r.user.role).toBe("TEACHER");
    expect((await db.school.findFirst())?.name).toBe("Herzl High");
    const again = await resolveGoogleUser(p(), { kind: "login" }, true);
    expect(again.ok && !again.created && again.user.id).toBe(r.ok && r.user.id);
    expect(await resolveGoogleUser(p({ sub: "g-2", email: "x@y.com" }), { kind: "teacher" }, false)).toEqual({ ok: false, error: "signup_closed" });
  });

  it("class join link creates an enrolled student; bad codes are refused", async () => {
    const school = await makeSchool();
    const t = await makeUser("TEACHER", school.id);
    const c = await db.classroom.create({ data: { name: "11A", schoolId: school.id, teacherId: t.id, joinCode: friendlyCode(6) } });
    const r = await resolveGoogleUser(p(), { kind: "student", classCode: c.joinCode.toLowerCase() }, true);
    expect(r.ok && r.user.role).toBe("STUDENT");
    expect(r.ok && r.joinedClass).toBe("11A");
    expect(await db.enrollment.count({ where: { classroomId: c.id } })).toBe(1);
    expect(await resolveGoogleUser(p({ sub: "g-9", email: "z@z.com" }), { kind: "student", classCode: "NOPE00" }, true)).toEqual({ ok: false, error: "bad_class" });
    await db.classroom.update({ where: { id: c.id }, data: { joinEnabled: false } });
    expect(await resolveGoogleUser(p({ sub: "g-8", email: "w@w.com" }), { kind: "student", classCode: c.joinCode }, true)).toEqual({ ok: false, error: "bad_class" });
  });

  it("links a student the teacher pre-added by e-mail, taking the Google name", async () => {
    const school = await makeSchool();
    const pre = await db.user.create({ data: { username: "noa@gmail.com", email: "noa@gmail.com", name: "noa@gmail.com", role: "STUDENT", schoolId: school.id } });
    const r = await resolveGoogleUser(p(), { kind: "login" }, true);
    expect(r.ok && r.user.id).toBe(pre.id);
    const u = await db.user.findUniqueOrThrow({ where: { id: pre.id } });
    expect(u.googleSub).toBe("g-1");
    expect(u.name).toBe("Noa Cohen");
  });

  it("refuses unverified e-mails and deactivated accounts", async () => {
    expect(await resolveGoogleUser(p({ emailVerified: false }), { kind: "teacher" }, true)).toEqual({ ok: false, error: "unverified" });
    const school = await makeSchool();
    await db.user.create({ data: { username: "noa@gmail.com", email: "noa@gmail.com", name: "N", role: "STUDENT", schoolId: school.id, isActive: false } });
    expect(await resolveGoogleUser(p(), { kind: "login" }, true)).toEqual({ ok: false, error: "inactive" });
  });

  it("an existing student using another class link is enrolled only within their own school", async () => {
    const s1 = await makeSchool();
    const s2 = await makeSchool();
    const t1 = await makeUser("TEACHER", s1.id);
    const t2 = await makeUser("TEACHER", s2.id);
    const c1 = await db.classroom.create({ data: { name: "A", schoolId: s1.id, teacherId: t1.id, joinCode: friendlyCode(6) } });
    const c2 = await db.classroom.create({ data: { name: "B", schoolId: s2.id, teacherId: t2.id, joinCode: friendlyCode(6) } });
    await resolveGoogleUser(p(), { kind: "student", classCode: c1.joinCode }, true);
    const r = await resolveGoogleUser(p(), { kind: "student", classCode: c2.joinCode }, true);
    expect(r.ok && r.joinedClass).toBeUndefined();
    expect(await db.enrollment.count({ where: { classroomId: c2.id } })).toBe(0);
  });
});
