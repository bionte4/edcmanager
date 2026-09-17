import { listOlaPolicies } from "@/data/ola-store";
import {
  createTicket,
  enrichOpsTicket,
  transitionTicket,
  type NocUser,
  type OpsTicket,
  type TicketActivityRow,
} from "@/lib/ticketing";
import { prisma } from "@/lib/prisma";
import { computeSlaDeadline, evaluateSlaStatus } from "@/sla";
import type { WorkflowTicketStatus } from "@/config/noc.config";
import type { ItsmType, OperationalProcess } from "@/config/itsm.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";
import type {
  Prisma,
  Ticket,
  TicketActivity,
  TicketActivityType,
  TicketStatus,
  User,
  Vendor,
} from "@prisma/client";

const SYSTEM_ACTOR: NocUser = {
  id: "u-integration",
  name: "Integration API",
  email: "integration@edc.local",
  role: "OPS_MANAGER",
  isActive: true,
};

const ticketInclude = {
  vendor: true,
  nocOwner: true,
  createdBy: true,
  activities: {
    include: { actor: true },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Ticket & {
  vendor: Vendor;
  nocOwner: User | null;
  createdBy: User | null;
  activities: (TicketActivity & { actor: User | null })[];
};

function mapActivity(
  row: TicketActivity & { actor: User | null }
): TicketActivityRow {
  return {
    id: row.id,
    type: row.activityType as TicketActivityRow["type"],
    note: row.note ?? "",
    actorName: row.actor?.name ?? SYSTEM_ACTOR.name,
    at: row.createdAt.toISOString(),
    fromStatus: (row.fromStatus as WorkflowTicketStatus | null) ?? undefined,
    toStatus: (row.toStatus as WorkflowTicketStatus | null) ?? undefined,
  };
}

function mapTicket(row: TicketWithRelations): OpsTicket {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    itsmType: row.itsmType as ItsmType,
    process: row.process as OperationalProcess,
    merchantId: row.merchantId,
    location: row.location,
    category: row.category as TicketCategory,
    status: row.status as WorkflowTicketStatus,
    description: row.description ?? "",
    vendorName: row.vendor.name,
    technicianName: row.technicianName ?? undefined,
    nocOwnerId: row.nocOwnerId ?? undefined,
    nocOwnerName: row.nocOwner?.name,
    createdById: row.createdById ?? undefined,
    createdByName: row.createdBy?.name,
    problemId: row.problemId,
    relatedChangeId: row.relatedChangeId,
    externalTicketId: row.externalTicketId,
    externalSystem: row.externalSystem,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    activities: row.activities.map(mapActivity),
  };
}

async function findTicketRow(
  idOrNumber: string
): Promise<TicketWithRelations | null> {
  const byId = await prisma.ticket.findFirst({
    where: {
      OR: [{ id: idOrNumber }, { ticketNumber: idOrNumber }],
    },
    include: ticketInclude,
  });
  return byId;
}

async function resolveVendorId(vendorName: string): Promise<string> {
  const name = vendorName.trim() || "Vendor 1";
  const vendor = await prisma.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, isActive: true },
  });
  if (!vendor) {
    throw new Error(`Vendor tidak ditemukan: ${name}`);
  }
  return vendor.id;
}

function persistedSlaStatus(
  ticket: Pick<OpsTicket, "location" | "category" | "itsmType" | "openedAt" | "closedAt">,
  asOf = new Date()
) {
  return evaluateSlaStatus(
    {
      location: ticket.location,
      category: ticket.category,
      itsmType: ticket.itsmType,
      openedAt: new Date(ticket.openedAt),
      closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
    },
    asOf
  ).status;
}

