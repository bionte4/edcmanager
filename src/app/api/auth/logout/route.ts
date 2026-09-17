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
  // Extra clear for environments that ignore maxAge alone
  response.cookies.delete(SESSION_COOKIE);
}

/** Browser-friendly logout: clear cookie then redirect to login. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const login = new URL("/login", url.origin);
  login.searchParams.set("loggedOut", "1");
  const response = NextResponse.redirect(login);
  clearSessionCookie(response);
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
