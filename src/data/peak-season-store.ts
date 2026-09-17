import {
  DEFAULT_PEAK_SEASON_WINDOWS,
  PEAK_SEASON_KIND_LABELS,
  assertValidYmd,
  evaluatePeakSeasons,
  isPeakSeasonKind,
  type PeakSeasonKind,
  type PeakSeasonStatus,
  type PeakSeasonWindow,
} from "@/config/peak-season.config";
import { prisma } from "@/lib/prisma";
import type { PeakSeasonWindow as PrismaPeak } from "@prisma/client";

export type { PeakSeasonWindow, PeakSeasonKind, PeakSeasonStatus };

function clone(w: PeakSeasonWindow): PeakSeasonWindow {
  return { ...w, checklist: [...w.checklist] };
}

function mapRow(row: PrismaPeak): PeakSeasonWindow {
  let checklist: string[] = [];
  try {
    const parsed = JSON.parse(row.checklistJson) as unknown;
    if (Array.isArray(parsed)) {
      checklist = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    checklist = [];
  }
  return {
    id: row.id,
    kind: row.kind as PeakSeasonKind,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    alertLeadDays: row.alertLeadDays,
    bufferFloorPercent: row.bufferFloorPercent,
    checklist,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

let cache: PeakSeasonWindow[] = DEFAULT_PEAK_SEASON_WINDOWS.map(clone);
let cacheWarmed = false;

export async function refreshPeakSeasonCache(): Promise<void> {
  try {
    const rows = await prisma.peakSeasonWindow.findMany({
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }],
    });
    cache =
      rows.length > 0
        ? rows.map(mapRow)
        : DEFAULT_PEAK_SEASON_WINDOWS.map(clone);
  } catch {
    cache = DEFAULT_PEAK_SEASON_WINDOWS.map(clone);
  }
}

export async function listPeakSeasonWindows(opts?: {
  activeOnly?: boolean;
}): Promise<PeakSeasonWindow[]> {
  if (!cacheWarmed) {
    await refreshPeakSeasonCache();
    cacheWarmed = true;
  }
  return cache
    .filter((w) => (opts?.activeOnly ? w.isActive : true))
    .map(clone)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate)
    );
}

export async function getPeakSeasonStatuses(
  asOf = new Date()
): Promise<PeakSeasonStatus[]> {
  const windows = await listPeakSeasonWindows({ activeOnly: true });
  return evaluatePeakSeasons(windows, asOf);
}

export function findPeakSeasonById(id: string): PeakSeasonWindow | null {
  const found = cache.find((w) => w.id === id);
  return found ? clone(found) : null;
}

