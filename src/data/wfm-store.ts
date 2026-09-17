import type { AuthUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { NocShiftRow, ShiftDutyStatus, ShiftType } from "@/lib/ticketing";
import {
  ATTENDANCE_STATUS_LABELS,
  WFM_ATTENDANCE_ROLES,
  isLateForShift,
  resolveCurrentShiftType,
  shiftDateForAttendance,
  type AttendanceStatus,
  type SwapRequestStatus,
} from "@/config/wfm.config";
import type {
  AttendanceLog as PrismaAttendance,
  NocShift,
  ShiftSwapRequest as PrismaSwap,
  ShiftType as PrismaShiftType,
  User,
} from "@prisma/client";

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

type ShiftWithUser = NocShift & { user: User };

/** YYYY-MM-DD → UTC date-only for `@db.Date` columns. */
function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapShift(row: ShiftWithUser): NocShiftRow {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    role: row.user.role as NocShiftRow["role"],
    shiftDate: dateToYmd(row.shiftDate),
    shiftType: row.shiftType as ShiftType,
    status: row.status as ShiftDutyStatus,
    notes: row.notes ?? undefined,
  };
}

function mapAttendance(row: PrismaAttendance): AttendanceLog {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    role: row.role,
    shiftId: row.shiftId,
    shiftDate: dateToYmd(row.shiftDate),
    shiftType: (row.shiftType as ShiftType | null) ?? null,
    status: row.status as AttendanceStatus,
    loggedAt: row.loggedAt.toISOString(),
    source: row.source as AttendanceLog["source"],
    note: row.note,
  };
}

function mapSwap(row: PrismaSwap): ShiftSwapRequest {
  return {
    id: row.id,
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    requesterShiftId: row.requesterShiftId,
    targetUserId: row.targetUserId,
    targetUserName: row.targetUserName,
    targetShiftId: row.targetShiftId,
    reason: row.reason,
    status: row.status as SwapRequestStatus,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedById: row.decidedById,
    decidedByName: row.decidedByName,
    decisionNote: row.decisionNote,
  };
}

export async function listWfmShifts(filter?: {
  date?: string;
  from?: string;
  to?: string;
  userId?: string;
  shiftType?: ShiftType;
}): Promise<NocShiftRow[]> {
  const shiftDateFilter =
    filter?.date || filter?.from || filter?.to
      ? {
          ...(filter.date ? { equals: ymdToDate(filter.date) } : {}),
          ...(filter.from ? { gte: ymdToDate(filter.from) } : {}),
          ...(filter.to ? { lte: ymdToDate(filter.to) } : {}),
        }
      : undefined;

  const rows = await prisma.nocShift.findMany({
    where: {
      ...(shiftDateFilter ? { shiftDate: shiftDateFilter } : {}),
      ...(filter?.userId ? { userId: filter.userId } : {}),
      ...(filter?.shiftType
        ? { shiftType: filter.shiftType as PrismaShiftType }
        : {}),
    },
    include: { user: true },
    orderBy: [{ shiftDate: "asc" }, { shiftType: "asc" }],
  });

  return rows
    .map(mapShift)
    .sort((a, b) =>
      a.shiftDate === b.shiftDate
        ? a.shiftType.localeCompare(b.shiftType) ||
          a.userName.localeCompare(b.userName)
        : a.shiftDate.localeCompare(b.shiftDate)
    );
}

export async function clearShiftsInRange(from: string, to: string): Promise<number> {
  const result = await prisma.nocShift.deleteMany({
    where: {
      shiftDate: {
        gte: ymdToDate(from),
        lte: ymdToDate(to),
      },
    },
  });
  return result.count;
}

export async function upsertShiftRow(input: {
  userId: string;
  userName: string;
  role: NocShiftRow["role"];
  shiftDate: string;
  shiftType: ShiftType;
  status?: ShiftDutyStatus;
  notes?: string | null;
}): Promise<NocShiftRow> {
  const shiftDate = ymdToDate(input.shiftDate);
  const shiftType = input.shiftType as PrismaShiftType;
  const status = (input.status ?? "SCHEDULED") as ShiftDutyStatus;

  const row = await prisma.nocShift.upsert({
    where: {
      userId_shiftDate_shiftType: {
        userId: input.userId,
        shiftDate,
        shiftType,
      },
    },
    update: {
      status,
      notes: input.notes ?? null,
    },
    create: {
      userId: input.userId,
      shiftDate,
      shiftType,
      status,
      notes: input.notes ?? null,
    },
    include: { user: true },
  });

  return mapShift(row);
}

