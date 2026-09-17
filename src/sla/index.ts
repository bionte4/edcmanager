/**
 * SLA Calculation Engine — EDC contract rules
 *
 * Public API for ticket duration, peak-hour VIP limits, auto-flagging, and uptime reports.
 */

export {
  PEAK_HOURS,
  RESOLUTION_SLA_MINUTES,
  SLA_WARNING_THRESHOLD,
  UPTIME_TARGET_PERCENT,
} from "../config/sla.config";

export type {
  TicketLocation,
  TicketCategory,
} from "../config/sla.config";

export type {
  TicketSlaInput,
  ResolutionDuration,
  SlaLimitResult,
  SlaEvaluation,
  SlaEvaluationStatus,
  MonthlyUptimeInput,
  MonthlyUptimeReport,
} from "./types";

export {
  calculateResolutionDuration,
  formatDuration,
  isPeakHours,
  getLocalMinutesOfDay,
  getResolutionLimitMinutes,
  computeSlaDeadline,
} from "./duration";

export { evaluateSlaStatus, isApproachingBreach } from "./flagging";

export {
  generateMonthlyUptimeReport,
  sumDowntimeMinutes,
  buildMonthlyUptimeFromTickets,
} from "./uptime";
