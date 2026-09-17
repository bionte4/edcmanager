import {
  NOTIFICATION_DEFAULTS,
  isSmtpConfigured,
  type NotificationEventType,
} from "@/config/smtp.config";
import { NEAR_BREACH_AUDIT_HOUR } from "@/config/sla-pause.config";
import { addNotification } from "@/data/notifications-store";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/smtp";
import type { ItsmType } from "@/config/itsm.config";

export interface NotifyTicketPayload {
  id: string;
  ticketNumber: string;
  itsmType: ItsmType;
  merchantId: string;
  description: string;
  slaStatus?: string;
  nocOwnerName?: string | null;
  nocOwnerEmail?: string | null;
  location?: string;
  category?: string;
}

export interface NearBreachDigestRow {
  ticketNumber: string;
  merchantId: string;
  location: string;
  category: string;
  vendorName: string;
  slaStatus: string;
  elapsedLabel: string;
  remainingLabel: string;
  elapsedRatio: number;
  technicianName?: string;
}

function buildBody(event: NotificationEventType, ticket: NotifyTicketPayload): string {
  const lines = [
    `Event: ${event}`,
    `Ticket: ${ticket.ticketNumber} (${ticket.itsmType})`,
    `Merchant: ${ticket.merchantId}`,
    ticket.location ? `Location: ${ticket.location}` : null,
    ticket.category ? `Priority: ${ticket.category}` : null,
    ticket.slaStatus ? `SLA: ${ticket.slaStatus}` : null,
    ticket.nocOwnerName ? `NOC Owner: ${ticket.nocOwnerName}` : null,
    "",
    "Description:",
    ticket.description,
    "",
    "— EDC Manager Notifications",
  ];
  return lines.filter(Boolean).join("\n");
}

async function dispatchEmail(input: {
  event: NotificationEventType;
  to: string;
  subject: string;
  ticket: NotifyTicketPayload;
}) {
  const body = buildBody(input.event, input.ticket);
  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    text: body,
  });

  const status =
    result.mode === "sent"
      ? "SENT"
      : result.mode === "simulated"
        ? "SIMULATED"
        : "FAILED";

  return await addNotification({
    event: input.event,
    channel: "EMAIL",
    status,
    toAddress: input.to,
    subject: input.subject,
    body,
    ticketId: input.ticket.id,
    ticketNumber: input.ticket.ticketNumber,
    error: result.error,
  });
}

export async function notifyTicketAssigned(ticket: NotifyTicketPayload) {
  const to =
    ticket.nocOwnerEmail?.trim() || NOTIFICATION_DEFAULTS.nocFallbackEmail;
  return dispatchEmail({
    event: "TICKET_ASSIGNED",
    to,
    subject: `[ASSIGNED] ${ticket.ticketNumber} · ${ticket.merchantId}`,
    ticket,
  });
}

export async function notifySlaEscalation(
  ticket: NotifyTicketPayload,
  level: "WARNING" | "BREACHED"
) {
  const event: NotificationEventType =
    level === "BREACHED" ? "SLA_BREACHED" : "SLA_WARNING";
  const to =
    level === "BREACHED"
      ? NOTIFICATION_DEFAULTS.supervisorEmail
      : ticket.nocOwnerEmail?.trim() || NOTIFICATION_DEFAULTS.supervisorEmail;

  return dispatchEmail({
    event,
    to,
    subject: `[SLA ${level}] ${ticket.ticketNumber} · ${ticket.merchantId}`,
    ticket: { ...ticket, slaStatus: level },
  });
}

/** Jakarta calendar day key YYYY-MM-DD for digest idempotency. */
export function jakartaDayKey(asOf: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
}

export async function hasNearBreachDigestForDay(
  dayKey: string
): Promise<boolean> {
  const marker = `near-breach-digest:${dayKey}`;
  const found = await prisma.notificationLog.findFirst({
    where: {
      event: "DIGEST",
      OR: [
        { subject: { contains: dayKey } },
        { body: { contains: marker } },
      ],
    },
    select: { id: true },
  });
  return !!found;
}

