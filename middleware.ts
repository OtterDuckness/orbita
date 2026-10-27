import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_SANDBOX = "orbita_sandbox";
const HEADER_SANDBOX = "x-orbita-sandbox";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function attrsCookieSandbox() {
  return {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoggedIn = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const param = req.nextUrl.searchParams.get("sandbox");
  const cookieVal =
    param === "0" || param === "1" ? param : req.cookies.get(COOKIE_SANDBOX)?.value;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(HEADER_SANDBOX);
  if (cookieVal === "1") requestHeaders.set(HEADER_SANDBOX, "1");

  if (param === "0" || param === "1") {
    const url = req.nextUrl.clone();
    url.searchParams.delete("sandbox");
    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE_SANDBOX, param, attrsCookieSandbox());
    return res;
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
