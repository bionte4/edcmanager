/**
 * EDC SLA & uptime configuration.
 * Adjust these values when contract terms change; do not hardcode elsewhere.
 *
 * Ticket priority codes → slaProfile via ticket-category CRUD.
 * Ticket location codes → slaZone via location CRUD (location.config).
 */

/** SLA matrix zone — Dalam kota / Luar kota / Luar pulau. */
export type SlaZone = "DALAM_KOTA" | "LUAR_KOTA" | "LUAR_PULAU";

/**
 * Location code on a ticket — open string; catalog in location.config / store.
 * Legacy zone codes (DALAM_KOTA, …) remain valid aliases.
 */
export type TicketLocation = string;

/** @deprecated Use SlaZone — kept for gradual rename. */
export type TicketLocationZone = SlaZone;

/** Category code on a ticket — open string; catalog in ticket-category.config / store. */
export type TicketCategory = string;

/** SLA matrix profile (categories map here via slaProfile). */
export type SlaProfile = "VIP" | "NON_VIP";

/** Peak-hour window for Dalam Kota VIP profile (local time). */
export const PEAK_HOURS = {
  /** 06:01 */
  startMinutes: 6 * 60 + 1,
  /** 21:00 */
  endMinutes: 21 * 60,
  timeZone: "Asia/Jakarta",
} as const;

/**
 * Resolution SLA limits in minutes, keyed by slaZone → slaProfile.
 * Dalam Kota VIP during peak hours uses `peakMinutes` (strict 2 hours).
 */
export const RESOLUTION_SLA_MINUTES = {
  DALAM_KOTA: {
    VIP: {
      peakMinutes: 2 * 60,
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
  SlaZone,
  Record<SlaProfile, { peakMinutes: number; offPeakMinutes: number }>
>;

/** Fraction of SLA elapsed that triggers WARNING (e.g. 0.8 → 1h36m on a 2h limit). */
export const SLA_WARNING_THRESHOLD = 0.8;

/** Contractual monthly uptime target (percent). */
export const UPTIME_TARGET_PERCENT = 99.9;

/** Minutes in a calendar day (for uptime downtime math). */
export const MINUTES_PER_DAY = 24 * 60;
