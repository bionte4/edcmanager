/**
 * Monthly Preventive Maintenance (REQUEST + PM) — adjustable cadence.
 */

export const PM_CALENDAR_CONFIG = {
  itsmType: "REQUEST" as const,
  process: "PM" as const,
  /** Preferred day-of-month to generate (cron). */
  generateDayOfMonth: 1,
  /** Warn UI this many days before month end if no run yet. */
  warningDaysBeforeMonthEnd: 5,
  category: "NON_VIP" as const,
  defaultLocation: "JKT_PUSAT" as const,
  externalSystem: "pm-scheduler",
  /** One PM ticket per Regional Office per month (demo-scale). */
  scope: "REGIONAL_OFFICE" as const,
  descriptionTemplate: (periodKey: string, ro: string) =>
    `Preventive Maintenance terjadwal ${periodKey} · ${ro} — checklist 1×/bulan per kontrak.`,
} as const;

export function periodKeyFromDate(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function jakartaPeriodKey(asOf = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(asOf);
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}
