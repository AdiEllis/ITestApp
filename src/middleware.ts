import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = /^\/(t|s|admin|preview)(\/|$)|^\/change-password$/;

/** Runtime CSP: presigned media/upload URLs may point at the configured S3 endpoint (http for self-hosted MinIO). */
function csp() {
  let s3 = "";
  try {
    s3 = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : "";
  } catch {
    s3 = "";
  }
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `media-src 'self' blob: https: ${s3}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' https: ${s3}${dev ? " ws:" : ""}`.trim(),
    "frame-src 'self' https:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// Fast cookie-presence gate for app areas. Real session + role checks happen server-side on every page/action.
export function middleware(req: NextRequest) {
  let res: NextResponse;
  if (PROTECTED.test(req.nextUrl.pathname) && !req.cookies.has("cobe_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    res = NextResponse.redirect(url);
  } else {
    res = NextResponse.next();
  }
  res.headers.set("Content-Security-Policy", csp());
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|api/storage|favicon.ico).*)"] };
