import { DEMO_AS_OF } from "@/data/dashboard";
import { MOCK_NOC_SHIFTS } from "@/data/noc";
import type { AuthUser } from "@/lib/rbac";
import type { NocShiftRow, ShiftDutyStatus, ShiftType } from "@/lib/ticketing";
import {
  ATTENDANCE_STATUS_LABELS,
  WFM_ATTENDANCE_ROLES,
  dateInJakarta,
  isLateForShift,
  resolveCurrentShiftType,
  shiftDateForAttendance,
  type AttendanceStatus,
  type SwapRequestStatus,
} from "@/config/wfm.config";

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  role: string;
  shiftId?: string | null;
  shiftDate: string;
  shiftType?: ShiftType | null;
  status: AttendanceStatus;
  loggedAt: string;
  source: "LOGIN" | "MANUAL";
  note?: string | null;
}

export interface ShiftSwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterShiftId: string;
  targetUserId: string;
  targetUserName: string;
  targetShiftId: string;
  reason: string;
  status: SwapRequestStatus;
  createdAt: string;
  decidedAt?: string | null;
  decidedById?: string | null;
  decidedByName?: string | null;
  decisionNote?: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function cloneShift(s: NocShiftRow): NocShiftRow {
  return { ...s };
}

/** Mutable roster — seeded from demo + today's NOC/L1 rows so login attendance works. */
let shifts: NocShiftRow[] = (() => {
  const base = MOCK_NOC_SHIFTS.map(cloneShift);
  const today = dateInJakarta();
  const demoDate = DEMO_AS_OF.toISOString().slice(0, 10);
  if (today === demoDate) return base;

  const todayRows: NocShiftRow[] = [
    {
      id: `s-today-noc-1-m`,
      userId: "u-noc-1",
      userName: "Andi Pratama",
      role: "NOC",
      shiftDate: today,
      shiftType: "MORNING",
      status: "SCHEDULED",
      notes: "Roster hari ini · L1",
    },
    {
      id: `s-today-noc-2-m`,
      userId: "u-noc-2",
      userName: "Siti Rahma",
      role: "NOC",
      shiftDate: today,
      shiftType: "MORNING",
      status: "SCHEDULED",
      notes: "Roster hari ini · L1",
    },
    {
      id: `s-today-sup-1-m`,
      userId: "u-sup-1",
      userName: "Dewi Lestari",
      role: "SUPERVISOR",
      shiftDate: today,
      shiftType: "MORNING",
      status: "SCHEDULED",
    },
    {
      id: `s-today-noc-3-a`,
      userId: "u-noc-3",
      userName: "Budi Santoso",
      role: "NOC",
      shiftDate: today,
      shiftType: "AFTERNOON",
      status: "SCHEDULED",
    },
    {
      id: `s-today-noc-1-n`,
      userId: "u-noc-1",
      userName: "Andi Pratama",
      role: "NOC",
      shiftDate: today,
      shiftType: "NIGHT",
      status: "SCHEDULED",
    },
  ];
  return [...todayRows, ...base];
})();

let attendance: AttendanceLog[] = [];
let swaps: ShiftSwapRequest[] = [];

export function listWfmShifts(filter?: {
  date?: string;
  from?: string;
  to?: string;
  userId?: string;
  shiftType?: ShiftType;
}): NocShiftRow[] {
  return shifts
    .filter((s) => (filter?.date ? s.shiftDate === filter.date : true))
    .filter((s) => (filter?.from ? s.shiftDate >= filter.from : true))
    .filter((s) => (filter?.to ? s.shiftDate <= filter.to : true))
    .filter((s) => (filter?.userId ? s.userId === filter.userId : true))
    .filter((s) => (filter?.shiftType ? s.shiftType === filter.shiftType : true))
    .map(cloneShift)
    .sort((a, b) =>
      a.shiftDate === b.shiftDate
        ? a.shiftType.localeCompare(b.shiftType) || a.userName.localeCompare(b.userName)
        : a.shiftDate.localeCompare(b.shiftDate)
    );
}

export function clearShiftsInRange(from: string, to: string): number {
  const before = shifts.length;
  shifts = shifts.filter((s) => s.shiftDate < from || s.shiftDate > to);
  return before - shifts.length;
}

