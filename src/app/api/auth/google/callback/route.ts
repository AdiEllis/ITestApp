import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyToken } from "@/lib/crypto";
import { exchangeCode } from "@/lib/google";
import { resolveGoogleUser, type GoogleIntent } from "@/lib/google-login";
import { createSession, homeFor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type StatePayload = { s: string; v: string; i: GoogleIntent["kind"]; c?: string; sn?: string; inv?: string; n?: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get("g_oauth")?.value;
  jar.delete({ name: "g_oauth", path: "/api/auth/google" });
  const fail = (error: string, code?: string) => {
    const to = new URL(code ? `/join?code=${encodeURIComponent(code)}&error=${error}` : `/login?error=${error}`, req.url);
    return NextResponse.redirect(to, 303);
  };

  const st = raw ? verifyToken<StatePayload>(raw, env.appSecret) : null;
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "failed" : "blocked", st?.c);
  const code = url.searchParams.get("code");
  if (!st || !code || url.searchParams.get("state") !== st.s) return fail("failed");

  let profile;
  try {
    profile = await exchangeCode(code, st.v, `${env.appUrl}/api/auth/google/callback`);
  } catch (e) {
    console.error("google sign-in failed", e);
    return fail("failed", st.c);
  }
  const r = await resolveGoogleUser(profile, { kind: st.i, classCode: st.c, schoolName: st.sn, inviteCode: st.inv }, env.allowTeacherSignup);
  if (!r.ok) return fail(r.error, st.i === "student" ? st.c : undefined);

  await db.user.update({ where: { id: r.user.id }, data: { lastLoginAt: new Date(), failedLogins: 0 } });
  await createSession(r.user.id);
  await audit(r.user.id, "auth.login_google");
  const dest = st.n ?? homeFor(r.user.role);
  return NextResponse.redirect(new URL(r.joinedClass && !st.n ? `${dest}?joined=${encodeURIComponent(r.joinedClass)}` : dest, req.url), 303);
}
