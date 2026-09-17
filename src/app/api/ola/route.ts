import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { OlaStage } from "@/config/ola.config";
import {
  createOlaPolicy,
  deleteOlaPolicy,
  listOlaPolicies,
  resetOlaPolicies,
  updateOlaPolicy,
  type OlaPolicyInput,
} from "@/data/ola-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, type AuthUser } from "@/lib/rbac";

async function requireUser(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  return sessionToAuthUser(session);
}

function statusFor(e: unknown): number {
  const message = e instanceof Error ? e.message : "Error";
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 400;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "ola:read");
    const { searchParams } = new URL(request.url);
    const stage = (searchParams.get("stage") as OlaStage | null) ?? undefined;
    const activeOnly = searchParams.get("activeOnly") === "1";
    return NextResponse.json({
      policies: listOlaPolicies({ stage, activeOnly }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: statusFor(e) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "ola:manage");
    const body = (await request.json()) as OlaPolicyInput & {
      action?: "create" | "reset";
    };

    if (body.action === "reset") {
      return NextResponse.json({ policies: await resetOlaPolicies() });
    }

    const policy = await createOlaPolicy(body);
    return NextResponse.json({ policy }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "ola:manage");
    const body = (await request.json()) as Partial<OlaPolicyInput> & { id?: string };
    if (!body.id) throw new Error("id wajib diisi.");
    const { id, ...rest } = body;
    const policy = await updateOlaPolicy(id, rest);
    return NextResponse.json({ policy });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "ola:manage");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("id wajib diisi.");
    await deleteOlaPolicy(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
