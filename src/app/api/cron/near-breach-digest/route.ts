import { NextResponse } from "next/server";
import { listNearBreachTickets } from "@/data/tickets-store";
import {
  isNearBreachAuditWindow,
  nearBreachAuditLabel,
} from "@/lib/near-breach";
import { notifyNearBreachDigest } from "@/lib/notifications/service";
import { NEAR_BREACH_AUDIT_HOUR } from "@/config/sla-pause.config";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const alt = request.headers.get("x-cron-secret");
  return alt === secret;
}

/**
 * Scheduled near-breach digest (typically 16:00 WIB).
 * Auth: Authorization: Bearer $CRON_SECRET  or  x-cron-secret: $CRON_SECRET
 * Query: ?force=1 to resend same day; ?ignoreWindow=1 to send outside 16:00.
 */
export async function POST(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.CRON_SECRET?.trim()) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const ignoreWindow = url.searchParams.get("ignoreWindow") === "1";
    const asOf = new Date();

    if (!ignoreWindow && !isNearBreachAuditWindow(asOf)) {
      return NextResponse.json({
        skipped: true,
        reason: "outside_audit_window",
        auditLabel: nearBreachAuditLabel(),
        auditHour: NEAR_BREACH_AUDIT_HOUR,
        asOf: asOf.toISOString(),
      });
    }

    const tickets = await listNearBreachTickets(asOf);
    const result = await notifyNearBreachDigest({
      rows: tickets.map((t) => ({
        ticketNumber: t.ticketNumber,
        merchantId: t.merchantId,
        location: t.location,
        category: t.category,
        vendorName: t.vendorName,
        slaStatus: t.slaStatus,
        elapsedLabel: t.elapsedLabel,
        remainingLabel: t.remainingLabel,
        elapsedRatio: t.elapsedRatio,
        technicianName: t.technicianName,
      })),
      asOf,
      force,
    });

    return NextResponse.json({
      ...result,
      auditLabel: nearBreachAuditLabel(),
      asOf: asOf.toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
