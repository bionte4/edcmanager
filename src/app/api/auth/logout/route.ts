import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.delete(SESSION_COOKIE);
}

/**
 * Build public origin from reverse-proxy headers.
 * request.url often becomes http://0.0.0.0:3000 inside Docker (HOSTNAME=0.0.0.0),
 * which must never be used in browser redirects.
 */
function publicOrigin(request: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = headers.get("host")?.split(",")[0]?.trim();
  let host = forwardedHost || hostHeader || "localhost";

  if (host.startsWith("0.0.0.0")) {
    host = host.replace(/^0\.0\.0\.0/, "localhost");
  }

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${proto}://${host}`;
}

/** Browser-friendly logout: clear cookie then redirect to login. */
export async function GET(request: Request) {
  const login = new URL("/login", publicOrigin(request));
  login.searchParams.set("loggedOut", "1");
  const response = NextResponse.redirect(login, 303);
  clearSessionCookie(response);
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
