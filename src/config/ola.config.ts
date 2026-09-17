/**
 * Operational Level Agreement (OLA) — internal team clocks, separate from contractual SLA.
 * Adjust defaults here; runtime CRUD overrides live in ola-store (later Prisma).
 */

import type { ItsmType, OperationalProcess } from "@/config/itsm.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";

/** Internal handoff stages measured by OLA (not customer-facing SLA). */
export type OlaStage = "ACKNOWLEDGE" | "DISPATCH";

export const OLA_STAGE_LABELS: Record<OlaStage, string> = {
  ACKNOWLEDGE: "Acknowledge (NOC)",
  DISPATCH: "Dispatch (Vendor)",
};

/** Same 80% warning rule as SLA — keep adjustable. */
export const OLA_WARNING_THRESHOLD = 0.8;

export type OlaMatchAny = "*";

export interface OlaPolicySeed {
  id: string;
  name: string;
  stage: OlaStage;
  /** Minutes from stage start clock to deadline. */
  limitMinutes: number;
  warningThreshold?: number;
  itsmType?: ItsmType | OlaMatchAny;
  location?: TicketLocation | OlaMatchAny;
  category?: TicketCategory | OlaMatchAny;
  process?: OperationalProcess | OlaMatchAny;
  isActive?: boolean;
  priority?: number;
}

/**
 * Seed policies: more specific rows win via specificity + priority.
 * ACK clock: openedAt → acknowledgedAt
 * DISPATCH clock: acknowledgedAt (fallback openedAt) → dispatchedAt
 */
export const DEFAULT_OLA_POLICIES: readonly OlaPolicySeed[] = [
  {
    id: "ola-ack-inc-vip-dk",
    name: "Ack · Incident VIP Dalam Kota",
    stage: "ACKNOWLEDGE",
    limitMinutes: 15,
    itsmType: "INCIDENT",
    location: "DALAM_KOTA",
    category: "VIP",
    priority: 100,
  },
  {
    id: "ola-ack-inc-vip",
    name: "Ack · Incident VIP",
    stage: "ACKNOWLEDGE",
    limitMinutes: 20,
    itsmType: "INCIDENT",
    category: "VIP",
    priority: 80,
  },
  {
    id: "ola-ack-inc",
    name: "Ack · Incident",
    stage: "ACKNOWLEDGE",
    limitMinutes: 30,
    itsmType: "INCIDENT",
    priority: 50,
  },
  {
    id: "ola-ack-default",
    name: "Ack · Default",
    stage: "ACKNOWLEDGE",
    limitMinutes: 60,
    priority: 10,
  },
  {
    id: "ola-disp-inc-vip-dk",
    name: "Dispatch · Incident VIP Dalam Kota",
    stage: "DISPATCH",
    limitMinutes: 30,
    itsmType: "INCIDENT",
    location: "DALAM_KOTA",
    category: "VIP",
    priority: 100,
  },
  {
    id: "ola-disp-inc-vip",
    name: "Dispatch · Incident VIP",
    stage: "DISPATCH",
    limitMinutes: 45,
    itsmType: "INCIDENT",
    category: "VIP",
    priority: 80,
  },
  {
    id: "ola-disp-inc",
    name: "Dispatch · Incident",
    stage: "DISPATCH",
    limitMinutes: 60,
    itsmType: "INCIDENT",
    priority: 50,
  },
  {
    id: "ola-disp-default",
    name: "Dispatch · Default",
    stage: "DISPATCH",
    limitMinutes: 120,
    priority: 10,
  },
] as const;
