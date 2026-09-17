import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  acknowledgeHandover,
  createHandover,
  escalateTicketToLiaison,
  listEscalationInbox,
  listHandovers,
  listLiaisonUsers,
  listLoShifts,
  resolveCurrentLoShiftType,
  setLoShiftDuty,
  upsertLoShift,
  LO_SHIFT_LABELS,
  LO_SHIFT_TYPES,
} from "@/data/liaison-store";
import { isLoShiftType, type LoShiftType } from "@/config/liaison.config";
import { dateInJakarta } from "@/config/wfm.config";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, canAny, type AuthUser } from "@/lib/rbac";
import type { NocUser, ShiftDutyStatus } from "@/lib/ticketing";

async function requireUser(): Promise<{ auth: AuthUser; noc: NocUser }> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  const auth = sessionToAuthUser(session);
  return {
    auth,
    noc: {
      id: stored.id,
      name: stored.name,
      email: stored.email,
      phone: stored.phone ?? undefined,
      role: stored.role,
      isActive: stored.isActive,
    },
  };
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
    const { auth } = await requireUser();
    if (!canAny(auth, ["liaison:read", "liaison:escalate"])) {
      assertCan(auth, "liaison:read");
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? dateInJakarta();

    const [shifts, handovers, inbox, users] = await Promise.all([
      listLoShifts({ date }),
      listHandovers(40),
      listEscalationInbox(),
      listLiaisonUsers(),
    ]);

    return NextResponse.json({
      date,
      currentLoShift: resolveCurrentLoShiftType(),
      shiftTypes: LO_SHIFT_TYPES.map((t) => ({
        id: t,
        label: LO_SHIFT_LABELS[t],
      })),
      shifts,
      handovers,
      inbox,
      users,
      me: { id: auth.id, name: auth.name, role: auth.role },
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
    const { auth, noc } = await requireUser();
    const body = (await request.json()) as {
      action?: string;
      userId?: string;
      shiftDate?: string;
      shiftType?: string;
      status?: ShiftDutyStatus;
      notes?: string;
      shiftId?: string;
      summary?: string;
      toUserId?: string;
      openTickets?: string[];
      fromShiftType?: string;
      handoverId?: string;
      ticketId?: string;
      note?: string;
    };

    if (body.action === "upsert_shift") {
      assertCan(auth, "liaison:handover");
      if (!body.userId || !body.shiftType || !isLoShiftType(body.shiftType)) {
        throw new Error("userId dan shiftType (DAY_DOG|NIGHT_DOG) wajib.");
      }
      const shift = await upsertLoShift({
        userId: body.userId,
        shiftDate: body.shiftDate ?? dateInJakarta(),
        shiftType: body.shiftType,
        status: body.status,
        notes: body.notes,
      });
      return NextResponse.json({ shift });
    }

    if (body.action === "set_duty") {
      assertCan(auth, "liaison:handover");
      if (!body.shiftId || !body.status) {
        throw new Error("shiftId dan status wajib.");
      }
      const shift = await setLoShiftDuty(body.shiftId, body.status);
      return NextResponse.json({ shift });
    }

    if (body.action === "handover_create") {
      assertCan(auth, "liaison:handover");
      const handover = await createHandover({
        actor: noc,
        shiftDate: body.shiftDate,
        fromShiftType: body.fromShiftType as LoShiftType | undefined,
        toUserId: body.toUserId,
        summary: body.summary ?? "",
        openTickets: body.openTickets,
      });
      return NextResponse.json({ handover });
    }

    if (body.action === "handover_ack") {
      assertCan(auth, "liaison:handover");
      if (!body.handoverId) throw new Error("handoverId wajib.");
      const handover = await acknowledgeHandover(body.handoverId, noc);
      return NextResponse.json({ handover });
    }

    if (body.action === "escalate") {
      assertCan(auth, "liaison:escalate");
      if (!body.ticketId) throw new Error("ticketId wajib.");
      const ticket = await escalateTicketToLiaison(body.ticketId, {
        actor: noc,
        note: body.note,
      });
      return NextResponse.json({ ticket });
    }

    throw new Error(
      "action: upsert_shift | set_duty | handover_create | handover_ack | escalate"
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
