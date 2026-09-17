/**
 * Monitoring → Incident auto-create rules (predictive tahap 1).
 * Adjust severity / category mapping when BRI monitoring contract changes.
 */

import type { TicketCategory } from "@/config/sla.config";

export const MONITORING_INGEST_CONFIG = {
  /** Severities that create an INCIDENT ticket. Others are logged as IGNORED. */
  createTicketSeverities: ["CRITICAL", "MAJOR"] as const,
  /** Map monitor severity → ticket category (VIP peak rules apply). */
  severityToCategory: {
    CRITICAL: "VIP",
    MAJOR: "VIP",
    MINOR: "NON_VIP",
    WARNING: "NON_VIP",
    INFO: "NON_VIP",
  } satisfies Record<string, TicketCategory>,
  defaultLocation: "JKT_PUSAT",
  defaultVendorName: "Vendor 1",
  defaultMerchantPrefix: "MON-",
  /** Dedup bucket: same serial+alert within this window reuses externalTicketId day key. */
  dedupeDayBucket: true,
} as const;

export type MonitoringSeverity =
  | keyof typeof MONITORING_INGEST_CONFIG.createTicketSeverities[number]
  | "MINOR"
  | "WARNING"
  | "INFO"
  | string;

export const INGEST_OUTCOMES = [
  "ACCEPTED",
  "TICKET_CREATED",
  "DUPLICATE",
  "IGNORED",
  "ERROR",
] as const;

export type IngestOutcome = (typeof INGEST_OUTCOMES)[number];

export function shouldCreateTicketFromSeverity(severity: string): boolean {
  const key = severity.trim().toUpperCase();
  return (MONITORING_INGEST_CONFIG.createTicketSeverities as readonly string[]).includes(
    key
  );
}

export function categoryForSeverity(severity: string): TicketCategory {
  const key = severity.trim().toUpperCase();
  const map = MONITORING_INGEST_CONFIG.severityToCategory as Record<
    string,
    TicketCategory
  >;
  return map[key] ?? "NON_VIP";
}
