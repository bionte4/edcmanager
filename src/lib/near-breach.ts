import { getLocalMinutesOfDay } from "@/sla/duration";
import {
  NEAR_BREACH_AUDIT_HOUR,
  NEAR_BREACH_AUDIT_TIMEZONE,
} from "@/config/sla-pause.config";
import { PEAK_HOURS } from "@/config/sla.config";

/** True when local time (Jakarta) is at/after the daily near-breach audit hour. */
export function isNearBreachAuditWindow(asOf: Date = new Date()): boolean {
  const prevTz = PEAK_HOURS.timeZone;
  // getLocalMinutesOfDay uses PEAK_HOURS.timeZone — same Asia/Jakarta
  void prevTz;
  void NEAR_BREACH_AUDIT_TIMEZONE;
  const minutes = getLocalMinutesOfDay(asOf);
  return minutes >= NEAR_BREACH_AUDIT_HOUR * 60;
}

export function nearBreachAuditLabel(): string {
  return `Audit harian ${String(NEAR_BREACH_AUDIT_HOUR).padStart(2, "0")}:00 WIB`;
}
