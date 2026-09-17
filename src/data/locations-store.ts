import {
  DEFAULT_LOCATIONS,
  isSlaZone,
  locationLabelFromCatalog,
  normalizeLocationCode,
  slaZoneFromCatalog,
  type LocationDef,
  type SlaZone,
} from "@/config/location.config";
import { REGIONAL_OFFICES } from "@/config/assets.config";
import { prisma } from "@/lib/prisma";
import type { LocationDef as PrismaLocationDef } from "@prisma/client";

export type { LocationDef, SlaZone };

function clone(c: LocationDef): LocationDef {
  return { ...c };
}

function mapRow(row: PrismaLocationDef): LocationDef {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    slaZone: row.slaZone as SlaZone,
    regionalOffice: row.regionalOffice ?? undefined,
    description: row.description ?? undefined,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** In-memory cache; seeded with defaults until DB refresh completes. */
let locations: LocationDef[] = DEFAULT_LOCATIONS.map(clone);

export async function refreshLocationCache(): Promise<void> {
  try {
    const rows = await prisma.locationDef.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    locations =
      rows.length > 0 ? rows.map(mapRow) : DEFAULT_LOCATIONS.map(clone);
  } catch {
    locations = DEFAULT_LOCATIONS.map(clone);
  }
}

let locationCacheWarmed = false;

export async function listLocations(opts?: {
  activeOnly?: boolean;
}): Promise<LocationDef[]> {
  if (!locationCacheWarmed) {
    await refreshLocationCache();
    locationCacheWarmed = true;
  }
  return locations
    .filter((c) => (opts?.activeOnly ? c.isActive : true))
    .map(clone)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export function findLocationByCode(code: string): LocationDef | null {
  const normalized = normalizeLocationCode(code);
  const found = locations.find((c) => c.code === normalized);
  return found ? clone(found) : null;
}

/** Sync — SLA engine hot path. */
export function getLocationSlaZone(code: string): SlaZone {
  return slaZoneFromCatalog(code, locations);
}

/** Sync — display labels. */
export function getLocationLabel(code: string): string {
  return locationLabelFromCatalog(code, locations);
}

export interface LocationInput {
  code: string;
  label: string;
  slaZone: SlaZone;
  regionalOffice?: string | null;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

function validate(input: LocationInput, exceptId?: string): void {
  const code = normalizeLocationCode(input.code);
  if (!code) throw new Error("Kode lokasi wajib diisi.");
  if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(code)) {
    throw new Error("Kode: huruf besar/angka/underscore, mulai huruf (max 32).");
  }
  if (!input.label?.trim()) throw new Error("Label wajib diisi.");
  if (!isSlaZone(input.slaZone)) {
    throw new Error("slaZone harus DALAM_KOTA, LUAR_KOTA, atau LUAR_PULAU.");
  }
  if (input.regionalOffice) {
    const ro = input.regionalOffice.trim();
    if (ro && !(REGIONAL_OFFICES as readonly string[]).includes(ro)) {
      throw new Error(`Regional office tidak dikenal: ${ro}`);
    }
  }
  const dup = locations.find((c) => c.code === code && c.id !== exceptId);
  if (dup) throw new Error(`Kode lokasi "${code}" sudah dipakai.`);
}

export async function createLocation(input: LocationInput): Promise<LocationDef> {
  validate(input);
  const row = await prisma.locationDef.create({
    data: {
      code: normalizeLocationCode(input.code),
      label: input.label.trim(),
      slaZone: input.slaZone,
      regionalOffice: input.regionalOffice?.trim() || null,
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 100,
      isActive: input.isActive ?? true,
    },
  });
  await refreshLocationCache();
  return mapRow(row);
}

export async function updateLocation(
  id: string,
  input: Partial<LocationInput>
): Promise<LocationDef> {
  const existing =
    locations.find((c) => c.id === id) ??
    (await prisma.locationDef.findUnique({ where: { id } }).then((r) =>
      r ? mapRow(r) : null
    ));
  if (!existing) throw new Error("Lokasi tidak ditemukan.");

  const next: LocationInput = {
    code: input.code ?? existing.code,
    label: input.label ?? existing.label,
    slaZone: input.slaZone ?? existing.slaZone,
    regionalOffice:
      input.regionalOffice !== undefined
        ? input.regionalOffice
        : existing.regionalOffice,
    description: input.description ?? existing.description,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    isActive: input.isActive ?? existing.isActive,
  };
  validate(next, id);
  const row = await prisma.locationDef.update({
    where: { id },
    data: {
      code: normalizeLocationCode(next.code),
      label: next.label.trim(),
      slaZone: next.slaZone,
      regionalOffice: next.regionalOffice?.trim() || null,
      description: next.description?.trim() || null,
      sortOrder: next.sortOrder ?? 100,
      isActive: next.isActive ?? true,
    },
  });
  await refreshLocationCache();
  return mapRow(row);
}

/**
 * Soft-deactivate if tickets still reference this code; otherwise hard-delete.
 * Built-in zone aliases cannot be deleted.
 */
export async function deleteLocation(id: string): Promise<{ soft: boolean }> {
  const row =
    locations.find((c) => c.id === id) ??
    (await prisma.locationDef.findUnique({ where: { id } }).then((r) =>
      r ? mapRow(r) : null
    ));
  if (!row) throw new Error("Lokasi tidak ditemukan.");
  if (isSlaZone(row.code) && row.code === row.slaZone) {
    throw new Error(
      "Alias zona bawaan (DALAM_KOTA / LUAR_KOTA / LUAR_PULAU) tidak boleh dihapus (bisa di-nonaktifkan)."
    );
  }
  const used = await prisma.ticket.count({ where: { location: row.code } });
  if (used > 0) {
    await prisma.locationDef.update({
      where: { id },
      data: { isActive: false },
    });
    await refreshLocationCache();
    return { soft: true };
  }
  await prisma.locationDef.delete({ where: { id } });
  await refreshLocationCache();
  return { soft: false };
}

export async function resetLocations(): Promise<LocationDef[]> {
  await prisma.$transaction(async (tx) => {
    await tx.locationDef.deleteMany();
    await tx.locationDef.createMany({
      data: DEFAULT_LOCATIONS.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        slaZone: c.slaZone,
        regionalOffice: c.regionalOffice ?? null,
        description: c.description ?? null,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
    });
  });
  await refreshLocationCache();
  return listLocations();
}
