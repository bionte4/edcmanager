/**
 * Workforce Management (WFM) — attendance on NOC/L1 login + shift-swap approvals.
 * Times follow NOC_SHIFT_WINDOWS (Asia/Jakarta).
 */

import { NOC_SHIFT_WINDOWS, type NocShiftType } from "@/config/noc.config";

/** Roles treated as floor workforce (NOC = L1). */
export const WFM_ATTENDANCE_ROLES = ["NOC", "SUPERVISOR"] as const;

export const WFM_TIMEZONE = "Asia/Jakarta";

/** Minutes after shift start still counted as on-time. */
export const WFM_GRACE_MINUTES = 15;

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "NO_ROSTER"
  | "OUT_OF_WINDOW";

export type SwapRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  NO_ROSTER: "Tanpa roster",
  OUT_OF_WINDOW: "Di luar jam shift",
};

export const SWAP_STATUS_LABELS: Record<SwapRequestStatus, string> = {
  PENDING: "Menunggu approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

export function minutesNowInJakarta(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WFM_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function dateInJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WFM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function resolveCurrentShiftType(now = new Date()): NocShiftType {
  const mins = minutesNowInJakarta(now);
  for (const [key, window] of Object.entries(NOC_SHIFT_WINDOWS) as Array<
    [NocShiftType, (typeof NOC_SHIFT_WINDOWS)[NocShiftType]]
  >) {
    if (window.startMinutes < window.endMinutes) {
      if (mins >= window.startMinutes && mins < window.endMinutes) return key;
    } else {
      // Night crosses midnight
      if (mins >= window.startMinutes || mins < window.endMinutes) return key;
    }
  }
  return "MORNING";
}

/** Shift date for night roster before midnight stays today; after midnight still night of previous calendar day? Keep simple: use Jakarta calendar date. */
export function shiftDateForAttendance(now = new Date()): string {
  return dateInJakarta(now);
}

export function isLateForShift(shiftType: NocShiftType, now = new Date()): boolean {
  const window = NOC_SHIFT_WINDOWS[shiftType];
  const mins = minutesNowInJakarta(now);
  let elapsed: number;
  if (window.startMinutes < window.endMinutes) {
    elapsed = mins - window.startMinutes;
  } else {
    // night
    elapsed =
      mins >= window.startMinutes
        ? mins - window.startMinutes
        : mins + 24 * 60 - window.startMinutes;
  }
  return elapsed > WFM_GRACE_MINUTES;
}

/** Parse YYYY-MM-DD as UTC noon to avoid DST edge cases when shifting days. */
export function parseYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new Error(`Tanggal tidak valid: "${ymd}" (pakai YYYY-MM-DD)`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

export function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Monday-start week containing `ymd`. */
export function weekBounds(ymd: string): { from: string; to: string } {
  const d = parseYmd(ymd);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + offsetToMon);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: formatYmd(monday), to: formatYmd(sunday) };
}

/** Month bounds for YYYY-MM or any YYYY-MM-DD in that month. */
export function monthBounds(ymOrYmd: string): { from: string; to: string } {
  const raw = ymOrYmd.trim();
  const ym = /^\d{4}-\d{2}$/.test(raw) ? raw : raw.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw new Error(`Bulan tidak valid: "${ymOrYmd}" (pakai YYYY-MM)`);
  }
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const from = `${ym}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function enumerateDates(from: string, to: string): string[] {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (end.getTime() < start.getTime()) {
    throw new Error("Tanggal akhir harus ≥ tanggal awal.");
  }
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    out.push(formatYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export type RosterPeriodMode = "week" | "month" | "range";

export function resolveRosterPeriod(input: {
  mode: RosterPeriodMode;
  anchor?: string;
  from?: string;
  to?: string;
}): { from: string; to: string; label: string } {
  if (input.mode === "range") {
    if (!input.from || !input.to) {
      throw new Error("Mode range membutuhkan from & to (YYYY-MM-DD).");
    }
    return {
      from: input.from,
      to: input.to,
      label: `${input.from} → ${input.to}`,
    };
  }
  const anchor = input.anchor ?? dateInJakarta();
  if (input.mode === "week") {
    const b = weekBounds(anchor);
    return { ...b, label: `Minggu ${b.from} → ${b.to}` };
  }
  const b = monthBounds(anchor);
  return { ...b, label: `Bulan ${b.from.slice(0, 7)}` };
}
