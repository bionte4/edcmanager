/**
 * SMTP / notification configuration — override via environment variables.
 */

export type NotificationEventType =
  | "TICKET_ASSIGNED"
  | "SLA_WARNING"
  | "SLA_BREACHED"
  | "BUFFER_ALERT"
  | "DIGEST"
  | "TEST";

export const SMTP_CONFIG = {
  host: process.env.SMTP_HOST ?? "",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER ?? "",
  pass: process.env.SMTP_PASS ?? "",
  from: process.env.SMTP_FROM ?? "EDC Manager <noreply@edc.local>",
} as const;

/** Default recipients when ticket has no owner email (demo). */
export const NOTIFICATION_DEFAULTS = {
  supervisorEmail: process.env.NOTIFY_SUPERVISOR_EMAIL ?? "dewi.supervisor@edc.local",
  opsEmail: process.env.NOTIFY_OPS_EMAIL ?? "rudi.ops@edc.local",
  nocFallbackEmail: process.env.NOTIFY_NOC_EMAIL ?? "andi.noc@edc.local",
} as const;

export function isSmtpConfigured(): boolean {
  return Boolean(SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass);
}
