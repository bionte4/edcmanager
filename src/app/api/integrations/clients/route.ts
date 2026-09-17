import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { IntegrationScope } from "@/config/integration.config";
import {
  createIntegrationClient,
  deleteIntegrationClient,
  hardDeleteIntegrationClient,
  listIntegrationClients,
  rotateIntegrationClientKey,
  updateIntegrationClient,
} from "@/data/integration-clients-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, type AuthUser } from "@/lib/rbac";

async function requireIntegrationAdmin(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  const user = sessionToAuthUser(session);
  assertCan(user, "admin:access");
  return user;
}

function statusFor(e: unknown): number {
  const message = e instanceof Error ? e.message : "Error";
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 400;
}

export async function GET() {
  try {
    await requireIntegrationAdmin();
    return NextResponse.json({ clients: await listIntegrationClients(true) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: statusFor(e) }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireIntegrationAdmin();
    const body = (await request.json()) as {
      name?: string;
      externalSystem?: string;
      scopes?: IntegrationScope[];
      isActive?: boolean;
      keyId?: string;
      apiKey?: string;
      action?: "rotate";
      id?: string;
    };

    if (body.action === "rotate") {
      if (!body.id) {
        return NextResponse.json({ error: "id wajib untuk rotate." }, { status: 400 });
      }
      const client = await rotateIntegrationClientKey(body.id);
      return NextResponse.json({ client });
    }

    const client = await createIntegrationClient({
      name: body.name ?? "",
      externalSystem: body.externalSystem ?? "",
      scopes: body.scopes,
      isActive: body.isActive,
      keyId: body.keyId,
      apiKey: body.apiKey,
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membuat client" },
      { status: statusFor(e) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireIntegrationAdmin();
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      externalSystem?: string;
      scopes?: IntegrationScope[];
      isActive?: boolean;
      keyId?: string;
      apiKey?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    const client = await updateIntegrationClient(body.id, {
      name: body.name,
      externalSystem: body.externalSystem,
      scopes: body.scopes,
      isActive: body.isActive,
      keyId: body.keyId,
      apiKey: body.apiKey,
    });
    return NextResponse.json({ client });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal update client" },
      { status: statusFor(e) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireIntegrationAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hard = searchParams.get("hard") === "1";
    if (!id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    const client = hard
      ? await hardDeleteIntegrationClient(id)
      : await deleteIntegrationClient(id);
    return NextResponse.json({ client });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal hapus client" },
      { status: statusFor(e) }
    );
  }
}
