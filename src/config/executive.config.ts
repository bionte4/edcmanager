/**
 * Executive (GM/BOD) dashboard thresholds — keep adjustable, not hardcoded in UI.
 */

/** Contractual 3-year EDC deployment target (national units). */
export const DEPLOYMENT_TARGET_UNITS = 50_000;

/** Months of trend shown on executive board. */
export const EXECUTIVE_TREND_MONTHS = 6;

/** SLA compliance floor for "healthy" national rollup (%). */
export const EXEC_SLA_COMPLIANCE_FLOOR = 95;

/** Penalty-risk flag when breached tickets in period ≥ this count. */
export const EXEC_BREACH_ALERT_COUNT = 5;
