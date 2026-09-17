import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ShiftDutyStatus, ShiftType } from "@/lib/ticketing";
import {
  cancelSwapRequest,
  createSwapRequest,
  decideSwapRequest,
  listAttendance,
  listSwapRequests,
  listWfmShifts,
  setShiftDuty,
  wfmKpis,
} from "@/data/wfm-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, can, type AuthUser } from "@/lib/rbac";
import type { SwapRequestStatus } from "@/config/wfm.config";

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
    assertCan(user, "wfm:read");
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const shiftType = (searchParams.get("shiftType") as ShiftType | null) ?? undefined;
    const swapStatus = (searchParams.get("swapStatus") as SwapRequestStatus | null) ?? undefined;

    const [kpis, shifts, attendance, swaps] = await Promise.all([
      wfmKpis(),
      listWfmShifts({ date, from, to, shiftType }),
      listAttendance(80),
      listSwapRequests({
        status: swapStatus,
        userId: can(user, "wfm:approve") ? undefined : user.id,
      }),
    ]);

    return NextResponse.json({
      kpis,
      shifts,
      attendance,
      swaps,
      me: { id: user.id, name: user.name, role: user.role },
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
    const body = (await request.json()) as {
      action?: "swap_request" | "swap_decide" | "swap_cancel" | "set_duty";
      requesterShiftId?: string;
      targetShiftId?: string;
      reason?: string;
      id?: string;
      decision?: "APPROVED" | "REJECTED";
      decisionNote?: string;
      shiftId?: string;
      status?: ShiftDutyStatus;
    };

    if (body.action === "swap_request") {
      assertCan(user, "wfm:read");
      const swap = await createSwapRequest({
        requesterId: user.id,
        requesterName: user.name,
        requesterShiftId: body.requesterShiftId ?? "",
        targetShiftId: body.targetShiftId ?? "",
        reason: body.reason ?? "",
      });
      return NextResponse.json({ swap, kpis: await wfmKpis() }, { status: 201 });
    }

    if (body.action === "swap_decide") {
      assertCan(user, "wfm:approve");
      if (!body.id || !body.decision) {
        return NextResponse.json({ error: "id dan decision wajib." }, { status: 400 });
      }
      const swap = await decideSwapRequest({
        id: body.id,
        decision: body.decision,
        actorId: user.id,
        actorName: user.name,
        decisionNote: body.decisionNote,
      });
      return NextResponse.json({
        swap,
        shifts: await listWfmShifts(),
        kpis: await wfmKpis(),
      });
    }

    if (body.action === "swap_cancel") {
      assertCan(user, "wfm:read");
      if (!body.id) {
        return NextResponse.json({ error: "id wajib." }, { status: 400 });
      }
      const swap = await cancelSwapRequest(body.id, user.id);
      return NextResponse.json({ swap, kpis: await wfmKpis() });
    }

    if (body.action === "set_duty") {
      assertCan(user, "noc:manage_shift");
      if (!body.shiftId || !body.status) {
        return NextResponse.json({ error: "shiftId dan status wajib." }, { status: 400 });
      }
      const shift = await setShiftDuty(body.shiftId, body.status);
      return NextResponse.json({ shift, kpis: await wfmKpis() });
    }

    return NextResponse.json({ error: "action tidak dikenal." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal" },
      { status: statusFor(e) }
    );
  }
}
