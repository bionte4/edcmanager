import { getCategoryLabel, getCategorySlaProfile } from "../data/ticket-categories-store";

export {
  PEAK_HOURS,
  RESOLUTION_SLA_MINUTES,
  SLA_WARNING_THRESHOLD,
  UPTIME_TARGET_PERCENT,
} from "../config/sla.config";

export type {
  TicketLocation,
  TicketCategory,
  SlaProfile,
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

export { getCategoryLabel, getCategorySlaProfile };