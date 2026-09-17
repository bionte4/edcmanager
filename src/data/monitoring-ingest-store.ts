import {
  MONITORING_INGEST_CONFIG,
  categoryForSeverity,
  shouldCreateTicketFromSeverity,
  type IngestOutcome,
} from "@/config/monitoring-ingest.config";
import type { TicketLocation } from "@/config/sla.config";
import { findAssetBySerial } from "@/data/assets-store";
import { listLocations } from "@/data/locations-store";
import {
  createIntegrationTicket,
  getTicketByExternal,
  toIntegrationDto,
} from "@/data/tickets-store";
import { prisma } from "@/lib/prisma";
import { dateInJakarta } from "@/config/wfm.config";

export interface MonitoringEventInput {
  eventId: string;
  occurredAt?: string;
  severity: string;
  serialNumber?: string;
  merchantId?: string;
  locationCode?: string;
  alertCode?: string;
  message: string;
  vendorName?: string;
}

export interface IngestEventRow {
  id: string;
  sourceSystem: string;
  externalEventId: string;
  severityCode?: string | null;
  serialNumber?: string | null;
  merchantId?: string | null;
  alertCode?: string | null;
  matchedRule?: string | null;
  outcome: IngestOutcome | string;
  ticketId?: string | null;
  ticketNumber?: string | null;
  errorMessage?: string | null;
  receivedAt: string;
  payloadJson: string;
}

export interface ProcessMonitoringResult {
  outcome: IngestOutcome;
  ingest: IngestEventRow;
  ticket?: ReturnType<typeof toIntegrationDto>;
  skippedReason?: string;
}

function jakartaDayKey(iso?: string): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return dateInJakarta(d);
  }
  return dateInJakarta();
}

function buildExternalTicketId(input: MonitoringEventInput): string {
  const day = jakartaDayKey(input.occurredAt);
  const serial = input.serialNumber?.trim().toUpperCase();
  const alert = (input.alertCode ?? "ALERT").trim().toUpperCase();
  if (MONITORING_INGEST_CONFIG.dedupeDayBucket && serial) {
    return `${serial}:${alert}:${day}`;
  }
  return input.eventId.trim();
}

async function resolveLocationCode(input: {
  locationCode?: string;
  regionalOffice?: string | null;
}): Promise<TicketLocation> {
  if (input.locationCode?.trim()) {
    return input.locationCode.trim() as TicketLocation;
  }
  if (input.regionalOffice?.trim()) {
    const locs = await listLocations({ activeOnly: true, ticketSelectableOnly: true });
    const match = locs.find(
      (l) =>
        l.regionalOffice &&
        l.regionalOffice.toLowerCase() === input.regionalOffice!.trim().toLowerCase()
    );
    if (match) return match.code as TicketLocation;
  }
  return MONITORING_INGEST_CONFIG.defaultLocation as TicketLocation;
}

function mapIngest(row: {
  id: string;
  sourceSystem: string;
  externalEventId: string;
  payloadJson: string;
  severityCode: string | null;
  serialNumber: string | null;
  merchantId: string | null;
  alertCode: string | null;
  matchedRule: string | null;
  outcome: string;
  ticketId: string | null;
  ticketNumber: string | null;
  errorMessage: string | null;
  receivedAt: Date;
}): IngestEventRow {
  return {
    id: row.id,
    sourceSystem: row.sourceSystem,
    externalEventId: row.externalEventId,
    severityCode: row.severityCode,
    serialNumber: row.serialNumber,
    merchantId: row.merchantId,
    alertCode: row.alertCode,
    matchedRule: row.matchedRule,
    outcome: row.outcome,
    ticketId: row.ticketId,
    ticketNumber: row.ticketNumber,
    errorMessage: row.errorMessage,
    receivedAt: row.receivedAt.toISOString(),
    payloadJson: row.payloadJson,
  };
}

async function upsertIngestLog(input: {
  sourceSystem: string;
  externalEventId: string;
  payloadJson: string;
  severityCode?: string | null;
  serialNumber?: string | null;
  merchantId?: string | null;
  alertCode?: string | null;
  matchedRule?: string | null;
  outcome: IngestOutcome;
  ticketId?: string | null;
  ticketNumber?: string | null;
  errorMessage?: string | null;
}): Promise<IngestEventRow> {
  const row = await prisma.ingestEvent.upsert({
    where: {
      sourceSystem_externalEventId: {
        sourceSystem: input.sourceSystem,
        externalEventId: input.externalEventId,
      },
    },
    create: {
      sourceSystem: input.sourceSystem,
      externalEventId: input.externalEventId,
      payloadJson: input.payloadJson,
      severityCode: input.severityCode ?? null,
      serialNumber: input.serialNumber ?? null,
      merchantId: input.merchantId ?? null,
      alertCode: input.alertCode ?? null,
      matchedRule: input.matchedRule ?? null,
      outcome: input.outcome,
      ticketId: input.ticketId ?? null,
      ticketNumber: input.ticketNumber ?? null,
      errorMessage: input.errorMessage ?? null,
    },
    update: {
      outcome: input.outcome,
      matchedRule: input.matchedRule ?? null,
      ticketId: input.ticketId ?? null,
      ticketNumber: input.ticketNumber ?? null,
      errorMessage: input.errorMessage ?? null,
      severityCode: input.severityCode ?? null,
      serialNumber: input.serialNumber ?? null,
      merchantId: input.merchantId ?? null,
      alertCode: input.alertCode ?? null,
      payloadJson: input.payloadJson,
    },
  });
  return mapIngest(row);
}

export async function listIngestEvents(limit = 40): Promise<IngestEventRow[]> {
  const rows = await prisma.ingestEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: limit,
  });
  return rows.map(mapIngest);
}

