import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById, toPublicUser } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/rbac";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = toPublicUser(stored);
  return NextResponse.json({
    user: sessionToAuthUser(session),
    profile: user,
    permissions: permissionsForRole(stored.role),
  });
}
