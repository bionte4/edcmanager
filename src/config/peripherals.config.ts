/**
 * Peripheral / consumable inventory (cables, paper, SIM, spare parts).
 * Quantity-based SKUs — separate from serial EDC units in assets-store.
 */

export const PERIPHERAL_CATEGORIES = [
  "CABLE",
  "PAPER_ROLL",
  "SIM_CARD",
  "SPARE_PART",
  "OTHER",
] as const;

export type PeripheralCategory = (typeof PERIPHERAL_CATEGORIES)[number];

export const PERIPHERAL_CATEGORY_LABELS: Record<PeripheralCategory, string> = {
  CABLE: "Kabel",
  PAPER_ROLL: "Kertas EDC",
  SIM_CARD: "SIM Card",
  SPARE_PART: "Spare Part",
  OTHER: "Lainnya",
};

export const PERIPHERAL_UNITS = ["pcs", "roll", "box", "set"] as const;
export type PeripheralUnit = (typeof PERIPHERAL_UNITS)[number];

export const STOCK_MUTATION_TYPES = [
  "IN",
  "OUT",
  "TRANSFER",
  "ADJUST",
] as const;
export type StockMutationType = (typeof STOCK_MUTATION_TYPES)[number];

export const STOCK_MUTATION_LABELS: Record<StockMutationType, string> = {
  IN: "Masuk",
  OUT: "Keluar",
  TRANSFER: "Transfer RO",
  ADJUST: "Adjustment",
};

/** Default min-stock alert when SKU has no override. */
export const DEFAULT_PERIPHERAL_MIN_STOCK = 20;
