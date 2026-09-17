import { REGIONAL_OFFICES } from "@/config/assets.config";
import { PM_CALENDAR_CONFIG } from "@/config/pm-calendar.config";
import { prisma } from "@/lib/prisma";

export const PM_SETTINGS_ID = "default";

export interface PmSettingsRow {
  id: string;
  generateDayOfMonth: number;
  warningDaysBeforeMonthEnd: number;
  /** ROs that receive monthly PM tickets. */
  activeRos: string[];
  updatedAt: string;
}

function parseRos(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeActiveRos(input: string[] | undefined): string[] {
  const allowed = new Set(REGIONAL_OFFICES as readonly string[]);
  if (!input?.length) {
    return [...REGIONAL_OFFICES];
  }
  const out: string[] = [];
  for (const ro of input) {
    const t = ro.trim();
    if (!t) continue;
    if (!allowed.has(t)) {
      throw new Error(`Regional office tidak dikenal: ${t}`);
    }
    if (!out.includes(t)) out.push(t);
  }
  if (out.length === 0) {
    throw new Error("Minimal satu Regional Office harus aktif untuk PM.");
  }
  return out;
}

function mapRow(row: {
  id: string;
  generateDayOfMonth: number;
  warningDaysBeforeMonthEnd: number;
  activeRosJson: string;
  updatedAt: Date;
}): PmSettingsRow {
  const parsed = parseRos(row.activeRosJson);
  return {
    id: row.id,
    generateDayOfMonth: row.generateDayOfMonth,
    warningDaysBeforeMonthEnd: row.warningDaysBeforeMonthEnd,
    activeRos: parsed.length > 0 ? parsed : [...REGIONAL_OFFICES],
    updatedAt: row.updatedAt.toISOString(),
  };
}

const fallback = (): PmSettingsRow => ({
  id: PM_SETTINGS_ID,
  generateDayOfMonth: PM_CALENDAR_CONFIG.generateDayOfMonth,
  warningDaysBeforeMonthEnd: PM_CALENDAR_CONFIG.warningDaysBeforeMonthEnd,
  activeRos: [...REGIONAL_OFFICES],
  updatedAt: new Date().toISOString(),
});

export async function ensurePmSettings(): Promise<PmSettingsRow> {
  try {
    const row = await prisma.pmSettings.upsert({
      where: { id: PM_SETTINGS_ID },
      create: {
        id: PM_SETTINGS_ID,
        generateDayOfMonth: PM_CALENDAR_CONFIG.generateDayOfMonth,
        warningDaysBeforeMonthEnd: PM_CALENDAR_CONFIG.warningDaysBeforeMonthEnd,
        activeRosJson: JSON.stringify([...REGIONAL_OFFICES]),
      },
      update: {},
    });
    return mapRow(row);
  } catch {
    return fallback();
  }
}

export async function getPmSettings(): Promise<PmSettingsRow> {
  try {
    const row = await prisma.pmSettings.findUnique({
      where: { id: PM_SETTINGS_ID },
    });
    if (!row) return ensurePmSettings();
    return mapRow(row);
  } catch {
    return fallback();
  }
}

export interface PmSettingsInput {
  generateDayOfMonth?: number;
  warningDaysBeforeMonthEnd?: number;
  activeRos?: string[];
}

export async function updatePmSettings(
  input: PmSettingsInput
): Promise<PmSettingsRow> {
  await ensurePmSettings();
  const day = input.generateDayOfMonth;
  if (day !== undefined) {
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      throw new Error("generateDayOfMonth harus 1–28 (aman semua bulan).");
    }
  }
  const warn = input.warningDaysBeforeMonthEnd;
  if (warn !== undefined) {
    if (!Number.isInteger(warn) || warn < 0 || warn > 14) {
      throw new Error("warningDaysBeforeMonthEnd harus 0–14.");
    }
  }

  const data: {
    generateDayOfMonth?: number;
    warningDaysBeforeMonthEnd?: number;
    activeRosJson?: string;
  } = {};
  if (day !== undefined) data.generateDayOfMonth = day;
  if (warn !== undefined) data.warningDaysBeforeMonthEnd = warn;
  if (input.activeRos !== undefined) {
    data.activeRosJson = JSON.stringify(normalizeActiveRos(input.activeRos));
  }

  const row = await prisma.pmSettings.update({
    where: { id: PM_SETTINGS_ID },
    data,
  });
  return mapRow(row);
}
