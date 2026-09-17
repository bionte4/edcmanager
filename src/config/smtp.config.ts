/**
 * SMTP / notification configuration — runtime values via connector-settings-store.
 */

import {
  getEmailSettings,
  getSmtpSettings,
  isSmtpConfigured as storeIsSmtpConfigured,
} from "@/data/connector-settings-store";

export type NotificationEventType =
  | "TICKET_ASSIGNED"
  | "SLA_WARNING"
  | "SLA_BREACHED"
  | "BUFFER_ALERT"
  | "DIGEST"
  | "TEST";

/** @deprecated Prefer getSmtpSettings() / getEmailSettings(). */
export const SMTP_CONFIG = {
  get host() {
    return getSmtpSettings().host;
  },
  get port() {
    return getSmtpSettings().port;
  },
  get secure() {
    return getSmtpSettings().secure;
  },
  get user() {
    return getSmtpSettings().user;
  },
  get pass() {
    return getSmtpSettings().pass;
  },
  get from() {
    return getEmailSettings().from;
  },
};

/** @deprecated Prefer getEmailSettings(). */
export const NOTIFICATION_DEFAULTS = {
  get supervisorEmail() {
    return getEmailSettings().supervisorEmail;
  },
  get opsEmail() {
    return getEmailSettings().opsEmail;
  },
  get nocFallbackEmail() {
    return getEmailSettings().nocFallbackEmail;
  },
};

export function isSmtpConfigured(): boolean {
  return storeIsSmtpConfigured();
}