export async function findShiftById(id: string): Promise<NocShiftRow | undefined> {
  const row = await prisma.nocShift.findUnique({
    where: { id },
    include: { user: true },
  });
  return row ? mapShift(row) : undefined;
}

export async function setShiftDuty(
  id: string,
  status: ShiftDutyStatus
): Promise<NocShiftRow> {
  try {
    const row = await prisma.nocShift.update({
      where: { id },
      data: { status },
      include: { user: true },
    });
    return mapShift(row);
  } catch {
    throw new Error("Shift tidak ditemukan.");
  }
}

export async function listAttendance(limit = 100): Promise<AttendanceLog[]> {
  const rows = await prisma.attendanceLog.findMany({
    orderBy: { loggedAt: "desc" },
    take: limit,
  });
  return rows.map(mapAttendance);
}

export async function listSwapRequests(filter?: {
  status?: SwapRequestStatus;
  userId?: string;
}): Promise<ShiftSwapRequest[]> {
  const rows = await prisma.shiftSwapRequest.findMany({
    where: {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.userId
        ? {
            OR: [
              { requesterId: filter.userId },
              { targetUserId: filter.userId },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapSwap);
}

export async function wfmKpis(now = new Date()) {
  const today = shiftDateForAttendance(now);
  const todayDate = ymdToDate(today);
  const currentType = resolveCurrentShiftType(now);

  const [todayShifts, presentToday, pendingSwaps] = await Promise.all([
    prisma.nocShift.findMany({
      where: { shiftDate: todayDate },
      include: { user: true },
    }),
    prisma.attendanceLog.count({
      where: {
        shiftDate: todayDate,
        status: { in: ["PRESENT", "LATE"] },
      },
    }),
    prisma.shiftSwapRequest.count({ where: { status: "PENDING" } }),
  ]);

  const current = todayShifts.filter((s) => s.shiftType === currentType);
  return {
    today,
    currentShiftType: currentType,
    rosterToday: todayShifts.length,
    onDutyNow: current.filter((s) => s.status === "ON_DUTY").length,
    presentToday,
    pendingSwaps,
  };
}

/**
 * Called on successful login for NOC/L1 (and Supervisor on roster).
 * Marks matching roster row ON_DUTY and writes attendance.
 */
export async function recordLoginAttendance(
  user: Pick<AuthUser, "id" | "name" | "role">,
  now = new Date()
): Promise<AttendanceLog | null> {
  if (!(WFM_ATTENDANCE_ROLES as readonly string[]).includes(user.role)) {
    return null;
  }

  const shiftDate = shiftDateForAttendance(now);
  const shiftDateDb = ymdToDate(shiftDate);
  const shiftType = resolveCurrentShiftType(now);

  const already = await prisma.attendanceLog.findFirst({
    where: {
      userId: user.id,
      shiftDate: shiftDateDb,
      shiftType: shiftType as PrismaShiftType,
      source: "LOGIN",
      status: { in: ["PRESENT", "LATE"] },
    },
  });
  if (already) return mapAttendance(already);

  const match = await prisma.nocShift.findFirst({
    where: {
      userId: user.id,
      shiftDate: shiftDateDb,
      shiftType: shiftType as PrismaShiftType,
    },
    include: { user: true },
  });

  if (!match) {
    const otherToday = await prisma.nocShift.findFirst({
      where: { userId: user.id, shiftDate: shiftDateDb },
      include: { user: true },
    });
    const log = await prisma.attendanceLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        role: user.role,
        shiftId: otherToday?.id ?? null,
        shiftDate: shiftDateDb,
        shiftType: (otherToday?.shiftType ??
          (shiftType as PrismaShiftType)) as PrismaShiftType,
        status: otherToday ? "OUT_OF_WINDOW" : "NO_ROSTER",
        loggedAt: now,
        source: "LOGIN",
        note: otherToday
          ? `Login di luar jam shift roster (${otherToday.shiftType}). Window aktif: ${shiftType}.`
          : `Login tanpa roster ${shiftDate} / ${shiftType}.`,
      },
    });
    return mapAttendance(log);
  }

  const late = isLateForShift(shiftType, now);
  const status: AttendanceStatus = late ? "LATE" : "PRESENT";

  const [, log] = await prisma.$transaction([
    prisma.nocShift.update({
      where: { id: match.id },
      data: { status: "ON_DUTY" },
    }),
    prisma.attendanceLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        role: user.role,
        shiftId: match.id,
        shiftDate: shiftDateDb,
        shiftType: shiftType as PrismaShiftType,
        status,
        loggedAt: now,
        source: "LOGIN",
        note: `${ATTENDANCE_STATUS_LABELS[status]} · shift ${shiftType} · auto dari login`,
      },
    }),
  ]);

  return mapAttendance(log);
}

