/**
 * Personnel performance reporting thresholds — adjustable without UI changes.
 */

/** Weight of SLA compliance in overall personnel score (0–1). */
export const PERSONNEL_SCORE_SLA_WEIGHT = 0.5;

/** Weight of attendance rate in overall personnel score (0–1). */
export const PERSONNEL_SCORE_ATTENDANCE_WEIGHT = 0.3;

/** Weight of ticket throughput (normalized) in overall score (0–1). */
export const PERSONNEL_SCORE_THROUGHPUT_WEIGHT = 0.2;

/** Tickets handled at this count ≈ full throughput score. */
export const PERSONNEL_THROUGHPUT_FULL_AT = 10;

/** Floor for “healthy” SLA compliance on owned tickets (%). */
export const PERSONNEL_SLA_FLOOR_PERCENT = 90;

/** Floor for “healthy” attendance rate (%). */
export const PERSONNEL_ATTENDANCE_FLOOR_PERCENT = 85;
