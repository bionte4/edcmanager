import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createLocation,
  deleteLocation,
  listLocations,
  resetLocations,
  updateLocation,
  type LocationInput,
} from "@/data/locations-store";
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
    assertCan(user, "location:read");
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "1";
    return NextResponse.json({
      locations: await listLocations({ activeOnly }),
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
    assertCan(user, "location:manage");
    const body = (await request.json()) as LocationInput & {
      action?: "create" | "reset";
    };

    if (body.action === "reset") {
      return NextResponse.json({
        locations: await resetLocations(),
      });
    }

    const location = await createLocation(body);
    return NextResponse.json({ location }, { status: 201 });
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
    assertCan(user, "location:manage");
    const body = (await request.json()) as Partial<LocationInput> & {
      id?: string;
    };
    if (!body.id) throw new Error("id wajib diisi.");
    const { id, ...rest } = body;
    const location = await updateLocation(id, rest);
    return NextResponse.json({ location });
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
    assertCan(user, "location:manage");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("id wajib diisi.");
    const result = await deleteLocation(id);
    return NextResponse.json({
      ok: true,
      soft: result.soft,
      message: result.soft
        ? "Lokasi masih dipakai tiket — dinonaktifkan."
        : "Lokasi dihapus.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
