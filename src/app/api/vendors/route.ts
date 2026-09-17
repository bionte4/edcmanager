import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createVendor,
  deleteVendor,
  listVendors,
  resetVendors,
  updateVendor,
  type VendorInput,
} from "@/data/vendors-store";
import { loadVendorMetrics } from "@/data/vendors";
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
    assertCan(user, "vendor:read");
    const { searchParams } = new URL(request.url);
    if (searchParams.get("view") === "metrics") {
      return NextResponse.json({ metrics: await loadVendorMetrics() });
    }
    const activeOnly = searchParams.get("activeOnly") === "1";
    return NextResponse.json({
      vendors: await listVendors({ activeOnly }),
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
    assertCan(user, "vendor:manage");
    const body = (await request.json()) as VendorInput & {
      action?: "create" | "reset";
    };

    if (body.action === "reset") {
      return NextResponse.json({ vendors: await resetVendors() });
    }

    const vendor = await createVendor(body);
    return NextResponse.json({ vendor }, { status: 201 });
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
    assertCan(user, "vendor:manage");
    const body = (await request.json()) as Partial<VendorInput> & {
      id?: string;
    };
    if (!body.id) throw new Error("id wajib diisi.");
    const { id, ...rest } = body;
    const vendor = await updateVendor(id, rest);
    return NextResponse.json({ vendor });
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
    assertCan(user, "vendor:manage");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("id wajib diisi.");
    const result = await deleteVendor(id);
    return NextResponse.json({
      ok: true,
      soft: result.soft,
      message: result.soft
        ? "Vendor punya data terkait — dinonaktifkan."
        : "Vendor dihapus.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
