import type { TicketSlaInput, SlaEvaluation, SlaEvaluationStatus } from "./types";
import {
  calculateResolutionDuration,
  computeSlaDeadline,
  getResolutionLimitMinutes,
} from "./duration";

/**
 * 3. Auto-flagging:
 * - elapsed < 80% of limit → ON_TRACK (open) / ACHIEVED (closed on time)
 * - elapsed ≥ 80% and < 100% → WARNING
 * - elapsed ≥ 100% → BREACHED
 * Closed before deadline with no breach → ACHIEVED
 */
export function evaluateSlaStatus(
  ticket: TicketSlaInput,
  asOf: Date = new Date()
): SlaEvaluation {
  const { location, category, openedAt, closedAt } = ticket;

  if (!location || !category) {
    throw new Error("Ticket location and category are required for SLA evaluation");
  }

  const endAt = closedAt ?? asOf;
  const duration = calculateResolutionDuration(openedAt, endAt);
  const limit = getResolutionLimitMinutes(location, category, openedAt);
  const deadlineAt = computeSlaDeadline(location, category, openedAt);
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

/**
 * Convenience: true when an open ticket should surface on the ops wall as at-risk.
 */
export function isApproachingBreach(ticket: TicketSlaInput, asOf?: Date): boolean {
  const result = evaluateSlaStatus(ticket, asOf);
  return result.status === "WARNING" || result.status === "BREACHED";
}