export async function createSwapRequest(input: {
  requesterId: string;
  requesterName: string;
  requesterShiftId: string;
  targetShiftId: string;
  reason: string;
}): Promise<ShiftSwapRequest> {
  const mine = await findShiftById(input.requesterShiftId);
  const theirs = await findShiftById(input.targetShiftId);
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

  const pendingDup = await prisma.shiftSwapRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [
        {
          requesterShiftId: mine.id,
          targetShiftId: theirs.id,
        },
        {
          requesterShiftId: theirs.id,
          targetShiftId: mine.id,
        },
      ],
    },
  });
  if (pendingDup) {
    throw new Error("Sudah ada permintaan tukar untuk pasangan shift ini.");
  }

  const reason = input.reason.trim();
  if (!reason) throw new Error("Alasan tukar shift wajib diisi.");

  const req = await prisma.shiftSwapRequest.create({
    data: {
      requesterId: input.requesterId,
      requesterName: input.requesterName,
      requesterShiftId: mine.id,
      targetUserId: theirs.userId,
      targetUserName: theirs.userName,
      targetShiftId: theirs.id,
      reason,
      status: "PENDING",
    },
  });
  return mapSwap(req);
}

export async function decideSwapRequest(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  actorId: string;
  actorName: string;
  decisionNote?: string;
}): Promise<ShiftSwapRequest> {
  const current = await prisma.shiftSwapRequest.findUnique({
    where: { id: input.id },
  });
  if (!current) throw new Error("Permintaan tukar tidak ditemukan.");
  if (current.status !== "PENDING") {
    throw new Error("Permintaan sudah diputuskan.");
  }

  if (input.decision === "APPROVED") {
    const [a, b] = await Promise.all([
      prisma.nocShift.findUnique({
        where: { id: current.requesterShiftId },
        include: { user: true },
      }),
      prisma.nocShift.findUnique({
        where: { id: current.targetShiftId },
        include: { user: true },
      }),
    ]);
    if (!a || !b) throw new Error("Shift terkait sudah tidak ada.");

    // Swap people between slots; delete+recreate avoids unique(userId,date,type) clashes.
    await prisma.$transaction(async (tx) => {
      await tx.nocShift.delete({ where: { id: a.id } });
      await tx.nocShift.delete({ where: { id: b.id } });
      await tx.nocShift.create({
        data: {
          id: a.id,
          userId: b.userId,
          shiftDate: a.shiftDate,
          shiftType: a.shiftType,
          status: a.status,
          startedAt: a.startedAt,
          endedAt: a.endedAt,
          notes: `Swap approved · was ${a.user.name}`,
        },
      });
      await tx.nocShift.create({
        data: {
          id: b.id,
          userId: a.userId,
          shiftDate: b.shiftDate,
          shiftType: b.shiftType,
          status: b.status,
          startedAt: b.startedAt,
          endedAt: b.endedAt,
          notes: `Swap approved · was ${b.user.name}`,
        },
      });
    });
  }

  const updated = await prisma.shiftSwapRequest.update({
    where: { id: input.id },
    data: {
      status: input.decision,
      decidedAt: new Date(),
      decidedById: input.actorId,
      decidedByName: input.actorName,
      decisionNote: input.decisionNote?.trim() || null,
    },
  });
  return mapSwap(updated);
}

export async function cancelSwapRequest(
  id: string,
  userId: string
): Promise<ShiftSwapRequest> {
  const current = await prisma.shiftSwapRequest.findUnique({ where: { id } });
  if (!current) throw new Error("Permintaan tukar tidak ditemukan.");
  if (current.requesterId !== userId) {
    throw new Error("Hanya pemohon yang bisa membatalkan.");
  }
  if (current.status !== "PENDING") {
    throw new Error("Hanya permintaan pending yang bisa dibatalkan.");
  }
  const updated = await prisma.shiftSwapRequest.update({
    where: { id },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  return mapSwap(updated);
}
