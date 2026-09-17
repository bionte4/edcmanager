import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listIngestEvents } from "@/data/monitoring-ingest-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan } from "@/lib/rbac";
import { MONITORING_INGEST_CONFIG } from "@/config/monitoring-ingest.config";

async function requireAdmin() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  const auth = sessionToAuthUser(session);
  assertCan(auth, "integration:read");
  return auth;
}

export async function GET() {
  try {
    await requireAdmin();
    const events = await listIngestEvents(50);
    return NextResponse.json({
      config: {
        createTicketSeverities: MONITORING_INGEST_CONFIG.createTicketSeverities,
        severityToCategory: MONITORING_INGEST_CONFIG.severityToCategory,
        defaultLocation: MONITORING_INGEST_CONFIG.defaultLocation,
      },
      events,
      count: events.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Forbidden";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
