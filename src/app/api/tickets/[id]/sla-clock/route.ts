import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  approveSlaPause,
  pauseSlaClock,
  rejectSlaPause,
  resumeSlaClock,
} from "@/data/tickets-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, can, type AuthUser } from "@/lib/rbac";
import type { NocUser } from "@/lib/ticketing";

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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, noc } = await requireUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: "pause" | "resume" | "approve" | "reject";
      reasonCode?: string;
      reasonNote?: string;
      note?: string;
      pauseId?: string;
    };

    if (body.action === "approve" || body.action === "reject") {
      assertCan(auth, "ticket:sla_pause_approve");
      const ticket =
        body.action === "approve"
          ? await approveSlaPause(id, {
              actor: noc,
              pauseId: body.pauseId,
              note: body.note,
            })
          : await rejectSlaPause(id, {
              actor: noc,
              pauseId: body.pauseId,
              note: body.note,
            });
      return NextResponse.json({ ticket });
    }

    assertCan(auth, "ticket:sla_pause");

    if (body.action === "resume") {
      const ticket = await resumeSlaClock(id, {
        actor: noc,
        note: body.note,
      });
      return NextResponse.json({ ticket });
    }

    if (body.action === "pause") {
      if (!body.reasonCode) throw new Error("reasonCode wajib diisi.");
      const ticket = await pauseSlaClock(id, {
        reasonCode: body.reasonCode,
        reasonNote: body.reasonNote,
        actor: noc,
        autoApprove: can(auth, "ticket:sla_pause_approve"),
      });
      return NextResponse.json({ ticket });
    }

    throw new Error("action harus pause, resume, approve, atau reject.");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: statusFor(e) }
    );
  }
}
