import type { TicketSlaInput, SlaEvaluation, SlaEvaluationStatus } from "./types";
import {
  calculateResolutionDuration,
  formatDuration,
  getResolutionLimitMinutes,
} from "./duration";
import { isClockStopped, totalPausedMs } from "./pause";

/**
 * Auto-flagging against the SLA limit (pause-aware):
 * - effective elapsed < 80% → ON_TRACK / ACHIEVED
 * - effective elapsed ≥ 80% → WARNING
 * - effective elapsed ≥ 100% → BREACHED
 *
 * Clock-stop intervals are excluded from elapsed; deadline extends by pausedMs.
 */
export function evaluateSlaStatus(
  ticket: TicketSlaInput,
  asOf: Date = new Date()
): SlaEvaluation {
  const { location, category, openedAt, closedAt, itsmType = "INCIDENT" } =
    ticket;

  if (!location || !category) {
    throw new Error("Ticket location and category are required for SLA evaluation");
  }

  const endAt = closedAt ?? asOf;
  const wall = calculateResolutionDuration(openedAt, endAt);
  const intervals = ticket.pauseIntervals ?? [];
  const pausedMs =
    ticket.pausedMs ??
    (intervals.length > 0 ? totalPausedMs(intervals, endAt) : 0);
  const clockStopped = intervals.length > 0 ? isClockStopped(intervals) : false;

  const effectiveMs = Math.max(0, wall.durationMs - pausedMs);
  const duration = {
    durationMs: effectiveMs,
    durationMinutes: effectiveMs / (60 * 1000),
    formatted: formatDuration(effectiveMs),
  };

  const limit = getResolutionLimitMinutes(
    location,
    category,
    openedAt,
    itsmType
  );
  const deadlineAt = new Date(openedAt.getTime() + limit.limitMs + pausedMs);
  const elapsedRatio = effectiveMs / limit.limitMs;
  const remainingMs = limit.limitMs - effectiveMs;
  const isClosed = closedAt != null;

  let status: SlaEvaluationStatus;

  if (effectiveMs >= limit.limitMs) {
    status = "BREACHED";
  } else if (isClosed) {
    status = "ACHIEVED";
  } else if (effectiveMs >= limit.warningAtMs) {
    status = "WARNING";
  } else {
    status = "ON_TRACK";
  }

  return {
    ...limit,
    status,
    duration,
    effectiveDurationMs: effectiveMs,
    wallDurationMs: wall.durationMs,
    pausedMs,
    clockStopped,
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
