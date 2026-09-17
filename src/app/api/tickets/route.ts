import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listOpsTickets } from "@/data/tickets-store";
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

/**
 * Authenticated ops UI ticket list (OpsTicket-shaped).
 * SLA/OLA enrichment (e.g. DEMO_AS_OF) stays optional at the client.
 */
export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "ticket:read");
    const tickets = await listOpsTickets();
    return NextResponse.json({ tickets });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: statusFor(e) }
    );
  }
}
