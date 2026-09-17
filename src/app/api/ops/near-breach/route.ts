import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listNearBreachTickets } from "@/data/tickets-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan } from "@/lib/rbac";
import {
  isNearBreachAuditWindow,
  nearBreachAuditLabel,
} from "@/lib/near-breach";
import { NEAR_BREACH_AUDIT_HOUR } from "@/config/sla-pause.config";

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

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "ticket:read");
    const asOf = new Date();
    const tickets = await listNearBreachTickets(asOf);
    return NextResponse.json({
      asOf: asOf.toISOString(),
      auditHour: NEAR_BREACH_AUDIT_HOUR,
      auditLabel: nearBreachAuditLabel(),
      auditWindowActive: isNearBreachAuditWindow(asOf),
      count: tickets.length,
      tickets,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Forbidden";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
