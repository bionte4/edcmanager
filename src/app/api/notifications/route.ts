import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listNotifications } from "@/data/notifications-store";
import { listNearBreachTickets } from "@/data/tickets-store";
import {
  notifyNearBreachDigest,
  notifySlaEscalation,
  notifyTest,
  notifyTicketAssigned,
  type NotifyTicketPayload,
} from "@/lib/notifications/service";
import { isSmtpConfigured } from "@/config/smtp.config";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

async function requireSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const session = await verifySessionToken(token);
  if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return session;
}

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({
      smtpConfigured: isSmtpConfigured(),
      notifications: await listNotifications(50),
    });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    return NextResponse.json(
      { error: err.message ?? "Error" },
      { status: err.status ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = (await request.json()) as {
      action?: "assign" | "sla" | "test" | "near_breach_digest";
      level?: "WARNING" | "BREACHED";
      to?: string;
      force?: boolean;
      ticket?: NotifyTicketPayload;
    };

    if (body.action === "test") {
      const record = await notifyTest(body.to);
      return NextResponse.json({
        notification: record,
        smtpConfigured: isSmtpConfigured(),
      });
    }

    if (body.action === "near_breach_digest") {
      const asOf = new Date();
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
        force: !!body.force,
        to: body.to,
      });
      return NextResponse.json({ ...result, smtpConfigured: isSmtpConfigured() });
    }

    if (!body.ticket?.ticketNumber) {
      return NextResponse.json(
        { error: "ticket payload required" },
        { status: 400 }
      );
    }

    if (body.action === "assign") {
      const record = await notifyTicketAssigned(body.ticket);
      return NextResponse.json({ notification: record });
    }

    if (body.action === "sla") {
      const level = body.level ?? "WARNING";
      const record = await notifySlaEscalation(body.ticket, level);
      return NextResponse.json({ notification: record });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    return NextResponse.json(
      { error: err.message ?? "Error" },
      { status: err.status ?? 500 }
    );
  }
}