function buildNearBreachDigestBody(
  dayKey: string,
  rows: NearBreachDigestRow[]
): string {
  const marker = `near-breach-digest:${dayKey}`;
  const lines = [
    `EDC Manager — Near-breach audit ${String(NEAR_BREACH_AUDIT_HOUR).padStart(2, "0")}:00 WIB`,
    `Tanggal: ${dayKey}`,
    `Jumlah tiket WARNING/BREACHED (clock berjalan): ${rows.length}`,
    "",
    marker,
    "",
  ];
  if (rows.length === 0) {
    lines.push("Tidak ada tiket near-breach saat digest dikirim.");
  } else {
    for (const r of rows.slice(0, 40)) {
      lines.push(
        `- ${r.ticketNumber} | ${r.merchantId} | ${r.slaStatus} | ${r.elapsedLabel} | sisa ${r.remainingLabel} | ${(r.elapsedRatio * 100).toFixed(0)}% | ${r.vendorName}${r.technicianName ? ` | tech ${r.technicianName}` : ""}`
      );
    }
    if (rows.length > 40) {
      lines.push(`… dan ${rows.length - 40} tiket lainnya.`);
    }
  }
  lines.push("", "Buka /ops/near-breach untuk aksi clock-stop / realokasi.", "— EDC Manager");
  return lines.join("\n");
}

export async function notifyNearBreachDigest(input: {
  rows: NearBreachDigestRow[];
  asOf?: Date;
  force?: boolean;
  to?: string;
}) {
  const asOf = input.asOf ?? new Date();
  const dayKey = jakartaDayKey(asOf);
  if (!input.force && (await hasNearBreachDigestForDay(dayKey))) {
    return {
      skipped: true as const,
      reason: "already_sent",
      dayKey,
      count: input.rows.length,
    };
  }

  const recipients = Array.from(
    new Set(
      [
        input.to?.trim(),
        NOTIFICATION_DEFAULTS.supervisorEmail,
        NOTIFICATION_DEFAULTS.opsEmail,
        NOTIFICATION_DEFAULTS.nocFallbackEmail,
      ].filter((v): v is string => !!v && v.length > 0)
    )
  );

  const subject = `[NEAR-BREACH ${String(NEAR_BREACH_AUDIT_HOUR).padStart(2, "0")}:00] ${dayKey} · ${input.rows.length} tiket`;
  const body = buildNearBreachDigestBody(dayKey, input.rows);
  const notifications = [];

  for (const to of recipients) {
    const result = await sendEmail({ to, subject, text: body });
    const status =
      result.mode === "sent"
        ? "SENT"
        : result.mode === "simulated"
          ? "SIMULATED"
          : "FAILED";
    notifications.push(
      await addNotification({
        event: "DIGEST",
        channel: "EMAIL",
        status,
        toAddress: to,
        subject,
        body,
        error: result.error,
      })
    );
  }

  return {
    skipped: false as const,
    dayKey,
    count: input.rows.length,
    recipients,
    smtpConfigured: isSmtpConfigured(),
    notifications,
  };
}

export async function notifyTest(to?: string) {
  const address = to?.trim() || NOTIFICATION_DEFAULTS.opsEmail;
  const subject = `[TEST] EDC Manager SMTP (${isSmtpConfigured() ? "live" : "simulated"})`;
  const body = `SMTP test at ${new Date().toISOString()}\nConfigured: ${isSmtpConfigured()}`;
  const result = await sendEmail({ to: address, subject, text: body });
  const status =
    result.mode === "sent"
      ? "SENT"
      : result.mode === "simulated"
        ? "SIMULATED"
        : "FAILED";
  return await addNotification({
    event: "TEST",
    channel: "EMAIL",
    status,
    toAddress: address,
    subject,
    body,
    error: result.error,
  });
}
