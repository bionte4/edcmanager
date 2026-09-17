/**
 * Peak season playbook — defaults + pure evaluation helpers.
 * Runtime windows live in Postgres (`PeakSeasonWindow`); edit via UI.
 * Do not hardcode yearly dates in components — use the store/API.
 */

export type PeakSeasonKind = "NATAL" | "TAHUN_BARU" | "LEBARAN";

/** @deprecated Use PeakSeasonKind */
export type PeakSeasonId = PeakSeasonKind;

export const PEAK_SEASON_KINDS: readonly PeakSeasonKind[] = [
  "TAHUN_BARU",
  "LEBARAN",
  "NATAL",
] as const;

export const PEAK_SEASON_KIND_LABELS: Record<PeakSeasonKind, string> = {
  TAHUN_BARU: "Tahun Baru",
  LEBARAN: "Lebaran / Idul Fitri",
  NATAL: "Natal",
};

export interface PeakSeasonWindow {
  id: string;
  kind: PeakSeasonKind;
  name: string;
  /** Inclusive start YYYY-MM-DD (Asia/Jakarta calendar). */
  startDate: string;
  /** Inclusive end YYYY-MM-DD. */
  endDate: string;
  /** Days before start to raise intensification alert. */
  alertLeadDays: number;
  /** Suggested buffer floor during peak (overrides display guidance). */
  bufferFloorPercent: number;
  /** Checklist items for ops intensifikasi. */
  checklist: string[];
  isActive: boolean;
  sortOrder: number;
}

/**
 * Seed / fallback windows around DEMO_AS_OF (2026).
 * Lebaran dates approximate — Ops updates via UI when HR/BRI calendar published.
 */
export const DEFAULT_PEAK_SEASON_WINDOWS: readonly PeakSeasonWindow[] = [
  {
    id: "peak-tb-2026",
    kind: "TAHUN_BARU",
    name: "Tahun Baru",
    startDate: "2025-12-28",
    endDate: "2026-01-05",
    alertLeadDays: 7,
    bufferFloorPercent: 15,
    checklist: [
      "Naikkan buffer stock target RO metropolitan ke ≥15%",
      "Standby LO DOG full coverage malam tahun baru",
      "Prioritas VIP Dalam Kota — pantau near-breach tiap jam",
      "Siapkan pooling unit idle antar RO Jabodetabek",
    ],
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "peak-lebaran-2026",
    kind: "LEBARAN",
    name: "Lebaran / Idul Fitri",
    startDate: "2026-03-15",
    endDate: "2026-03-28",
    alertLeadDays: 14,
    bufferFloorPercent: 15,
    checklist: [
      "Pre-position buffer di RO transit mudik (Bandung, Semarang, Surabaya)",
      "Batasi PM non-kritis selama H-3 s/d H+3",
      "Eskalasi LO untuk merchant mall/rest area",
      "Koordinasi BRI hold clock-stop force majeure mudik",
    ],
    isActive: true,
    sortOrder: 20,
  },
  {
    id: "peak-natal-2026",
    kind: "NATAL",
    name: "Natal",
    startDate: "2026-12-20",
    endDate: "2026-12-27",
    alertLeadDays: 10,
    bufferFloorPercent: 12,
    checklist: [
      "Intensifikasi monitoring uptime mall & F&B",
      "Roster LO + NOC overlapping shift malam Natal",
      "Pastikan spare thermal/paper peripheral di RO besar",
      "Near-breach digest 2× sehari (12:00 & 16:00)",
    ],
    isActive: true,
    sortOrder: 30,
  },
];

/** @deprecated Prefer DEFAULT_PEAK_SEASON_WINDOWS */
export const PEAK_SEASON_WINDOWS_2026 = DEFAULT_PEAK_SEASON_WINDOWS;

export const PEAK_SEASON_CONFIG = {
  timezone: "Asia/Jakarta",
  /** Fallback only — runtime uses DB via peak-season-store */
  windows: DEFAULT_PEAK_SEASON_WINDOWS,
  externalSystem: "peak-playbook",
} as const;

export function isPeakSeasonKind(v: string): v is PeakSeasonKind {
  return (PEAK_SEASON_KINDS as readonly string[]).includes(v);
}

function parseYmdLocal(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!, 12, 0, 0);
}

export function jakartaYmd(asOf = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PEAK_SEASON_CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = parseYmdLocal(fromYmd);
  const b = parseYmdLocal(toYmd);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export type PeakSeasonStatus = {
  window: PeakSeasonWindow;
  state: "ACTIVE" | "UPCOMING" | "PAST";
  daysUntilStart: number;
  daysUntilEnd: number;
  intensifyDue: boolean;
};

export function evaluatePeakSeasons(
  windows: readonly PeakSeasonWindow[],
  asOf = new Date()
): PeakSeasonStatus[] {
  const today = jakartaYmd(asOf);
  return windows
    .filter((w) => w.isActive)
    .slice()
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate)
    )
    .map((window) => {
      const daysUntilStart = daysBetweenYmd(today, window.startDate);
      const daysUntilEnd = daysBetweenYmd(today, window.endDate);
      let state: PeakSeasonStatus["state"] = "UPCOMING";
      if (daysUntilEnd < 0) state = "PAST";
      else if (daysUntilStart <= 0 && daysUntilEnd >= 0) state = "ACTIVE";
      const intensifyDue =
        state === "ACTIVE" ||
        (state === "UPCOMING" && daysUntilStart <= window.alertLeadDays);
      return {
        window,
        state,
        daysUntilStart,
        daysUntilEnd,
        intensifyDue,
      };
    });
}

export function peakPeriodKey(kind: PeakSeasonKind, startDate: string): string {
  const year = startDate.slice(0, 4);
  return `${kind}-${year}`;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidYmd(label: string, value: string): void {
  if (!YMD_RE.test(value)) {
    throw new Error(`${label} harus format YYYY-MM-DD.`);
  }
  const t = Date.parse(`${value}T12:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`${label} tidak valid.`);
}
