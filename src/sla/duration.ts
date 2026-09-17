import {
  PEAK_HOURS,
  RESOLUTION_SLA_MINUTES,
  SLA_WARNING_THRESHOLD,
  type TicketCategory,
  type TicketLocation,
} from "../config/sla.config";
import { ITSM_SLA_MINUTES, type ItsmType } from "../config/itsm.config";
import { getCategorySlaProfile } from "../data/ticket-categories-store";
import { getLocationSlaZone } from "../data/locations-store";
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
 * Hitungan durasi penyelesaian: Tiket Masuk → Tiket Selesai (atau asOf jika masih open).
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

export function isPeakHours(date: Date): boolean {
  const minutes = getLocalMinutesOfDay(date);
  return minutes >= PEAK_HOURS.startMinutes && minutes < PEAK_HOURS.endMinutes;
}

/**
 * Resolve SLA resolution limit for ITSM type + location/category.
 * INCIDENT → location + VIP peak rules (2h Dalam Kota VIP peak).
 * REQUEST / PROBLEM / CHANGE → ITSM_SLA_MINUTES policy.
 */
export function getResolutionLimitMinutes(
  location: TicketLocation,
  category: TicketCategory,
  openedAt: Date,
  itsmType: ItsmType = "INCIDENT"
): SlaLimitResult {
  assertValidDate(openedAt, "openedAt");

  if (itsmType !== "INCIDENT") {
    const policy = ITSM_SLA_MINUTES[itsmType];
    const profile = getCategorySlaProfile(category);
    const limitMinutes =
      profile === "VIP" && policy.vipMinutes != null
        ? policy.vipMinutes
        : policy.defaultMinutes;
    const warningAtMinutes = limitMinutes * SLA_WARNING_THRESHOLD;
    return {
      limitMinutes,
      limitMs: limitMinutes * 60 * 1000,
      isPeakHours: false,
      warningAtMinutes,
      warningAtMs: warningAtMinutes * 60 * 1000,
      itsmType,
    };
  }

  const profile = getCategorySlaProfile(category);
  const zone = getLocationSlaZone(location);
  const rules = RESOLUTION_SLA_MINUTES[zone]?.[profile];
  if (!rules) {
    throw new Error(`No SLA rule configured for zone ${zone} / profile ${profile}`);
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
    itsmType: "INCIDENT",
  };
}

export function computeSlaDeadline(
  location: TicketLocation,
  category: TicketCategory,
  openedAt: Date,
  itsmType: ItsmType = "INCIDENT"
): Date {
  const { limitMs } = getResolutionLimitMinutes(
    location,
    category,
    openedAt,
    itsmType
  );
  return new Date(openedAt.getTime() + limitMs);
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date for ${field}`);
  }
}
