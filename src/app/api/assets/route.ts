import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EdcMutationType, EdcUnitStatus } from "@/config/assets.config";
import {
  assetKpis,
  createAsset,
  deleteAsset,
  findAssetById,
  listAssets,
  mutateAsset,
  updateAsset,
} from "@/data/assets-store";
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
    assertCan(user, "inventory:read");

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const asset = await findAssetById(id);
      if (!asset) {
        return NextResponse.json({ error: "Asset tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ asset });
    }

    let assets = await listAssets();
    const status = searchParams.get("status");
    const ro = searchParams.get("ro");
    const vendor = searchParams.get("vendor");
    const q = searchParams.get("q")?.trim().toLowerCase();

    if (status) assets = assets.filter((a) => a.status === status);
    if (ro) assets = assets.filter((a) => a.regionalOffice === ro);
    if (vendor) assets = assets.filter((a) => a.vendorName === vendor);
    if (q) {
      assets = assets.filter(
        (a) =>
          a.serialNumber.toLowerCase().includes(q) ||
          (a.merchantId ?? "").toLowerCase().includes(q) ||
          a.brand.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ assets, kpis: await assetKpis() });
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
    assertCan(user, "inventory:mutate");
    const body = (await request.json()) as {
      action?: "create" | "mutate";
      id?: string;
      serialNumber?: string;
      brand?: string;
      regionalOffice?: string;
      status?: EdcUnitStatus;
      merchantId?: string | null;
      vendorName?: string;
      notes?: string | null;
      mutationType?: EdcMutationType;
      toStatus?: EdcUnitStatus;
      toRegionalOffice?: string;
    };

    if (body.action === "mutate") {
      if (!body.id || !body.mutationType) {
        return NextResponse.json(
          { error: "id dan mutationType wajib." },
          { status: 400 }
        );
      }
      const asset = await mutateAsset({
        id: body.id,
        mutationType: body.mutationType,
        toStatus: body.toStatus,
        toRegionalOffice: body.toRegionalOffice,
        merchantId: body.merchantId,
        notes: body.notes ?? undefined,
        actorName: user.name,
      });
      return NextResponse.json({ asset, kpis: await assetKpis() });
    }

    const asset = await createAsset({
      serialNumber: body.serialNumber ?? "",
      brand: body.brand ?? "",
      regionalOffice: body.regionalOffice ?? "",
      status: body.status,
      merchantId: body.merchantId,
      vendorName: body.vendorName ?? "",
      notes: body.notes,
      actorName: user.name,
    });
    return NextResponse.json({ asset, kpis: await assetKpis() }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan" },
      { status: statusFor(e) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "inventory:mutate");
    const body = (await request.json()) as {
      id?: string;
      serialNumber?: string;
      brand?: string;
      regionalOffice?: string;
      vendorName?: string;
      notes?: string | null;
      merchantId?: string | null;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    const asset = await updateAsset(body.id, {
      serialNumber: body.serialNumber,
      brand: body.brand,
      regionalOffice: body.regionalOffice,
      vendorName: body.vendorName,
      notes: body.notes,
      merchantId: body.merchantId,
    });
    return NextResponse.json({ asset, kpis: await assetKpis() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal update" },
      { status: statusFor(e) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "inventory:mutate");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    const asset = await deleteAsset(id);
    return NextResponse.json({ asset, kpis: await assetKpis() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal hapus" },
      { status: statusFor(e) }
    );
  }
}