export function upsertShiftRow(input: {
  userId: string;
  userName: string;
  role: NocShiftRow["role"];
  shiftDate: string;
  shiftType: ShiftType;
  status?: ShiftDutyStatus;
  notes?: string | null;
}): NocShiftRow {
  const idx = shifts.findIndex(
    (s) =>
      s.userId === input.userId &&
      s.shiftDate === input.shiftDate &&
      s.shiftType === input.shiftType
  );
  const row: NocShiftRow = {
    id: idx >= 0 ? shifts[idx]!.id : `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: input.userId,
    userName: input.userName,
    role: input.role,
    shiftDate: input.shiftDate,
    shiftType: input.shiftType,
    status: input.status ?? "SCHEDULED",
    notes: input.notes ?? undefined,
  };
  if (idx >= 0) shifts[idx] = row;
  else shifts.push(row);
  return cloneShift(row);
}

export function findShiftById(id: string): NocShiftRow | undefined {
  const found = shifts.find((s) => s.id === id);
  return found ? cloneShift(found) : undefined;
}

export function setShiftDuty(id: string, status: ShiftDutyStatus): NocShiftRow {
  const idx = shifts.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Shift tidak ditemukan.");
  shifts[idx] = { ...shifts[idx]!, status };
  return cloneShift(shifts[idx]!);
}

export function listAttendance(limit = 100): AttendanceLog[] {
  return attendance.slice(0, limit).map((a) => ({ ...a }));
}

export function listSwapRequests(filter?: {
  status?: SwapRequestStatus;
  userId?: string;
}): ShiftSwapRequest[] {
  return swaps
    .filter((s) => (filter?.status ? s.status === filter.status : true))
    .filter((s) =>
      filter?.userId
        ? s.requesterId === filter.userId || s.targetUserId === filter.userId
        : true
    )
    .map((s) => ({ ...s }));
}

export function wfmKpis(now = new Date()) {
  const today = shiftDateForAttendance(now);
  const currentType = resolveCurrentShiftType(now);
  const todayShifts = shifts.filter((s) => s.shiftDate === today);
  const current = todayShifts.filter((s) => s.shiftType === currentType);
  const presentToday = attendance.filter(
    (a) =>
      a.shiftDate === today &&
      (a.status === "PRESENT" || a.status === "LATE")
  );
  const pendingSwaps = swaps.filter((s) => s.status === "PENDING").length;
  return {
    today,
    currentShiftType: currentType,
    rosterToday: todayShifts.length,
    onDutyNow: current.filter((s) => s.status === "ON_DUTY").length,
    presentToday: presentToday.length,
    pendingSwaps,
  };
}

/**
 * Called on successful login for NOC/L1 (and Supervisor on roster).
 * Marks matching roster row ON_DUTY and writes attendance.
 */
export function recordLoginAttendance(
  user: Pick<AuthUser, "id" | "name" | "role">,
  now = new Date()
): AttendanceLog | null {
  if (!(WFM_ATTENDANCE_ROLES as readonly string[]).includes(user.role)) {
    return null;
  }

  const shiftDate = shiftDateForAttendance(now);
  const shiftType = resolveCurrentShiftType(now);
  const stamp = now.toISOString();

  const match = shifts.find(
    (s) =>
      s.userId === user.id &&
      s.shiftDate === shiftDate &&
      s.shiftType === shiftType
  );

  // Idempotent: already punched for this shift today
  const already = attendance.find(
    (a) =>
      a.userId === user.id &&
      a.shiftDate === shiftDate &&
      a.shiftType === shiftType &&
      a.source === "LOGIN" &&
      (a.status === "PRESENT" || a.status === "LATE")
  );
  if (already) return { ...already };

  if (!match) {
    const otherToday = shifts.find(
      (s) => s.userId === user.id && s.shiftDate === shiftDate
    );
    const log: AttendanceLog = {
      id: `att-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      role: user.role,
      shiftId: otherToday?.id ?? null,
      shiftDate,
      shiftType: otherToday?.shiftType ?? shiftType,
      status: otherToday ? "OUT_OF_WINDOW" : "NO_ROSTER",
      loggedAt: stamp,
      source: "LOGIN",
      note: otherToday
        ? `Login di luar jam shift roster (${otherToday.shiftType}). Window aktif: ${shiftType}.`
        : `Login tanpa roster ${shiftDate} / ${shiftType}.`,
    };
    attendance = [log, ...attendance].slice(0, 500);
    return { ...log };
  }

  const late = isLateForShift(shiftType, now);
  const status: AttendanceStatus = late ? "LATE" : "PRESENT";
  const idx = shifts.findIndex((s) => s.id === match.id);
  if (idx >= 0) {
    shifts[idx] = { ...shifts[idx]!, status: "ON_DUTY" };
  }

  const log: AttendanceLog = {
    id: `att-${Date.now()}`,
    userId: user.id,
    userName: user.name,
    role: user.role,
    shiftId: match.id,
    shiftDate,
    shiftType,
    status,
    loggedAt: stamp,
    source: "LOGIN",
    note: `${ATTENDANCE_STATUS_LABELS[status]} · shift ${shiftType} · auto dari login`,
  };
  attendance = [log, ...attendance].slice(0, 500);
  return { ...log };
}

