import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getRoCapacityBoard,
  suggestDispatch,
} from "@/data/dispatch-store";
import { DISPATCH_CONFIG } from "@/config/dispatch.config";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan } from "@/lib/rbac";

async function requireUser() {
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
  if (message === "Ticket not found") return 404;
  return 400;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    assertCan(user, "ticket:read");
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId") ?? undefined;
    const regionalOffice = searchParams.get("regionalOffice") ?? undefined;
    const boardOnly = searchParams.get("board") === "1";

    if (boardOnly) {
      const board = await getRoCapacityBoard();
      return NextResponse.json({
        targetRatio: DISPATCH_CONFIG.targetTechMerchantRatio,
        board,
      });
    }

    const suggest = await suggestDispatch({
      ticketId,
      regionalOffice: regionalOffice || undefined,
      limit: Number(searchParams.get("limit") || 5) || 5,
    });
    const board = await getRoCapacityBoard();
    return NextResponse.json({
      targetRatio: DISPATCH_CONFIG.targetTechMerchantRatio,
      suggest,
      board,
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
    assertCan(user, "ticket:read");
    const body = (await request.json()) as {
      ticketId?: string;
      regionalOffice?: string;
      locationCode?: string;
      limit?: number;
    };
    const suggest = await suggestDispatch(body);
    return NextResponse.json({
      targetRatio: DISPATCH_CONFIG.targetTechMerchantRatio,
      suggest,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
