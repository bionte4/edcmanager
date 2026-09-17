/**
 * Smart dispatch — tech:merchant ratio + load balancing.
 * Adjust TARGET_TECH_MERCHANT_RATIO when BRI field staffing terms change.
 *
 * Home RO + standby live on User (Admin Users) — not hardcoded maps.
 */

export const DISPATCH_CONFIG = {
  /** Contractual field coverage: 1 technician : N merchants. */
  targetTechMerchantRatio: 25,
  /** Scoring weights (sum ≈ 1). */
  weights: {
    /** Prefer lower open-ticket load. */
    openLoad: 0.5,
    /** Prefer home RO match to ticket RO. */
    roMatch: 0.35,
    /** Bonus if marked standby on user profile. */
    standby: 0.15,
  },
  /** Soft cap: score penalty starts after this many open tickets. */
  openTicketSoftCap: 8,
  externalSystem: "dispatch-suggest",
} as const;

/** Parse home RO list from a user-shaped object. */
export function homeRosFromUser(user: {
  homeRos?: readonly string[] | null;
}): string[] {
  return user.homeRos?.length ? [...user.homeRos] : [];
}

export function isUserStandby(user: {
  standbyField?: boolean | null;
}): boolean {
  return !!user.standbyField;
}
