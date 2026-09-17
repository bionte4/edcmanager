import {
  NOTIFICATION_DEFAULTS,
  isSmtpConfigured,
  type NotificationEventType,
} from "@/config/smtp.config";
import { addNotification } from "@/data/notifications-store";
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

  return addNotification({
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
  return addNotification({
    event: "TEST",
    channel: "EMAIL",
    status,
    toAddress: address,
    subject,
    body,
    error: result.error,
  });
}
