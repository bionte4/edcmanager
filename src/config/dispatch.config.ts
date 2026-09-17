/**
 * Smart dispatch — tech:merchant ratio + load balancing.
 * Adjust TARGET_TECH_MERCHANT_RATIO when BRI field staffing terms change.
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
    /** Bonus if marked standby in tech roster config. */
    standby: 0.15,
  },
  /** Soft cap: score penalty starts after this many open tickets. */
  openTicketSoftCap: 8,
  externalSystem: "dispatch-suggest",
} as const;

/**
 * Home RO coverage for field technicians (no User.regionalOffice column yet).
 * Keys: user email (preferred) or exact display name.
 */
export const TECH_HOME_RO: Record<string, readonly string[]> = {
  "eko.tech@edc.local": ["RO Jakarta 1", "RO Bandung"],
  "Eko Teknisi": ["RO Jakarta 1", "RO Bandung"],
  "rina.tech@edc.local": ["RO Surabaya", "RO Semarang", "RO Denpasar"],
  "Rina Teknisi": ["RO Surabaya", "RO Semarang", "RO Denpasar"],
  "agus.tech@edc.local": ["RO Medan", "RO Palembang"],
  "Agus Teknisi": ["RO Medan", "RO Palembang"],
  "maya.tech@edc.local": ["RO Makassar", "RO Manado", "RO Jayapura", "RO Balikpapan", "RO Pontianak"],
  "Maya Teknisi": ["RO Makassar", "RO Manado", "RO Jayapura", "RO Balikpapan", "RO Pontianak"],
};

/** Optional standby flag for scoring (DOG/field standby). */
export const TECH_STANDBY_EMAILS: readonly string[] = [
  "eko.tech@edc.local",
  "rina.tech@edc.local",
];

export function homeRosForTech(email?: string | null, name?: string | null): string[] {
  if (email && TECH_HOME_RO[email]) return [...TECH_HOME_RO[email]];
  if (name && TECH_HOME_RO[name]) return [...TECH_HOME_RO[name]];
  return [];
}

export function isTechStandby(email?: string | null): boolean {
  if (!email) return false;
  return (TECH_STANDBY_EMAILS as readonly string[]).includes(email);
}
