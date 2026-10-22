import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { randomToken, signToken } from "@/lib/crypto";
import { authUrl, pkce } from "@/lib/google";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";


/** GET /api/auth/google/start?intent=login|teacher|student&code=CLASS&school=…&invite=…&next=… */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, req.url), 303);
  if (!env.googleEnabled) return back("disabled");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await rateLimit(`gstart:${ip}`, 60, 15 * 60))) return back("failed");

  const intent = ["teacher", "student"].includes(url.searchParams.get("intent") ?? "") ? url.searchParams.get("intent")! : "login";
  const clip = (v: string | null, n: number) => (v ?? "").trim().slice(0, n) || undefined;
  const next = url.searchParams.get("next");
  const state = randomToken(24);
  const { verifier, challenge } = pkce();
  const payload = {
    s: state,
    v: verifier,
    i: intent,
    c: clip(url.searchParams.get("code"), 12),
    sn: clip(url.searchParams.get("school"), 120),
    inv: clip(url.searchParams.get("invite"), 20),
    n: next && /^\/(t|s|admin)(\/|$)/.test(next) ? next : undefined,
  };
  const redirectUri = `${env.appUrl}/api/auth/google/callback`;
  const res = NextResponse.redirect(authUrl({ redirectUri, state, challenge }), 303);
  res.cookies.set("g_oauth", signToken(payload, env.appSecret, 10 * 60), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
