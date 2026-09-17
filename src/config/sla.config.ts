/**
 * EDC SLA & uptime configuration.
 * Adjust these values when contract terms change; do not hardcode elsewhere.
 */

export type TicketLocation = "DALAM_KOTA" | "LUAR_KOTA" | "LUAR_PULAU";
export type TicketCategory = "VIP" | "NON_VIP";

/** Peak-hour window for Dalam Kota VIP (local time, inclusive start / exclusive end minutes-of-day). */
export const PEAK_HOURS = {
  /** 06:01 */
  startMinutes: 6 * 60 + 1,
  /** 21:00 */
  endMinutes: 21 * 60,
  timeZone: "Asia/Jakarta",
} as const;

/**
 * Resolution SLA limits in minutes, keyed by location → category.
 * Dalam Kota VIP during peak hours uses `peakMinutes` (strict 2 hours per SLA policy).
 */
export const RESOLUTION_SLA_MINUTES = {
  DALAM_KOTA: {
    VIP: {
      /** Peak 06.01–21.00: max 2 hours */
      peakMinutes: 2 * 60,
      /** Outside peak: default off-peak window (adjustable) */
      offPeakMinutes: 4 * 60,
    },
    NON_VIP: {
      peakMinutes: 4 * 60,
      offPeakMinutes: 6 * 60,
    },
  },
  LUAR_KOTA: {
    VIP: { peakMinutes: 8 * 60, offPeakMinutes: 8 * 60 },
    NON_VIP: { peakMinutes: 12 * 60, offPeakMinutes: 12 * 60 },
  },
  LUAR_PULAU: {
    VIP: { peakMinutes: 24 * 60, offPeakMinutes: 24 * 60 },
    NON_VIP: { peakMinutes: 48 * 60, offPeakMinutes: 48 * 60 },
  },
} as const satisfies Record<
  TicketLocation,
  Record<
    TicketCategory,
    { peakMinutes: number; offPeakMinutes: number }
  >
>;

/** Fraction of SLA elapsed that triggers WARNING (e.g. 0.8 → 1h36m on a 2h limit). */
export const SLA_WARNING_THRESHOLD = 0.8;

/** Contractual monthly uptime target (percent). */
export const UPTIME_TARGET_PERCENT = 99.9;

/** Minutes in a calendar day (for uptime downtime math). */
export const MINUTES_PER_DAY = 24 * 60;
