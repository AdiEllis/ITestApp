import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./authz";
import { getCurrentUser, type SessionUser } from "./auth";
import { env } from "./env";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) return json({ error: err.message }, err.status);
  if (err instanceof ZodError) return json({ error: "הנתונים שנשלחו אינם תקינים" }, 400);
  console.error(err);
  return json({ error: "אירעה שגיאה. נסו שוב בעוד רגע." }, 500);
}

/** Rejects cross-site state-changing requests (CSRF defence for JSON route handlers). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetch from some browsers omits Origin on PUT; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try {
    const o = new URL(origin);
    ok = o.host === host || origin === env.appUrl;
  } catch {
    ok = false;
  }
  if (!ok) throw new AppError(403, "בקשה ממקור לא מורשה");
}

type Handler<C> = (req: Request, user: SessionUser, ctx: C) => Promise<Response>;

/** Wraps an authenticated route handler: auth, origin check for mutations, safe errors. */
export function withUser<C>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      const user = await getCurrentUser();
      if (!user) return json({ error: "יש להתחבר מחדש" }, 401);
      return await handler(req, user, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
