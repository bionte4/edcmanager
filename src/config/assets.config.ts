/**
 * EDC Asset Management — brands, RO list, status labels.
 * Align RO names with buffer-stock mock for consistent ops view.
 */

export const EDC_UNIT_STATUSES = ["BUFFER", "DEPLOYED", "IDLE"] as const;
export type EdcUnitStatus = (typeof EDC_UNIT_STATUSES)[number];

export const EDC_MUTATION_TYPES = [
  "DEPLOY",
  "RECALL",
  "TRANSFER",
  "POOLING",
  "BUFFER_TO_IDLE",
  "IDLE_TO_BUFFER",
  "STATUS_CHANGE",
] as const;
export type EdcMutationType = (typeof EDC_MUTATION_TYPES)[number];

export const EDC_BRANDS = ["Ingenico", "Verifone", "PAX", "Castles"] as const;

export const REGIONAL_OFFICES = [
  "RO Jakarta 1",
  "RO Bandung",
  "RO Surabaya",
  "RO Denpasar",
] as const;

/**
 * Fallback vendor names when API/DB unavailable.
 * Prefer live list from GET /api/vendors?activeOnly=1.
 */
export const ASSET_VENDORS = ["Vendor 1", "Vendor 2"] as const;

export const EDC_STATUS_LABELS: Record<EdcUnitStatus, string> = {
  BUFFER: "Buffer",
  DEPLOYED: "Deployed",
  IDLE: "Idle",
};

export const EDC_MUTATION_LABELS: Record<EdcMutationType, string> = {
  DEPLOY: "Deploy",
  RECALL: "Recall",
  TRANSFER: "Transfer",
  POOLING: "Pooling",
  BUFFER_TO_IDLE: "Buffer → Idle",
  IDLE_TO_BUFFER: "Idle → Buffer",
  STATUS_CHANGE: "Status change",
};