export interface PeakSeasonInput {
  kind: PeakSeasonKind;
  name?: string;
  startDate: string;
  endDate: string;
  alertLeadDays?: number;
  bufferFloorPercent?: number;
  checklist?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

function validate(input: PeakSeasonInput, exceptId?: string): void {
  if (!isPeakSeasonKind(input.kind)) {
    throw new Error("kind harus NATAL, TAHUN_BARU, atau LEBARAN.");
  }
  assertValidYmd("startDate", input.startDate);
  assertValidYmd("endDate", input.endDate);
  if (input.startDate > input.endDate) {
    throw new Error("startDate tidak boleh setelah endDate.");
  }
  const lead = input.alertLeadDays ?? 7;
  if (!Number.isFinite(lead) || lead < 0 || lead > 90) {
    throw new Error("alertLeadDays harus 0–90.");
  }
  const buf = input.bufferFloorPercent ?? 12;
  if (!Number.isFinite(buf) || buf < 0 || buf > 100) {
    throw new Error("bufferFloorPercent harus 0–100.");
  }
  const dup = cache.find(
    (w) =>
      w.kind === input.kind &&
      w.startDate === input.startDate &&
      w.id !== exceptId
  );
  if (dup) {
    throw new Error(
      `Window ${input.kind} mulai ${input.startDate} sudah ada.`
    );
  }
}

export async function createPeakSeason(
  input: PeakSeasonInput
): Promise<PeakSeasonWindow> {
  validate(input);
  const name =
    input.name?.trim() || PEAK_SEASON_KIND_LABELS[input.kind];
  const checklist = (input.checklist ?? []).map((c) => c.trim()).filter(Boolean);
  const row = await prisma.peakSeasonWindow.create({
    data: {
      kind: input.kind,
      name,
      startDate: input.startDate,
      endDate: input.endDate,
      alertLeadDays: input.alertLeadDays ?? 7,
      bufferFloorPercent: input.bufferFloorPercent ?? 12,
      checklistJson: JSON.stringify(checklist),
      sortOrder: input.sortOrder ?? 100,
      isActive: input.isActive !== false,
    },
  });
  await refreshPeakSeasonCache();
  return mapRow(row);
}

export async function updatePeakSeason(
  id: string,
  input: Partial<PeakSeasonInput>
): Promise<PeakSeasonWindow> {
  const existing = await prisma.peakSeasonWindow.findUnique({ where: { id } });
  if (!existing) throw new Error("Window peak season tidak ditemukan.");
  const merged: PeakSeasonInput = {
    kind: (input.kind as PeakSeasonKind) ?? (existing.kind as PeakSeasonKind),
    name: input.name ?? existing.name,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    alertLeadDays: input.alertLeadDays ?? existing.alertLeadDays,
    bufferFloorPercent:
      input.bufferFloorPercent ?? existing.bufferFloorPercent,
    checklist:
      input.checklist ??
      (JSON.parse(existing.checklistJson) as string[]),
    sortOrder: input.sortOrder ?? existing.sortOrder,
    isActive: input.isActive ?? existing.isActive,
  };
  validate(merged, id);
  const checklist = (merged.checklist ?? [])
    .map((c) => c.trim())
    .filter(Boolean);
  const row = await prisma.peakSeasonWindow.update({
    where: { id },
    data: {
      kind: merged.kind,
      name: merged.name!.trim() || PEAK_SEASON_KIND_LABELS[merged.kind],
      startDate: merged.startDate,
      endDate: merged.endDate,
      alertLeadDays: merged.alertLeadDays,
      bufferFloorPercent: merged.bufferFloorPercent,
      checklistJson: JSON.stringify(checklist),
      sortOrder: merged.sortOrder,
      isActive: merged.isActive,
    },
  });
  await refreshPeakSeasonCache();
  return mapRow(row);
}

export async function deletePeakSeason(id: string): Promise<void> {
  const existing = await prisma.peakSeasonWindow.findUnique({ where: { id } });
  if (!existing) throw new Error("Window peak season tidak ditemukan.");
  await prisma.peakSeasonWindow.delete({ where: { id } });
  await refreshPeakSeasonCache();
}

/** Upsert defaults (seed / reset). */
export async function seedDefaultPeakSeasons(): Promise<PeakSeasonWindow[]> {
  for (const w of DEFAULT_PEAK_SEASON_WINDOWS) {
    await prisma.peakSeasonWindow.upsert({
      where: {
        kind_startDate: { kind: w.kind, startDate: w.startDate },
      },
      create: {
        id: w.id,
        kind: w.kind,
        name: w.name,
        startDate: w.startDate,
        endDate: w.endDate,
        alertLeadDays: w.alertLeadDays,
        bufferFloorPercent: w.bufferFloorPercent,
        checklistJson: JSON.stringify(w.checklist),
        sortOrder: w.sortOrder,
        isActive: w.isActive,
      },
      update: {
        name: w.name,
        endDate: w.endDate,
        alertLeadDays: w.alertLeadDays,
        bufferFloorPercent: w.bufferFloorPercent,
        checklistJson: JSON.stringify(w.checklist),
        sortOrder: w.sortOrder,
        isActive: w.isActive,
      },
    });
  }
  await refreshPeakSeasonCache();
  return listPeakSeasonWindows();
}
