import {
  LO_SHIFT_LABELS,
  LO_SHIFT_TYPES,
  isLoShiftType,
  oppositeLoShift,
  resolveCurrentLoShiftType,
  type LoShiftType,
} from "@/config/liaison.config";
import { dateInJakarta, parseYmd } from "@/config/wfm.config";
import { listOlaPolicies } from "@/data/ola-store";
import { escalateTicketToLiaison, listOpsTickets } from "@/data/tickets-store";
import {
  enrichOpsTicket,
  type NocShiftRow,
  type NocUser,
  type OpsTicket,
  type ShiftDutyStatus,
} from "@/lib/ticketing";
import { prisma } from "@/lib/prisma";
import type { ShiftType as PrismaShiftType } from "@prisma/client";

function ymdToDate(ymd: string): Date {
  return parseYmd(ymd);
}

export interface HandoverRow {
  id: string;
  shiftDate: string;
  fromShiftType: LoShiftType;
  toShiftType: LoShiftType;
  fromUserId: string;
  fromUserName: string;
  toUserId?: string | null;
  toUserName?: string | null;
  summary: string;
  openTickets: string[];
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface EscalationInboxRow extends OpsTicket {
  slaStatus: string;
  elapsedLabel: string;
  remainingLabel: string;
  needsEscalation: boolean;
  olaNeedsEscalation: boolean;
  escalatedAt?: string | null;
}

function mapLoShift(row: {
  id: string;
  userId: string;
  shiftDate: Date;
  shiftType: string;
  status: string;
  notes: string | null;
  user: { name: string; role: string };
}): NocShiftRow {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    role: row.user.role as NocShiftRow["role"],
    shiftDate: row.shiftDate.toISOString().slice(0, 10),
    shiftType: row.shiftType as NocShiftRow["shiftType"],
    status: row.status as ShiftDutyStatus,
    notes: row.notes ?? undefined,
  };
}

export async function listLiaisonUsers(): Promise<NocUser[]> {
  const rows = await prisma.user.findMany({
    where: { role: "LIAISON", isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? undefined,
    role: "LIAISON",
    isActive: u.isActive,
  }));
}

export async function listLoShifts(filter?: {
  date?: string;
  from?: string;
  to?: string;
}): Promise<NocShiftRow[]> {
  const shiftDateFilter =
    filter?.date || filter?.from || filter?.to
      ? {
          ...(filter.date ? { equals: ymdToDate(filter.date) } : {}),
          ...(filter.from ? { gte: ymdToDate(filter.from) } : {}),
          ...(filter.to ? { lte: ymdToDate(filter.to) } : {}),
        }
      : { equals: ymdToDate(dateInJakarta()) };

  const rows = await prisma.nocShift.findMany({
    where: {
      shiftDate: shiftDateFilter,
      shiftType: { in: [...LO_SHIFT_TYPES] as PrismaShiftType[] },
    },
    include: { user: true },
    orderBy: [{ shiftDate: "asc" }, { shiftType: "asc" }],
  });

  return rows.map(mapLoShift);
}

export async function upsertLoShift(input: {
  userId: string;
  shiftDate: string;
  shiftType: LoShiftType;
  status?: ShiftDutyStatus;
  notes?: string | null;
}): Promise<NocShiftRow> {
  if (!isLoShiftType(input.shiftType)) {
    throw new Error("Shift LO harus DAY_DOG atau NIGHT_DOG.");
  }
  const user = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
  });
  if (!user) throw new Error("User tidak ditemukan.");
  if (
    user.role !== "LIAISON" &&
    user.role !== "SUPERVISOR" &&
    user.role !== "ADMIN"
  ) {
    throw new Error(
      "Roster LO hanya untuk role LIAISON (atau Supervisor/Admin cover)."
    );
  }

  const shiftDate = ymdToDate(input.shiftDate);
  const row = await prisma.nocShift.upsert({
    where: {
      userId_shiftDate_shiftType: {
        userId: input.userId,
        shiftDate,
        shiftType: input.shiftType,
      },
    },
    update: {
      status: input.status ?? "SCHEDULED",
      notes: input.notes ?? null,
    },
    create: {
      userId: input.userId,
      shiftDate,
      shiftType: input.shiftType,
      status: input.status ?? "SCHEDULED",
      notes: input.notes ?? null,
    },
    include: { user: true },
  });
  return mapLoShift(row);
}

export async function setLoShiftDuty(
  id: string,
  status: ShiftDutyStatus
): Promise<NocShiftRow> {
  const existing = await prisma.nocShift.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) throw new Error("Shift LO tidak ditemukan.");
  if (!isLoShiftType(existing.shiftType)) {
    throw new Error("Bukan shift DOG Liaison.");
  }
  const now = new Date();
  const row = await prisma.nocShift.update({
    where: { id },
    data: {
      status,
      startedAt: status === "ON_DUTY" ? now : existing.startedAt,
      endedAt: status === "OFF_DUTY" ? now : null,
    },
    include: { user: true },
  });
  return mapLoShift(row);
}

