import type { NotificationEventType } from "@/config/smtp.config";
import { prisma } from "@/lib/prisma";
import type {
  NotificationEvent,
  NotificationLog,
  NotificationStatus,
} from "@prisma/client";

export interface NotificationRecord {
  id: string;
  event: NotificationEventType;
  channel: "EMAIL";
  status: "QUEUED" | "SENT" | "FAILED" | "SIMULATED";
  toAddress: string;
  subject: string;
  body: string;
  ticketId?: string;
  ticketNumber?: string;
  error?: string;
  createdAt: string;
}

function extractTicketNumber(body: string): string | undefined {
  const m = /Ticket:\s*([^\s(]+)/.exec(body);
  return m?.[1]?.trim() || undefined;
}

function mapLog(row: NotificationLog): NotificationRecord {
  return {
    id: row.id,
    event: row.event as NotificationEventType,
    channel: "EMAIL",
    status: row.status as NotificationRecord["status"],
    toAddress: row.toAddress,
    subject: row.subject,
    body: row.body,
    ticketId: row.ticketId ?? undefined,
    ticketNumber: extractTicketNumber(row.body),
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotifications(
  limit = 50
): Promise<NotificationRecord[]> {
  const rows = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(mapLog);
}

export async function addNotification(
  record: Omit<NotificationRecord, "id" | "createdAt">
): Promise<NotificationRecord> {
  // ticketNumber is UI-only; recover via body "Ticket: …" when listing.
  const row = await prisma.notificationLog.create({
    data: {
      event: record.event as NotificationEvent,
      channel: "EMAIL",
      status: record.status as NotificationStatus,
      toAddress: record.toAddress,
      subject: record.subject,
      body: record.body,
      ticketId: record.ticketId ?? null,
      error: record.error ?? null,
    },
  });
  return {
    ...mapLog(row),
    ticketNumber: record.ticketNumber ?? extractTicketNumber(row.body),
  };
}
