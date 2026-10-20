import { NextResponse, type NextRequest } from "next/server";

// Fast cookie-presence gate. Real session + role checks happen server-side on every page/action.
export function middleware(req: NextRequest) {
  const has = req.cookies.has("cobe_session");
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/t/:path*", "/s/:path*", "/admin/:path*", "/preview/:path*", "/change-password"] };