export async function listHandovers(limit = 30): Promise<HandoverRow[]> {
  const rows = await prisma.handoverLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { fromUser: true, toUser: true },
  });
  return rows.map((r) => ({
    id: r.id,
    shiftDate: r.shiftDate.toISOString().slice(0, 10),
    fromShiftType: r.fromShiftType as LoShiftType,
    toShiftType: r.toShiftType as LoShiftType,
    fromUserId: r.fromUserId,
    fromUserName: r.fromUser.name,
    toUserId: r.toUserId,
    toUserName: r.toUser?.name ?? null,
    summary: r.summary,
    openTickets: r.openTickets,
    acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createHandover(input: {
  actor: NocUser;
  shiftDate?: string;
  fromShiftType?: LoShiftType;
  toUserId?: string;
  summary: string;
  openTickets?: string[];
}): Promise<HandoverRow> {
  const summary = input.summary.trim();
  if (!summary) throw new Error("Ringkasan handover wajib diisi.");

  const fromShiftType = input.fromShiftType ?? resolveCurrentLoShiftType();
  const toShiftType = oppositeLoShift(fromShiftType);
  const shiftDate = ymdToDate(input.shiftDate ?? dateInJakarta());

  if (input.toUserId) {
    const to = await prisma.user.findFirst({
      where: { id: input.toUserId, deletedAt: null, isActive: true },
    });
    if (!to) throw new Error("Penerima handover tidak ditemukan.");
  }

  const openTickets = (input.openTickets ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 40);

  const row = await prisma.handoverLog.create({
    data: {
      shiftDate,
      fromShiftType,
      toShiftType,
      fromUserId: input.actor.id,
      toUserId: input.toUserId || null,
      summary,
      openTickets,
    },
    include: { fromUser: true, toUser: true },
  });

  if (openTickets.length > 0) {
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: openTickets } },
      select: { id: true },
    });
    if (tickets.length > 0) {
      await prisma.ticketActivity.createMany({
        data: tickets.map((t) => ({
          ticketId: t.id,
          actorId: input.actor.id,
          activityType: "HANDOVER" as const,
          note: `Handover LO ${LO_SHIFT_LABELS[fromShiftType]} → ${LO_SHIFT_LABELS[toShiftType]}: ${summary.slice(0, 240)}`,
        })),
      });
    }
  }

  return {
    id: row.id,
    shiftDate: row.shiftDate.toISOString().slice(0, 10),
    fromShiftType: row.fromShiftType as LoShiftType,
    toShiftType: row.toShiftType as LoShiftType,
    fromUserId: row.fromUserId,
    fromUserName: row.fromUser.name,
    toUserId: row.toUserId,
    toUserName: row.toUser?.name ?? null,
    summary: row.summary,
    openTickets: row.openTickets,
    acknowledgedAt: null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function acknowledgeHandover(
  id: string,
  actor: NocUser
): Promise<HandoverRow> {
  const existing = await prisma.handoverLog.findUnique({
    where: { id },
    include: { fromUser: true, toUser: true },
  });
  if (!existing) throw new Error("Handover tidak ditemukan.");
  if (existing.acknowledgedAt) {
    throw new Error("Handover sudah di-acknowledge.");
  }

  const row = await prisma.handoverLog.update({
    where: { id },
    data: {
      acknowledgedAt: new Date(),
      toUserId: existing.toUserId ?? actor.id,
    },
    include: { fromUser: true, toUser: true },
  });

  return {
    id: row.id,
    shiftDate: row.shiftDate.toISOString().slice(0, 10),
    fromShiftType: row.fromShiftType as LoShiftType,
    toShiftType: row.toShiftType as LoShiftType,
    fromUserId: row.fromUserId,
    fromUserName: row.fromUser.name,
    toUserId: row.toUserId,
    toUserName: row.toUser?.name ?? null,
    summary: row.summary,
    openTickets: row.openTickets,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listEscalationInbox(
  asOf = new Date()
): Promise<EscalationInboxRow[]> {
  const tickets = await listOpsTickets();
  const ola = listOlaPolicies({ activeOnly: true });
  return tickets
    .filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED")
    .map((t) => {
      const enriched = enrichOpsTicket(t, asOf, ola);
      const lastEscalated = [...(t.activities ?? [])]
        .filter((a) => a.type === "ESCALATED")
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      return {
        ...t,
        slaStatus: enriched.slaStatus,
        elapsedLabel: enriched.elapsedLabel,
        remainingLabel: enriched.remainingLabel,
        needsEscalation: enriched.needsEscalation,
        olaNeedsEscalation: enriched.olaNeedsEscalation,
        escalatedAt: lastEscalated?.at ?? null,
      };
    })
    .filter((t) => t.needsEscalation || t.olaNeedsEscalation)
    .sort((a, b) => {
      if (a.needsEscalation !== b.needsEscalation) {
        return a.needsEscalation ? -1 : 1;
      }
      return a.openedAt.localeCompare(b.openedAt);
    });
}

export {
  escalateTicketToLiaison,
  resolveCurrentLoShiftType,
  LO_SHIFT_TYPES,
  LO_SHIFT_LABELS,
};
