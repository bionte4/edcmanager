import {
  PEAK_HOURS,
  RESOLUTION_SLA_MINUTES,
  SLA_WARNING_THRESHOLD,
  type TicketCategory,
  type TicketLocation,
} from "../config/sla.config";
import type { ResolutionDuration, SlaLimitResult } from "./types";

/**
 * Format a millisecond duration as compact "Xh Ym" / "Ym" / "Xs".
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error("Duration must be a non-negative finite number");
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 && minutes < 5 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * 1. Hitungan durasi penyelesaian: Tiket Masuk → Tiket Selesai (atau asOf jika masih open).
 */
export function calculateResolutionDuration(
  openedAt: Date,
  endAt: Date
): ResolutionDuration {
  assertValidDate(openedAt, "openedAt");
  assertValidDate(endAt, "endAt");

  if (endAt.getTime() < openedAt.getTime()) {
    throw new Error("endAt (Tiket Selesai) cannot be earlier than openedAt (Tiket Masuk)");
  }

  const durationMs = endAt.getTime() - openedAt.getTime();
  return {
    durationMs,
    durationMinutes: durationMs / (60 * 1000),
    formatted: formatDuration(durationMs),
  };
}

/**
 * Local minutes-of-day in the configured SLA timezone (Asia/Jakarta).
 */
export function getLocalMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PEAK_HOURS.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/**
 * Peak window: 06.01 inclusive … 21.00 exclusive (ticket at exactly 21:00 is off-peak).
 */
export function isPeakHours(date: Date): boolean {
  const minutes = getLocalMinutesOfDay(date);
  return minutes >= PEAK_HOURS.startMinutes && minutes < PEAK_HOURS.endMinutes;
}

/**
 * Resolve Annex 3 resolution limit (minutes) for location + category + open time.
 * Dalam Kota VIP during peak hours → exactly 2 hours.
 */
export function getResolutionLimitMinutes(
  location: TicketLocation,
  category: TicketCategory,
  openedAt: Date
): SlaLimitResult {
  assertValidDate(openedAt, "openedAt");

  const rules = RESOLUTION_SLA_MINUTES[location]?.[category];
  if (!rules) {
    throw new Error(`No SLA rule configured for ${location} / ${category}`);
  }

  const peak = isPeakHours(openedAt);
  const limitMinutes = peak ? rules.peakMinutes : rules.offPeakMinutes;
  const warningAtMinutes = limitMinutes * SLA_WARNING_THRESHOLD;

  return {
    limitMinutes,
    limitMs: limitMinutes * 60 * 1000,
    isPeakHours: peak,
    warningAtMinutes,
    warningAtMs: warningAtMinutes * 60 * 1000,
  };
}

/**
 * Absolute SLA deadline timestamp from Tiket Masuk.
 */
export function computeSlaDeadline(
  location: TicketLocation,
  category: TicketCategory,
  openedAt: Date
): Date {
  const { limitMs } = getResolutionLimitMinutes(location, category, openedAt);
  return new Date(openedAt.getTime() + limitMs);
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date for ${field}`);
  }
}
