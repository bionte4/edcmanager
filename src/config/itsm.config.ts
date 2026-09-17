/**
 * ITSM ticket classification & SLA policies (adjustable without code changes in UI).
 */

export type ItsmType = "INCIDENT" | "REQUEST" | "PROBLEM" | "CHANGE";

/** Optional operational subtype (CM = corrective maintenance on incidents). */
export type OperationalProcess =
  | "CM"
  | "PM"
  | "INSTALL"
  | "RELOCATE"
  | "INVESTIGATION"
  | "STANDARD_CHANGE"
  | "NORMAL_CHANGE"
  | "EMERGENCY_CHANGE";

export const ITSM_TYPE_LABELS: Record<ItsmType, string> = {
  INCIDENT: "Incident",
  REQUEST: "Service Request",
  PROBLEM: "Problem",
  CHANGE: "Change",
};

export const ITSM_TYPE_PREFIX: Record<ItsmType, string> = {
  INCIDENT: "INC",
  REQUEST: "REQ",
  PROBLEM: "PRB",
  CHANGE: "CHG",
};

export const PROCESS_LABELS: Record<OperationalProcess, string> = {
  CM: "Corrective Maintenance",
  PM: "Preventive Maintenance",
  INSTALL: "Install / Deploy",
  RELOCATE: "Relocate",
  INVESTIGATION: "Root-cause Investigation",
  STANDARD_CHANGE: "Standard Change",
  NORMAL_CHANGE: "Normal Change",
  EMERGENCY_CHANGE: "Emergency Change",
};

/**
 * Default process suggestions when creating a ticket of a given ITSM type.
 */
export const DEFAULT_PROCESS_BY_TYPE: Record<ItsmType, OperationalProcess> = {
  INCIDENT: "CM",
  REQUEST: "INSTALL",
  PROBLEM: "INVESTIGATION",
  CHANGE: "NORMAL_CHANGE",
};

/**
 * SLA limit minutes for non-incident ITSM types (business-clock approximation).
 * Incident continues to use location + VIP peak rules in sla.config.
 */
export const ITSM_SLA_MINUTES: Record<
  Exclude<ItsmType, "INCIDENT">,
  { defaultMinutes: number; vipMinutes?: number }
> = {
  /** Fulfillment window for service requests */
  REQUEST: { defaultMinutes: 3 * 24 * 60, vipMinutes: 24 * 60 },
  /** Investigation / known-error target */
  PROBLEM: { defaultMinutes: 7 * 24 * 60, vipMinutes: 5 * 24 * 60 },
  /** Planned change lead / implementation window */
  CHANGE: { defaultMinutes: 5 * 24 * 60, vipMinutes: 2 * 24 * 60 },
};
