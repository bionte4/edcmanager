import {
  TICKET_STATUS_TRANSITIONS,
  type WorkflowTicketStatus,
} from "@/config/noc.config";
import {
  DEFAULT_PROCESS_BY_TYPE,
  ITSM_TYPE_PREFIX,
  type ItsmType,
  type OperationalProcess,
} from "@/config/itsm.config";
import { computeSlaDeadline, evaluateSlaStatus } from "@/sla";
import {
  evaluateTicketOla,
  formatOlaElapsed,
  type OlaPolicy,
  type TicketOlaBundle,
} from "@/ola";
import {
  DEFAULT_OLA_POLICIES,
  OLA_WARNING_THRESHOLD,
} from "@/config/ola.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";

function defaultOlaPolicies(): OlaPolicy[] {
  const updatedAt = new Date(0).toISOString();
  return DEFAULT_OLA_POLICIES.map((seed) => ({
    id: seed.id,
    name: seed.name,
    stage: seed.stage,
    limitMinutes: seed.limitMinutes,
    warningThreshold: seed.warningThreshold ?? OLA_WARNING_THRESHOLD,
    itsmType: seed.itsmType ?? "*",
    location: seed.location ?? "*",
    category: seed.category ?? "*",
    process: seed.process ?? "*",
    isActive: seed.isActive ?? true,
    priority: seed.priority ?? 0,
    updatedAt,
  }));
}

export type UserRole =
  | "ADMIN"
  | "NOC"
  | "SUPERVISOR"
  | "VENDOR_TECH"
  | "OPS_MANAGER"
  | "GM";
export type ShiftType = "MORNING" | "AFTERNOON" | "NIGHT";
export type ShiftDutyStatus = "SCHEDULED" | "ON_DUTY" | "OFF_DUTY";
export type TicketActivityType =
  | "CREATED"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "NOTE"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED"
  | "HANDOVER";

export interface NocUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
}

export interface NocShiftRow {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  shiftDate: string;
  shiftType: ShiftType;
  status: ShiftDutyStatus;
  notes?: string;
}

export interface TicketActivityRow {
  id: string;
  type: TicketActivityType;
  note: string;
  actorName: string;
  at: string;
  fromStatus?: WorkflowTicketStatus;
  toStatus?: WorkflowTicketStatus;
}

export interface OpsTicket {
  id: string;
  ticketNumber: string;
  itsmType: ItsmType;
  process: OperationalProcess;
  merchantId: string;
  location: TicketLocation;
  category: TicketCategory;
  status: WorkflowTicketStatus;
  description: string;
  vendorName: string;
  technicianName?: string;
  nocOwnerId?: string;
  nocOwnerName?: string;
  createdById?: string;
  createdByName?: string;
  problemId?: string | null;
  relatedChangeId?: string | null;
  externalTicketId?: string | null;
  externalSystem?: string | null;
  openedAt: string;
  closedAt?: string | null;
  acknowledgedAt?: string | null;
  dispatchedAt?: string | null;
  updatedAt?: string;
  activities: TicketActivityRow[];
}

