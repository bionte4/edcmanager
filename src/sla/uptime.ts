import {
  MINUTES_PER_DAY,
  UPTIME_TARGET_PERCENT,
} from "../config/sla.config";
import type { MonthlyUptimeInput, MonthlyUptimeReport } from "./types";

/**
 * 4. Monthly uptime % vs 99.9% target — used to detect penalty risk early.
 *
 * uptime% = ((totalMinutes − downtimeMinutes) / totalMinutes) × 100
 */
export function generateMonthlyUptimeReport(
  input: MonthlyUptimeInput
): MonthlyUptimeReport {
  const { year, month, downtimeMinutes, vendorId, vendorName } = input;

  validateMonth(year, month);

  if (!Number.isFinite(downtimeMinutes) || downtimeMinutes < 0) {
    throw new Error("downtimeMinutes must be a non-negative finite number");
  }

  const daysInPeriod =
    input.daysInPeriod ?? daysInCalendarMonth(year, month);

  if (!Number.isInteger(daysInPeriod) || daysInPeriod <= 0) {
    throw new Error("daysInPeriod must be a positive integer");
  }

  const totalMinutes = daysInPeriod * MINUTES_PER_DAY;

  if (downtimeMinutes > totalMinutes) {
    throw new Error(
      `downtimeMinutes (${downtimeMinutes}) cannot exceed period total (${totalMinutes})`
    );
  }

  const uptimeMinutes = totalMinutes - downtimeMinutes;
  const uptimePercent = roundTo((uptimeMinutes / totalMinutes) * 100, 4);
  const targetPercent = UPTIME_TARGET_PERCENT;
  const metTarget = uptimePercent >= targetPercent;
  const shortfallPercent = metTarget
    ? 0
    : roundTo(targetPercent - uptimePercent, 4);

  return {
    year,
    month,
    vendorId,
    vendorName,
    totalMinutes,
    downtimeMinutes,
    uptimeMinutes,
    uptimePercent,
    targetPercent,
    metTarget,
    shortfallPercent,
    riskOfPenalty: !metTarget,
  };
}

/**
 * Derive monthly downtime from resolved tickets' outage windows.
 * Each ticket contributes min(closed, periodEnd) − max(opened, periodStart) while open/impacting.
 */
export function sumDowntimeMinutes(
  tickets: Array<{ openedAt: Date; closedAt: Date | null }>,
  periodStart: Date,
  periodEnd: Date
): number {
  if (periodEnd.getTime() <= periodStart.getTime()) {
    throw new Error("periodEnd must be after periodStart");
  }

  let totalMs = 0;

  for (const ticket of tickets) {
    const start = Math.max(ticket.openedAt.getTime(), periodStart.getTime());
    const end = Math.min(
      (ticket.closedAt ?? periodEnd).getTime(),
      periodEnd.getTime()
    );
    if (end > start) {
      totalMs += end - start;
    }
  }

  return totalMs / (60 * 1000);
}

export function buildMonthlyUptimeFromTickets(
  year: number,
  month: number,
  tickets: Array<{ openedAt: Date; closedAt: Date | null }>,
  meta?: Pick<MonthlyUptimeInput, "vendorId" | "vendorName">
): MonthlyUptimeReport {
  validateMonth(year, month);
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const downtimeMinutes = sumDowntimeMinutes(tickets, periodStart, periodEnd);

  return generateMonthlyUptimeReport({
    year,
    month,
    downtimeMinutes,
    ...meta,
  });
}

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validateMonth(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error("year must be a valid integer >= 2000");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month must be an integer from 1 to 12");
  }
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
