import { NextResponse } from "next/server";
import { authenticateUser } from "@/data/users-store";
import { recordLoginAttendance } from "@/data/wfm-store";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Email atau password salah, atau akun nonaktif." },
        { status: 401 }
      );
    }

    const attendance = await recordLoginAttendance(user);

    const token = await createSessionToken(user);
    const response = NextResponse.json({ user, attendance });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Gagal login." }, { status: 500 });
  }
}