export function canTransition(
  from: WorkflowTicketStatus,
  to: WorkflowTicketStatus
): boolean {
  return (TICKET_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function nextStatuses(from: WorkflowTicketStatus): WorkflowTicketStatus[] {
  return [...TICKET_STATUS_TRANSITIONS[from]];
}

export function createTicket(input: {
  merchantId: string;
  location: TicketLocation;
  category: TicketCategory;
  description: string;
  vendorName: string;
  actor: NocUser;
  itsmType?: ItsmType;
  process?: OperationalProcess;
  problemId?: string;
  relatedChangeId?: string;
  externalTicketId?: string;
  externalSystem?: string;
  openedAt?: Date;
}): OpsTicket {
  const merchantId = input.merchantId.trim().toUpperCase();
  if (!merchantId) throw new Error("Merchant ID wajib diisi.");
  if (!input.description.trim()) throw new Error("Deskripsi wajib diisi.");

  const itsmType = input.itsmType ?? "INCIDENT";
  const process = input.process ?? DEFAULT_PROCESS_BY_TYPE[itsmType];
  const openedAt = input.openedAt ?? new Date();
  const id = `t-${Date.now()}`;
  const ticketNumber = `${ITSM_TYPE_PREFIX[itsmType]}-${openedAt.getFullYear()}-${String(Date.now()).slice(-4)}`;
  const nowIso = openedAt.toISOString();

  return {
    id,
    ticketNumber,
    itsmType,
    process,
    merchantId,
    location: input.location,
    category: input.category,
    status: "OPEN",
    description: input.description.trim(),
    vendorName: input.vendorName,
    createdById: input.actor.id,
    createdByName: input.actor.name,
    nocOwnerId: input.actor.role === "NOC" ? input.actor.id : undefined,
    nocOwnerName: input.actor.role === "NOC" ? input.actor.name : undefined,
    problemId: input.problemId,
    relatedChangeId: input.relatedChangeId,
    externalTicketId: input.externalTicketId?.trim() || null,
    externalSystem: input.externalSystem?.trim() || null,
    openedAt: nowIso,
    updatedAt: nowIso,
    activities: [
      {
        id: `a-${Date.now()}`,
        type: "CREATED",
        note: `${itsmType} dibuat oleh ${input.actor.name} (${process})`,
        actorName: input.actor.name,
        at: nowIso,
        toStatus: "OPEN",
      },
    ],
  };
}

export function assignTicket(
  ticket: OpsTicket,
  noc: NocUser,
  actor: NocUser
): OpsTicket {
  if (noc.role !== "NOC" && noc.role !== "SUPERVISOR") {
    throw new Error("Hanya NOC/Supervisor yang bisa di-assign sebagai owner.");
  }

  return {
    ...ticket,
    nocOwnerId: noc.id,
    nocOwnerName: noc.name,
    activities: [
      {
        id: `a-${Date.now()}`,
        type: "ASSIGNED",
        note: `Di-assign ke ${noc.name} oleh ${actor.name}`,
        actorName: actor.name,
        at: new Date().toISOString(),
      },
      ...ticket.activities,
    ],
  };
}

export function transitionTicket(
  ticket: OpsTicket,
  toStatus: WorkflowTicketStatus,
  actor: NocUser,
  opts?: { technicianName?: string; note?: string }
): OpsTicket {
  if (!canTransition(ticket.status, toStatus)) {
    throw new Error(`Transisi ${ticket.status} → ${toStatus} tidak diizinkan.`);
  }

  const now = new Date().toISOString();
  const next: OpsTicket = {
    ...ticket,
    status: toStatus,
    activities: [
      {
        id: `a-${Date.now()}`,
        type:
          toStatus === "ACKNOWLEDGED"
            ? "ACKNOWLEDGED"
            : toStatus === "RESOLVED"
              ? "RESOLVED"
              : toStatus === "CLOSED"
                ? "CLOSED"
                : "STATUS_CHANGED",
        note: opts?.note?.trim() || `Status diubah ke ${toStatus}`,
        actorName: actor.name,
        at: now,
        fromStatus: ticket.status,
        toStatus,
      },
      ...ticket.activities,
    ],
  };

  if (toStatus === "ACKNOWLEDGED") next.acknowledgedAt = now;
  if (toStatus === "DISPATCHED") {
    next.dispatchedAt = now;
    if (opts?.technicianName?.trim()) {
      next.technicianName = opts.technicianName.trim();
    }
  }
  if (toStatus === "RESOLVED" || toStatus === "CLOSED") {
    next.closedAt = next.closedAt ?? now;
  }

  return next;
}

export function linkIncidentToProblem(
  incident: OpsTicket,
  problemId: string,
  actor: NocUser
): OpsTicket {
  if (incident.itsmType !== "INCIDENT") {
    throw new Error("Hanya Incident yang bisa di-link ke Problem.");
  }
  return {
    ...incident,
    problemId,
    activities: [
      {
        id: `a-${Date.now()}`,
        type: "NOTE",
        note: `Linked ke Problem ${problemId} oleh ${actor.name}`,
        actorName: actor.name,
        at: new Date().toISOString(),
      },
      ...incident.activities,
    ],
  };
}

export function enrichOpsTicket(
  ticket: OpsTicket,
  asOf: Date = new Date(),
  olaPolicies: OlaPolicy[] = defaultOlaPolicies()
) {
  const evaluation = evaluateSlaStatus(
    {
      location: ticket.location,
      category: ticket.category,
      itsmType: ticket.itsmType,
      openedAt: new Date(ticket.openedAt),
      closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
    },
    asOf
  );
  const deadline = computeSlaDeadline(
    ticket.location,
    ticket.category,
    new Date(ticket.openedAt),
    ticket.itsmType
  );

  const ola: TicketOlaBundle = evaluateTicketOla(
    {
      itsmType: ticket.itsmType,
      process: ticket.process,
      location: ticket.location,
      category: ticket.category,
      openedAt: new Date(ticket.openedAt),
      acknowledgedAt: ticket.acknowledgedAt
        ? new Date(ticket.acknowledgedAt)
        : null,
      dispatchedAt: ticket.dispatchedAt ? new Date(ticket.dispatchedAt) : null,
      closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
    },
    olaPolicies,
    asOf
  );

  return {
    ...ticket,
    slaStatus: evaluation.status,
    elapsedLabel: evaluation.duration.formatted,
    remainingMs: evaluation.remainingMs,
    deadlineAt: deadline.toISOString(),
    needsEscalation:
      evaluation.status === "WARNING" || evaluation.status === "BREACHED",
    ola,
    olaAckStatus: ola.acknowledge?.status ?? null,
    olaAckLabel: ola.acknowledge
      ? `${formatOlaElapsed(ola.acknowledge)}`
      : null,
    olaDispatchStatus: ola.dispatch?.status ?? null,
    olaDispatchLabel: ola.dispatch
      ? `${formatOlaElapsed(ola.dispatch)}`
      : null,
    olaNeedsEscalation: ola.needsEscalation,
  };
}
