import type { TicketCategory, TicketLocation } from "../config/sla.config";
import type { ItsmType } from "../config/itsm.config";

/** Runtime / closed-ticket SLA evaluation outcome. */
export type SlaEvaluationStatus =
  | "ON_TRACK"
  | "WARNING"
  | "BREACHED"
  | "ACHIEVED";

export interface TicketSlaInput {
  location: TicketLocation;
  category: TicketCategory;
  /** ITSM type — defaults to INCIDENT (location/VIP peak rules) */
  itsmType?: ItsmType;
  /** Tiket Masuk */
  openedAt: Date;
  /** Tiket Selesai — omit / null while still open */
  closedAt?: Date | null;
}

export interface ResolutionDuration {
  /** Elapsed milliseconds from openedAt → end (closedAt or asOf) */
  durationMs: number;
  durationMinutes: number;
  /** Human-readable e.g. "1h 36m" */
  formatted: string;
}

export interface SlaLimitResult {
  limitMinutes: number;
  limitMs: number;
  isPeakHours: boolean;
  warningAtMinutes: number;
  warningAtMs: number;
  itsmType: ItsmType;
}

export interface SlaEvaluation extends SlaLimitResult {
  status: SlaEvaluationStatus;
  duration: ResolutionDuration;
  /** 0–1+ fraction of SLA consumed */
  elapsedRatio: number;
  /** Milliseconds remaining until breach (negative if already breached) */
  remainingMs: number;
  deadlineAt: Date;
  evaluatedAt: Date;
}

export interface MonthlyUptimeInput {
  year: number;
  month: number; // 1–12
  /** Total downtime minutes in the month (all merchants / scope for the report) */
  downtimeMinutes: number;
  /** Optional override; defaults to calendar days in that month */
  daysInPeriod?: number;
  vendorId?: string;
  vendorName?: string;
}

export interface MonthlyUptimeReport {
  year: number;
  month: number;
  vendorId?: string;
  vendorName?: string;
  totalMinutes: number;
  downtimeMinutes: number;
  uptimeMinutes: number;
  uptimePercent: number;
  targetPercent: number;
  metTarget: boolean;
  shortfallPercent: number;
  riskOfPenalty: boolean;
}
