/**
 * SLA clock-stop (pause) reasons + near-breach audit window.
 * Adjust when BRI coordination protocol changes — do not hardcode in UI.
 */

/** Local hour (Asia/Jakarta) when ops must audit near-breach tickets. */
export const NEAR_BREACH_AUDIT_HOUR = 16;

export const NEAR_BREACH_AUDIT_TIMEZONE = "Asia/Jakarta";

/** Same 80% rule as SLA warning — near-breach queue includes WARNING+. */
export { SLA_WARNING_THRESHOLD as NEAR_BREACH_ELAPSED_RATIO } from "@/config/sla.config";

export const SLA_PAUSE_REASON_CODES = [
  "MERCHANT_ACCESS",
  "POWER_CONSTRAINT",
  "FORCE_MAJEURE",
  "BRI_HOLD",
  "NETWORK_MASS_OUTAGE",
  "OTHER",
] as const;

export type SlaPauseReasonCode = (typeof SLA_PAUSE_REASON_CODES)[number];

export const SLA_PAUSE_REASON_LABELS: Record<SlaPauseReasonCode, string> = {
  MERCHANT_ACCESS: "Menunggu akses lokasi merchant",
  POWER_CONSTRAINT: "Kendala listrik / site power",
  FORCE_MAJEURE: "Force majeure",
  BRI_HOLD: "Hold koordinasi BRI",
  NETWORK_MASS_OUTAGE: "Anomali jaringan massal (cellular/ISP)",
  OTHER: "Lainnya (wajib catatan)",
};

export function isSlaPauseReasonCode(v: string): v is SlaPauseReasonCode {
  return (SLA_PAUSE_REASON_CODES as readonly string[]).includes(v);
}
