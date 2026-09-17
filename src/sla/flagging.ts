import type { TicketSlaInput, SlaEvaluation, SlaEvaluationStatus } from "./types";
import {
  calculateResolutionDuration,
  computeSlaDeadline,
  getResolutionLimitMinutes,
} from "./duration";

/**
 * Auto-flagging against the SLA limit for the ticket's ITSM type:
 * - elapsed < 80% → ON_TRACK / ACHIEVED
 * - elapsed ≥ 80% → WARNING
 * - elapsed ≥ 100% → BREACHED
 */
export function evaluateSlaStatus(
  ticket: TicketSlaInput,
  asOf: Date = new Date()
): SlaEvaluation {
  const { location, category, openedAt, closedAt, itsmType = "INCIDENT" } = ticket;

  if (!location || !category) {
    throw new Error("Ticket location and category are required for SLA evaluation");
  }

  const endAt = closedAt ?? asOf;
  const duration = calculateResolutionDuration(openedAt, endAt);
  const limit = getResolutionLimitMinutes(location, category, openedAt, itsmType);
  const deadlineAt = computeSlaDeadline(location, category, openedAt, itsmType);
  const elapsedRatio = duration.durationMs / limit.limitMs;
  const remainingMs = limit.limitMs - duration.durationMs;
  const isClosed = closedAt != null;

  let status: SlaEvaluationStatus;

  if (duration.durationMs >= limit.limitMs) {
    status = "BREACHED";
  } else if (isClosed) {
    status = "ACHIEVED";
  } else if (duration.durationMs >= limit.warningAtMs) {
    status = "WARNING";
  } else {
    status = "ON_TRACK";
  }

  return {
    ...limit,
    status,
    duration,
    elapsedRatio,
    remainingMs,
    deadlineAt,
    evaluatedAt: asOf,
  };
}

export function isApproachingBreach(ticket: TicketSlaInput, asOf?: Date): boolean {
  const result = evaluateSlaStatus(ticket, asOf);
  return result.status === "WARNING" || result.status === "BREACHED";
}
