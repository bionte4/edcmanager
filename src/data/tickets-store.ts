import { MOCK_OPS_TICKETS } from "@/data/noc";
import { listOlaPolicies } from "@/data/ola-store";
import {
  createTicket,
  enrichOpsTicket,
  transitionTicket,
  type NocUser,
  type OpsTicket,
} from "@/lib/ticketing";
import type { WorkflowTicketStatus } from "@/config/noc.config";
import type { ItsmType, OperationalProcess } from "@/config/itsm.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";

/** Shared in-memory ticket store for Integration API (demo). */
let tickets: OpsTicket[] = MOCK_OPS_TICKETS.map((t) => ({
  ...t,
  updatedAt: t.openedAt,
  activities: [...t.activities],
}));

const SYSTEM_ACTOR: NocUser = {
  id: "u-integration",
  name: "Integration API",
  email: "integration@edc.local",
  role: "OPS_MANAGER",
  isActive: true,
};

export function listIntegrationTickets(filters?: {
  itsmType?: ItsmType;
  status?: WorkflowTicketStatus;
  externalSystem?: string;
  updatedSince?: string;
}): OpsTicket[] {
  return tickets
    .filter((t) => {
      if (filters?.itsmType && t.itsmType !== filters.itsmType) return false;
      if (filters?.status && t.status !== filters.status) return false;
      if (filters?.externalSystem && t.externalSystem !== filters.externalSystem) {
        return false;
      }
      if (filters?.updatedSince) {
        const since = Date.parse(filters.updatedSince);
        const updated = Date.parse(t.updatedAt ?? t.openedAt);
        if (Number.isFinite(since) && updated < since) return false;
      }
      return true;
    })
    .map((t) => ({ ...t, activities: [...t.activities] }));
}

export function getTicketById(id: string): OpsTicket | undefined {
  return tickets.find((t) => t.id === id || t.ticketNumber === id);
}

export function getTicketByExternal(
  externalSystem: string,
  externalTicketId: string
): OpsTicket | undefined {
  return tickets.find(
    (t) =>
      t.externalSystem === externalSystem &&
      t.externalTicketId === externalTicketId
  );
}

export function createIntegrationTicket(input: {
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
}): OpsTicket {
  const externalTicketId = input.externalTicketId.trim();
  const externalSystem = input.externalSystem.trim();
  if (!externalTicketId || !externalSystem) {
    throw new Error("externalTicketId and externalSystem are required");
  }

  const existing = getTicketByExternal(externalSystem, externalTicketId);
  if (existing) {
    throw Object.assign(
      new Error(
        `Ticket already exists for ${externalSystem}/${externalTicketId}`
      ),
      { status: 409, existing }
    );
  }

  const ticket = createTicket({
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

  tickets = [ticket, ...tickets];
  return { ...ticket };
}

export function patchIntegrationTicket(
  id: string,
  patch: {
    status?: WorkflowTicketStatus;
    description?: string;
    technicianName?: string;
    problemId?: string;
    relatedChangeId?: string;
  }
): OpsTicket {
  const idx = tickets.findIndex((t) => t.id === id || t.ticketNumber === id);
  if (idx < 0) throw Object.assign(new Error("Ticket not found"), { status: 404 });

  let current = tickets[idx]!;

  if (patch.status && patch.status !== current.status) {
    current = transitionTicket(current, patch.status, SYSTEM_ACTOR, {
      technicianName: patch.technicianName,
      note: `Status synced via Integration API → ${patch.status}`,
    });
  }

  const now = new Date().toISOString();
  current = {
    ...current,
    description: patch.description?.trim() || current.description,
    technicianName: patch.technicianName?.trim() || current.technicianName,
    problemId: patch.problemId ?? current.problemId,
    relatedChangeId: patch.relatedChangeId ?? current.relatedChangeId,
    updatedAt: now,
  };

  tickets[idx] = current;
  return { ...current, activities: [...current.activities] };
}

export function addTicketEvent(
  id: string,
  note: string
): OpsTicket {
  const idx = tickets.findIndex((t) => t.id === id || t.ticketNumber === id);
  if (idx < 0) throw Object.assign(new Error("Ticket not found"), { status: 404 });
  if (!note.trim()) throw new Error("note is required");

  const now = new Date().toISOString();
  const current = tickets[idx]!;
  const updated: OpsTicket = {
    ...current,
    updatedAt: now,
    activities: [
      {
        id: `a-${Date.now()}`,
        type: "NOTE",
        note: note.trim(),
        actorName: SYSTEM_ACTOR.name,
        at: now,
      },
      ...current.activities,
    ],
  };
  tickets[idx] = updated;
  return { ...updated, activities: [...updated.activities] };
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
