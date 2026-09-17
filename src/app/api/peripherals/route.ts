import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createPeripheralSku,
  deletePeripheralSku,
  listPeripheralSkus,
  listStockAlerts,
  listStockBalances,
  listStockMutations,
  mutatePeripheralStock,
  peripheralKpis,
  resetPeripherals,
  updatePeripheralSku,
  type PeripheralSkuInput,
  type StockMutateInput,
} from "@/data/peripherals-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, type AuthUser } from "@/lib/rbac";
import type { PeripheralCategory } from "@/config/peripherals.config";

async function requireUser(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = findUserById(session.sub);
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
    const category = searchParams.get("category") as PeripheralCategory | null;
    const q = searchParams.get("q") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "1";
    const skuId = searchParams.get("skuId") || undefined;
    const view = searchParams.get("view");

    if (view === "alerts") {
      return NextResponse.json({
        alerts: listStockAlerts(),
        kpis: peripheralKpis(),
      });
    }

    return NextResponse.json({
      skus: listPeripheralSkus({
        category: category || undefined,
        activeOnly,
        q,
      }),
      balances: listStockBalances({ skuId }),
      mutations: listStockMutations(skuId),
      alerts: listStockAlerts(),
      kpis: peripheralKpis(),
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
    assertCan(user, "inventory:mutate");
    const body = (await request.json()) as (
      | (PeripheralSkuInput & { action?: "create" | "reset" | "mutate" })
      | (StockMutateInput & { action: "mutate" })
      | { action: "reset" }
    );

    if (body.action === "reset") {
      return NextResponse.json(resetPeripherals());
    }

    if (body.action === "mutate") {
      const result = mutatePeripheralStock({
        ...(body as StockMutateInput),
        mutatedBy: user.name,
      });
      return NextResponse.json({
        ...result,
        kpis: peripheralKpis(),
        alerts: listStockAlerts(),
      });
    }

    const sku = createPeripheralSku(body as PeripheralSkuInput);
    return NextResponse.json(
      { sku, kpis: peripheralKpis() },
      { status: 201 }
    );
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
    assertCan(user, "inventory:mutate");
    const body = (await request.json()) as Partial<PeripheralSkuInput> & {
      id?: string;
    };
    if (!body.id) throw new Error("id wajib diisi.");
    const { id, ...rest } = body;
    const sku = updatePeripheralSku(id, rest);
    return NextResponse.json({ sku, kpis: peripheralKpis() });
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
    assertCan(user, "inventory:mutate");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("id wajib diisi.");
    deletePeripheralSku(id);
    return NextResponse.json({ ok: true, kpis: peripheralKpis() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
