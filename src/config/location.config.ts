/**
 * Master lokasi operasional.
 * Kode disimpan di tiket; SLA matrix tetap keyed by slaZone (Dalam/Luar kota/pulau).
 *
 * Rekomendasi model data:
 * - Alias zona (code === slaZone): isTicketSelectable=false — hanya untuk OLA/legacy.
 * - Site operasional: kota/area nyata + RO — yang dipilih di form tiket.
 */

import type { SlaZone } from "@/config/sla.config";

export type { SlaZone };

export const SLA_ZONES = ["DALAM_KOTA", "LUAR_KOTA", "LUAR_PULAU"] as const;

export const SLA_ZONE_LABELS: Record<SlaZone, string> = {
  DALAM_KOTA: "Dalam Kota",
  LUAR_KOTA: "Luar Kota",
  LUAR_PULAU: "Luar Pulau",
};

export interface LocationDef {
  id: string;
  /** Stable code stored on tickets (e.g. JKT_PUSAT). */
  code: string;
  label: string;
  /** Which RESOLUTION_SLA_MINUTES zone to use. */
  slaZone: SlaZone;
  /** Optional link to inventory Regional Office. */
  regionalOffice?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  /** false for zone aliases — hidden from ticket create / site filters. */
  isTicketSelectable: boolean;
}

/** Zone aliases — keep for OLA match & legacy ticket codes; not for ops pickers. */
const ZONE_ALIASES: readonly LocationDef[] = [
  {
    id: "loc-dalam-kota",
    code: "DALAM_KOTA",
    label: "Dalam Kota (alias zona)",
    slaZone: "DALAM_KOTA",
    description: "Legacy/OLA — jangan dipakai di tiket baru",
    sortOrder: 1,
    isActive: true,
    isTicketSelectable: false,
  },
  {
    id: "loc-luar-kota",
    code: "LUAR_KOTA",
    label: "Luar Kota (alias zona)",
    slaZone: "LUAR_KOTA",
    description: "Legacy/OLA — jangan dipakai di tiket baru",
    sortOrder: 2,
    isActive: true,
    isTicketSelectable: false,
  },
  {
    id: "loc-luar-pulau",
    code: "LUAR_PULAU",
    label: "Luar Pulau (alias zona)",
    slaZone: "LUAR_PULAU",
    description: "Legacy/OLA — jangan dipakai di tiket baru",
    sortOrder: 3,
    isActive: true,
    isTicketSelectable: false,
  },
];

/** Operational sites — shown on ticket forms. */
const OPERATIONAL_SITES: readonly LocationDef[] = [
  // Dalam Kota — RO Jakarta 1
  {
    id: "loc-jkt-pusat",
    code: "JKT_PUSAT",
    label: "Jakarta Pusat",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Thamrin / Sudirman / Menteng",
    sortOrder: 10,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-jkt-selatan",
    code: "JKT_SELATAN",
    label: "Jakarta Selatan",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Kuningan / TB Simatupang",
    sortOrder: 11,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-jkt-barat",
    code: "JKT_BARAT",
    label: "Jakarta Barat",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Kebon Jeruk / Grogol",
    sortOrder: 12,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-jkt-utara",
    code: "JKT_UTARA",
    label: "Jakarta Utara",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Kelapa Gading / Pluit",
    sortOrder: 13,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-jkt-timur",
    code: "JKT_TIMUR",
    label: "Jakarta Timur",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Cakung / Bekasi border ops",
    sortOrder: 14,
    isActive: true,
    isTicketSelectable: true,
  },
  // Luar Kota
  {
    id: "loc-bdg",
    code: "BDG_KOTA",
    label: "Bandung Kota",
    slaZone: "LUAR_KOTA",
    regionalOffice: "RO Bandung",
    description: "Pusat kota Bandung",
    sortOrder: 20,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-bdg-cimahi",
    code: "BDG_CIMAHI",
    label: "Cimahi",
    slaZone: "LUAR_KOTA",
    regionalOffice: "RO Bandung",
    sortOrder: 21,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-sby-pusat",
    code: "SBY_PUSAT",
    label: "Surabaya Pusat",
    slaZone: "LUAR_KOTA",
    regionalOffice: "RO Surabaya",
    description: "Tunjungan / Gubeng",
    sortOrder: 22,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-sby-barat",
    code: "SBY_BARAT",
    label: "Surabaya Barat",
    slaZone: "LUAR_KOTA",
    regionalOffice: "RO Surabaya",
    sortOrder: 23,
    isActive: true,
    isTicketSelectable: true,
  },
  // Luar Pulau
  {
    id: "loc-dps",
    code: "DPS_BALI",
    label: "Denpasar Bali",
    slaZone: "LUAR_PULAU",
    regionalOffice: "RO Denpasar",
    description: "Denpasar + Sanur",
    sortOrder: 30,
    isActive: true,
    isTicketSelectable: true,
  },
  {
    id: "loc-btb",
    code: "BTB_BALI",
    label: "Badung / Kuta",
    slaZone: "LUAR_PULAU",
    regionalOffice: "RO Denpasar",
    description: "Kuta / Nusa Dua corridor",
    sortOrder: 31,
    isActive: true,
    isTicketSelectable: true,
  },
];

export const DEFAULT_LOCATIONS: readonly LocationDef[] = [
  ...ZONE_ALIASES,
  ...OPERATIONAL_SITES,
];

export function normalizeLocationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export function isSlaZone(value: string): value is SlaZone {
  return (SLA_ZONES as readonly string[]).includes(value);
}

/** Zone alias row (code mirrors slaZone). */
export function isZoneAlias(loc: Pick<LocationDef, "code" | "slaZone" | "isTicketSelectable">): boolean {
  return !loc.isTicketSelectable || (isSlaZone(loc.code) && loc.code === loc.slaZone);
}

export function slaZoneFromCatalog(
  code: string,
  catalog: readonly LocationDef[] = DEFAULT_LOCATIONS
): SlaZone {
  const normalized = normalizeLocationCode(code);
  const found = catalog.find((c) => c.code === normalized);
  if (found) return found.slaZone;
  if (isSlaZone(normalized)) return normalized;
  return "DALAM_KOTA";
}

export function locationLabelFromCatalog(
  code: string,
  catalog: readonly LocationDef[] = DEFAULT_LOCATIONS
): string {
  const normalized = normalizeLocationCode(code);
  return catalog.find((c) => c.code === normalized)?.label ?? code;
}
