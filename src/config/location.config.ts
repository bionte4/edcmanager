/**
 * Master lokasi operasional.
 * Kode disimpan di tiket; SLA matrix tetap keyed by slaZone (Dalam/Luar kota/pulau).
 *
 * Level A seed: kota/kabupaten prioritas coverage per RO (lihat data/locations-level-a.json).
 * Alias zona: isTicketSelectable=false — OLA/legacy only.
 */

import type { SlaZone } from "@/config/sla.config";
import levelA from "@/config/data/locations-level-a.json";

export type { SlaZone };

export const SLA_ZONES = ["DALAM_KOTA", "LUAR_KOTA", "LUAR_PULAU"] as const;

export const SLA_ZONE_LABELS: Record<SlaZone, string> = {
  DALAM_KOTA: "Dalam Kota",
  LUAR_KOTA: "Luar Kota",
  LUAR_PULAU: "Luar Pulau",
};

export interface LocationDef {
  id: string;
  code: string;
  label: string;
  slaZone: SlaZone;
  regionalOffice?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  isTicketSelectable: boolean;
}

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

const OPERATIONAL_SITES: readonly LocationDef[] = levelA.sites.map((s) => ({
  id: `loc-${s.code.toLowerCase().replace(/_/g, "-")}`,
  code: s.code,
  label: s.label,
  slaZone: s.slaZone as SlaZone,
  regionalOffice: s.regionalOffice,
  sortOrder: s.sortOrder,
  isActive: true,
  isTicketSelectable: true,
}));

export const DEFAULT_LOCATIONS: readonly LocationDef[] = [
  ...ZONE_ALIASES,
  ...OPERATIONAL_SITES,
];

/** ROs used by Level A catalog — keep in sync with assets.config REGIONAL_OFFICES. */
export const LEVEL_A_REGIONAL_OFFICES = levelA.regionalOffices as readonly string[];

export function normalizeLocationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export function isSlaZone(value: string): value is SlaZone {
  return (SLA_ZONES as readonly string[]).includes(value);
}

export function isZoneAlias(
  loc: Pick<LocationDef, "code" | "slaZone" | "isTicketSelectable">
): boolean {
  return (
    !loc.isTicketSelectable || (isSlaZone(loc.code) && loc.code === loc.slaZone)
  );
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