export async function listIntegrationTickets(filters?: {
  itsmType?: ItsmType;
  status?: WorkflowTicketStatus;
  externalSystem?: string;
  updatedSince?: string;
}): Promise<OpsTicket[]> {
  const where: Prisma.TicketWhereInput = {};
  if (filters?.itsmType) where.itsmType = filters.itsmType;
  if (filters?.status) where.status = filters.status as TicketStatus;
  if (filters?.externalSystem) where.externalSystem = filters.externalSystem;
  if (filters?.updatedSince) {
    const since = new Date(filters.updatedSince);
    if (Number.isFinite(since.getTime())) {
      where.updatedAt = { gte: since };
    }
  }

  const rows = await prisma.ticket.findMany({
    where,
    include: ticketInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapTicket);
}

/** Ops UI listing — same DB source as integration list. */
export async function listOpsTickets(): Promise<OpsTicket[]> {
  return listIntegrationTickets();
}

export async function getTicketById(
  id: string
): Promise<OpsTicket | undefined> {
  const row = await findTicketRow(id);
  return row ? mapTicket(row) : undefined;
}

export async function getTicketByExternal(
  externalSystem: string,
  externalTicketId: string
): Promise<OpsTicket | undefined> {
  const row = await prisma.ticket.findFirst({
    where: { externalSystem, externalTicketId },
    include: ticketInclude,
  });
  return row ? mapTicket(row) : undefined;
}

export async function createIntegrationTicket(input: {
  merchantId: string;
  location: TicketLocation;
  category: TicketCategory;
  description: string;
  vendorName?: string;
  itsmType?: ItsmType;
  process?: OperationalProcess;
  externalTicketId: string;
  externalSystem: string;
  openedAt?: string;
}): Promise<OpsTicket> {
  const externalTicketId = input.externalTicketId.trim();
  const externalSystem = input.externalSystem.trim();
  if (!externalTicketId || !externalSystem) {
    throw new Error("externalTicketId and externalSystem are required");
  }

  const existing = await getTicketByExternal(externalSystem, externalTicketId);
  if (existing) {
    throw Object.assign(
      new Error(
        `Ticket already exists for ${externalSystem}/${externalTicketId}`
      ),
      { status: 409, existing }
    );
  }

  const draft = createTicket({
    merchantId: input.merchantId,
    location: input.location,
    category: input.category,
    description: input.description,
    vendorName: input.vendorName ?? "Vendor 1",
    actor: SYSTEM_ACTOR,
    itsmType: input.itsmType,
    process: input.process,
    externalTicketId,
    externalSystem,
    openedAt: input.openedAt ? new Date(input.openedAt) : new Date(),
  });

  const vendorId = await resolveVendorId(draft.vendorName);
  const openedAt = new Date(draft.openedAt);
  const deadline = computeSlaDeadline(
    draft.location,
    draft.category,
    openedAt,
    draft.itsmType
  );
  const slaStatus = persistedSlaStatus(draft, openedAt);

  const created = await prisma.ticket.create({
    data: {
      ticketNumber: draft.ticketNumber,
      itsmType: draft.itsmType,
      process: draft.process,
      merchantId: draft.merchantId,
      location: draft.location,
      category: draft.category,
      status: draft.status as TicketStatus,
      slaStatus,
      openedAt,
      slaDeadlineAt: deadline,
      description: draft.description,
      externalTicketId: draft.externalTicketId,
      externalSystem: draft.externalSystem,
      vendorId,
      activities: {
        create: draft.activities.map((a) => ({
          activityType: a.type as TicketActivityType,
          note: a.note,
          toStatus: (a.toStatus as TicketStatus | undefined) ?? null,
          fromStatus: (a.fromStatus as TicketStatus | undefined) ?? null,
          createdAt: new Date(a.at),
        })),
      },
    },
    include: ticketInclude,
  });

  return mapTicket(created);
}

export async function patchIntegrationTicket(
  id: string,
  patch: {
    status?: WorkflowTicketStatus;
    description?: string;
    technicianName?: string;
    problemId?: string;
    relatedChangeId?: string;
  }
): Promise<OpsTicket> {
  const row = await findTicketRow(id);
  if (!row) {
    throw Object.assign(new Error("Ticket not found"), { status: 404 });
  }

  let current = mapTicket(row);
  const previousActivityIds = new Set(current.activities.map((a) => a.id));

  if (patch.status && patch.status !== current.status) {
    current = transitionTicket(current, patch.status, SYSTEM_ACTOR, {
      technicianName: patch.technicianName,
      note: `Status synced via Integration API → ${patch.status}`,
    });
  }

  const now = new Date();
  current = {
    ...current,
    description: patch.description?.trim() || current.description,
    technicianName: patch.technicianName?.trim() || current.technicianName,
    problemId: patch.problemId ?? current.problemId,
    relatedChangeId: patch.relatedChangeId ?? current.relatedChangeId,
    updatedAt: now.toISOString(),
  };

  const newActivities = current.activities.filter(
    (a) => !previousActivityIds.has(a.id)
  );

  const slaStatus = persistedSlaStatus(current, now);

  const updated = await prisma.ticket.update({
    where: { id: row.id },
    data: {
      status: current.status as TicketStatus,
      description: current.description,
      technicianName: current.technicianName ?? null,
      problemId: current.problemId ?? null,
      relatedChangeId: current.relatedChangeId ?? null,
      acknowledgedAt: current.acknowledgedAt
        ? new Date(current.acknowledgedAt)
        : null,
      dispatchedAt: current.dispatchedAt
        ? new Date(current.dispatchedAt)
        : null,
      closedAt: current.closedAt ? new Date(current.closedAt) : null,
      slaStatus,
      activities: {
        create: newActivities.map((a) => ({
          activityType: a.type as TicketActivityType,
          note: a.note,
          fromStatus: (a.fromStatus as TicketStatus | undefined) ?? null,
          toStatus: (a.toStatus as TicketStatus | undefined) ?? null,
          createdAt: new Date(a.at),
        })),
      },
    },
    include: ticketInclude,
  });

  return mapTicket(updated);
}

export async function addTicketEvent(
  id: string,
  note: string
): Promise<OpsTicket> {
  const row = await findTicketRow(id);
  if (!row) {
    throw Object.assign(new Error("Ticket not found"), { status: 404 });
  }
  if (!note.trim()) throw new Error("note is required");

  const updated = await prisma.ticket.update({
    where: { id: row.id },
    data: {
      activities: {
        create: {
          activityType: "NOTE",
          note: note.trim(),
        },
      },
    },
    include: ticketInclude,
  });

  return mapTicket(updated);
}

export function toIntegrationDto(ticket: OpsTicket, asOf = new Date()) {
  const enriched = enrichOpsTicket(
    ticket,
    asOf,
    listOlaPolicies({ activeOnly: true })
  );
  return {
    id: enriched.id,
    ticketNumber: enriched.ticketNumber,
    itsmType: enriched.itsmType,
    process: enriched.process,
    merchantId: enriched.merchantId,
    location: enriched.location,
    category: enriched.category,
    status: enriched.status,
    slaStatus: enriched.slaStatus,
    description: enriched.description,
    vendorName: enriched.vendorName,
    technicianName: enriched.technicianName ?? null,
    externalTicketId: enriched.externalTicketId ?? null,
    externalSystem: enriched.externalSystem ?? null,
    problemId: enriched.problemId ?? null,
    relatedChangeId: enriched.relatedChangeId ?? null,
    openedAt: enriched.openedAt,
    closedAt: enriched.closedAt ?? null,
    acknowledgedAt: enriched.acknowledgedAt ?? null,
    dispatchedAt: enriched.dispatchedAt ?? null,
    updatedAt: enriched.updatedAt ?? enriched.openedAt,
    sla: {
      status: enriched.slaStatus,
      elapsed: enriched.elapsedLabel,
      deadlineAt: enriched.deadlineAt,
      needsEscalation: enriched.needsEscalation,
    },
    ola: {
      needsEscalation: enriched.olaNeedsEscalation,
      acknowledge: enriched.ola.acknowledge
        ? {
            status: enriched.ola.acknowledge.status,
            policyId: enriched.ola.acknowledge.policyId,
            policyName: enriched.ola.acknowledge.policyName,
            limitMinutes: enriched.ola.acknowledge.limitMinutes,
            deadlineAt: enriched.ola.acknowledge.deadlineAt.toISOString(),
            remainingMs: enriched.ola.acknowledge.remainingMs,
          }
        : null,
      dispatch: enriched.ola.dispatch
        ? {
            status: enriched.ola.dispatch.status,
            policyId: enriched.ola.dispatch.policyId,
            policyName: enriched.ola.dispatch.policyName,
            limitMinutes: enriched.ola.dispatch.limitMinutes,
            deadlineAt: enriched.ola.dispatch.deadlineAt.toISOString(),
            remainingMs: enriched.ola.dispatch.remainingMs,
          }
        : null,
    },
    activities: enriched.activities.map((a) => ({
      type: a.type,
      note: a.note,
      actorName: a.actorName,
      at: a.at,
      fromStatus: a.fromStatus ?? null,
      toStatus: a.toStatus ?? null,
    })),
  };
}