/**
 * Predictive tahap 1: monitoring event → optional auto INCIDENT (CM).
 */
export async function processMonitoringEvent(input: {
  sourceSystem: string;
  event: MonitoringEventInput;
}): Promise<ProcessMonitoringResult> {
  const payloadJson = JSON.stringify(input.event);
  const eventId = input.event.eventId?.trim();
  if (!eventId) {
    throw Object.assign(new Error("eventId wajib diisi."), { status: 400 });
  }
  if (!input.event.message?.trim()) {
    throw Object.assign(new Error("message wajib diisi."), { status: 400 });
  }
  if (!input.event.severity?.trim()) {
    throw Object.assign(new Error("severity wajib diisi."), { status: 400 });
  }

  const severity = input.event.severity.trim().toUpperCase();
  const serial = input.event.serialNumber?.trim() || null;
  const alertCode = input.event.alertCode?.trim() || null;

  // Idempotent: same source+eventId already processed
  const prior = await prisma.ingestEvent.findUnique({
    where: {
      sourceSystem_externalEventId: {
        sourceSystem: input.sourceSystem,
        externalEventId: eventId,
      },
    },
  });
  if (prior && prior.outcome === "TICKET_CREATED" && prior.ticketId) {
    return {
      outcome: "DUPLICATE",
      skippedReason: "event already ingested",
      ingest: mapIngest(prior),
    };
  }

  if (!shouldCreateTicketFromSeverity(severity)) {
    const ingest = await upsertIngestLog({
      sourceSystem: input.sourceSystem,
      externalEventId: eventId,
      payloadJson,
      severityCode: severity,
      serialNumber: serial,
      merchantId: input.event.merchantId?.trim() || null,
      alertCode,
      matchedRule: "severity_below_threshold",
      outcome: "IGNORED",
    });
    return {
      outcome: "IGNORED",
      skippedReason: `severity ${severity} tidak membuat tiket (hanya CRITICAL/MAJOR)`,
      ingest,
    };
  }

  let asset = null as Awaited<ReturnType<typeof findAssetBySerial>> | null;
  if (serial) {
    asset = (await findAssetBySerial(serial)) ?? null;
  }

  const merchantId =
    input.event.merchantId?.trim().toUpperCase() ||
    asset?.merchantId?.trim().toUpperCase() ||
    (serial
      ? `${MONITORING_INGEST_CONFIG.defaultMerchantPrefix}${serial}`
      : "");

  if (!merchantId) {
    const ingest = await upsertIngestLog({
      sourceSystem: input.sourceSystem,
      externalEventId: eventId,
      payloadJson,
      severityCode: severity,
      serialNumber: serial,
      alertCode,
      matchedRule: "missing_merchant",
      outcome: "ERROR",
      errorMessage: "merchantId atau serialNumber wajib untuk create tiket",
    });
    return {
      outcome: "ERROR",
      skippedReason: ingest.errorMessage ?? "missing merchant",
      ingest,
    };
  }

  const location = await resolveLocationCode({
    locationCode: input.event.locationCode,
    regionalOffice: asset?.regionalOffice,
  });
  const category = categoryForSeverity(severity);
  const externalTicketId = buildExternalTicketId(input.event);
  const vendorName =
    input.event.vendorName?.trim() ||
    asset?.vendorName ||
    MONITORING_INGEST_CONFIG.defaultVendorName;

  const existingTicket = await getTicketByExternal(
    input.sourceSystem,
    externalTicketId
  );
  if (existingTicket) {
    const ingest = await upsertIngestLog({
      sourceSystem: input.sourceSystem,
      externalEventId: eventId,
      payloadJson,
      severityCode: severity,
      serialNumber: serial,
      merchantId,
      alertCode,
      matchedRule: "ticket_dedupe",
      outcome: "DUPLICATE",
      ticketId: existingTicket.id,
      ticketNumber: existingTicket.ticketNumber,
    });
    return {
      outcome: "DUPLICATE",
      skippedReason: "open ticket already exists for this alert bucket",
      ingest,
      ticket: toIntegrationDto(existingTicket),
    };
  }

  try {
    const description = [
      `[MONITORING] ${severity}`,
      alertCode ? `Alert: ${alertCode}` : null,
      serial ? `SN: ${serial}` : null,
      input.event.message.trim(),
    ]
      .filter(Boolean)
      .join(" · ");

    const ticket = await createIntegrationTicket({
      merchantId,
      location,
      category,
      description,
      vendorName,
      itsmType: "INCIDENT",
      process: "CM",
      externalTicketId,
      externalSystem: input.sourceSystem,
      openedAt: input.event.occurredAt,
      edcUnitId: asset?.id ?? null,
    });

    const ingest = await upsertIngestLog({
      sourceSystem: input.sourceSystem,
      externalEventId: eventId,
      payloadJson,
      severityCode: severity,
      serialNumber: serial,
      merchantId,
      alertCode,
      matchedRule: "auto_create_incident",
      outcome: "TICKET_CREATED",
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });

    return {
      outcome: "TICKET_CREATED",
      ingest,
      ticket: toIntegrationDto(ticket),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest failed";
    const ingest = await upsertIngestLog({
      sourceSystem: input.sourceSystem,
      externalEventId: eventId,
      payloadJson,
      severityCode: severity,
      serialNumber: serial,
      merchantId,
      alertCode,
      matchedRule: "auto_create_incident",
      outcome: "ERROR",
      errorMessage: message,
    });
    throw Object.assign(new Error(message), {
      status: (e as { status?: number }).status ?? 400,
      ingest,
    });
  }
}
