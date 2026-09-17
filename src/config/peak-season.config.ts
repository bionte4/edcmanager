/**
 * Peak season playbook (Natal, Tahun Baru, Lebaran).
 * Update yearly windows here — do not hardcode in UI.
 */

export type PeakSeasonId = "NATAL" | "TAHUN_BARU" | "LEBARAN";

export interface PeakSeasonWindow {
  id: PeakSeasonId;
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
}

/**
 * Windows for contract year around DEMO_AS_OF (2026).
 * Lebaran dates approximate — adjust when HR/BRI calendar published.
 */
export const PEAK_SEASON_WINDOWS_2026: readonly PeakSeasonWindow[] = [
  {
    id: "TAHUN_BARU",
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
  },
  {
    id: "LEBARAN",
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
  },
  {
    id: "NATAL",
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
  },
];

export const PEAK_SEASON_CONFIG = {
  timezone: "Asia/Jakarta",
  windows: PEAK_SEASON_WINDOWS_2026,
  externalSystem: "peak-playbook",
} as const;

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

export function evaluatePeakSeasons(asOf = new Date()): PeakSeasonStatus[] {
  const today = jakartaYmd(asOf);
  return PEAK_SEASON_CONFIG.windows.map((window) => {
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

export function peakPeriodKey(id: PeakSeasonId, startDate: string): string {
  const year = startDate.slice(0, 4);
  return `${id}-${year}`;
}
