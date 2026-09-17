/**
 * Master lokasi operasional.
 * Kode disimpan di tiket; SLA matrix tetap keyed by slaZone (Dalam/Luar kota/pulau).
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
  /** Stable code stored on tickets (e.g. DALAM_KOTA, JKT_PUSAT). */
  code: string;
  label: string;
  /** Which RESOLUTION_SLA_MINUTES zone to use. */
  slaZone: SlaZone;
  /** Optional link to inventory Regional Office. */
  regionalOffice?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * Defaults: three zone aliases (backward-compatible with old enum values)
 * plus sample cities mapping into those zones.
 */
export const DEFAULT_LOCATIONS: readonly LocationDef[] = [
  {
    id: "loc-dalam-kota",
    code: "DALAM_KOTA",
    label: "Dalam Kota (zona)",
    slaZone: "DALAM_KOTA",
    description: "Alias zona — SLA peak VIP 2 jam",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "loc-luar-kota",
    code: "LUAR_KOTA",
    label: "Luar Kota (zona)",
    slaZone: "LUAR_KOTA",
    description: "Alias zona SLA luar kota",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "loc-luar-pulau",
    code: "LUAR_PULAU",
    label: "Luar Pulau (zona)",
    slaZone: "LUAR_PULAU",
    description: "Alias zona SLA luar pulau",
    sortOrder: 30,
    isActive: true,
  },
  {
    id: "loc-jkt-pusat",
    code: "JKT_PUSAT",
    label: "Jakarta Pusat",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Contoh lokasi dalam kota",
    sortOrder: 40,
    isActive: true,
  },
  {
    id: "loc-bdg",
    code: "BDG_KOTA",
    label: "Bandung Kota",
    slaZone: "LUAR_KOTA",
    regionalOffice: "RO Bandung",
    description: "Contoh lokasi luar kota",
    sortOrder: 50,
    isActive: true,
  },
  {
    id: "loc-dps",
    code: "DPS_BALI",
    label: "Denpasar Bali",
    slaZone: "LUAR_PULAU",
    regionalOffice: "RO Denpasar",
    description: "Contoh lokasi luar pulau",
    sortOrder: 60,
    isActive: true,
  },
] as const;

export function normalizeLocationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export function isSlaZone(value: string): value is SlaZone {
  return (SLA_ZONES as readonly string[]).includes(value);
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
