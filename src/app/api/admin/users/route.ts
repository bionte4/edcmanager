import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createUser,
  deleteUser,
  listUsers,
  toPublicUser,
  updateUser,
  findUserById,
} from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, type AuthUser } from "@/lib/rbac";
import type { AppRole } from "@/config/rbac.config";

async function requireAdmin(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  const user = sessionToAuthUser(session);
  assertCan(user, "user:manage");
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
    const users = (await listUsers()).map(toPublicUser);
    return NextResponse.json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Forbidden";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      role?: AppRole;
      password?: string;
      isActive?: boolean;
    };
    const user = await createUser({
      name: body.name ?? "",
      email: body.email ?? "",
      phone: body.phone,
      role: body.role ?? "NOC",
      password: body.password,
      isActive: body.isActive,
    });
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membuat user";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      role?: AppRole;
      password?: string;
      isActive?: boolean;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    const user = await updateUser(body.id, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      password: body.password,
      isActive: body.isActive,
    });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal update user";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal hapus user";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