export function createSwapRequest(input: {
  requesterId: string;
  requesterName: string;
  requesterShiftId: string;
  targetShiftId: string;
  reason: string;
}): ShiftSwapRequest {
  const mine = findShiftById(input.requesterShiftId);
  const theirs = findShiftById(input.targetShiftId);
  if (!mine || !theirs) throw new Error("Shift tidak ditemukan.");
  if (mine.userId !== input.requesterId) {
    throw new Error("Shift pemohon tidak sesuai user login.");
  }
  if (theirs.userId === input.requesterId) {
    throw new Error("Tidak bisa tukar dengan shift sendiri.");
  }
  if (mine.shiftDate !== theirs.shiftDate) {
    throw new Error("Tukar shift hanya untuk tanggal yang sama (demo rule).");
  }
  const pendingDup = swaps.find(
    (s) =>
      s.status === "PENDING" &&
      ((s.requesterShiftId === mine.id && s.targetShiftId === theirs.id) ||
        (s.requesterShiftId === theirs.id && s.targetShiftId === mine.id))
  );
  if (pendingDup) throw new Error("Sudah ada permintaan tukar untuk pasangan shift ini.");

  const reason = input.reason.trim();
  if (!reason) throw new Error("Alasan tukar shift wajib diisi.");

  const req: ShiftSwapRequest = {
    id: `swap-${Date.now()}`,
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    requesterShiftId: mine.id,
    targetUserId: theirs.userId,
    targetUserName: theirs.userName,
    targetShiftId: theirs.id,
    reason,
    status: "PENDING",
    createdAt: nowIso(),
  };
  swaps = [req, ...swaps];
  return { ...req };
}

export function decideSwapRequest(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  actorId: string;
  actorName: string;
  decisionNote?: string;
}): ShiftSwapRequest {
  const idx = swaps.findIndex((s) => s.id === input.id);
  if (idx < 0) throw new Error("Permintaan tukar tidak ditemukan.");
  const current = swaps[idx]!;
  if (current.status !== "PENDING") {
    throw new Error("Permintaan sudah diputuskan.");
  }

  if (input.decision === "APPROVED") {
    const aIdx = shifts.findIndex((s) => s.id === current.requesterShiftId);
    const bIdx = shifts.findIndex((s) => s.id === current.targetShiftId);
    if (aIdx < 0 || bIdx < 0) throw new Error("Shift terkait sudah tidak ada.");

    const a = shifts[aIdx]!;
    const b = shifts[bIdx]!;
    // Swap people between shift slots (keep shiftType/date/status of the slot)
    shifts[aIdx] = {
      ...a,
      userId: b.userId,
      userName: b.userName,
      role: b.role,
      notes: `Swap approved · was ${a.userName}`,
    };
    shifts[bIdx] = {
      ...b,
      userId: a.userId,
      userName: a.userName,
      role: a.role,
      notes: `Swap approved · was ${b.userName}`,
    };
  }

  const updated: ShiftSwapRequest = {
    ...current,
    status: input.decision,
    decidedAt: nowIso(),
    decidedById: input.actorId,
    decidedByName: input.actorName,
    decisionNote: input.decisionNote?.trim() || null,
  };
  swaps[idx] = updated;
  return { ...updated };
}

export function cancelSwapRequest(id: string, userId: string): ShiftSwapRequest {
  const idx = swaps.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Permintaan tukar tidak ditemukan.");
  const current = swaps[idx]!;
  if (current.requesterId !== userId) {
    throw new Error("Hanya pemohon yang bisa membatalkan.");
  }
  if (current.status !== "PENDING") {
    throw new Error("Hanya permintaan pending yang bisa dibatalkan.");
  }
  const updated = { ...current, status: "CANCELLED" as const, decidedAt: nowIso() };
  swaps[idx] = updated;
  return { ...updated };
}
