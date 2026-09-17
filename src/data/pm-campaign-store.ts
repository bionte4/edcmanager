import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  PM_CALENDAR_CONFIG,
  jakartaPeriodKey,
} from "@/config/pm-calendar.config";
import {
  peakPeriodKey,
  type PeakSeasonKind,
  type PeakSeasonStatus,
} from "@/config/peak-season.config";
import { getPeakSeasonStatuses } from "@/data/peak-season-store";
import { listLocations } from "@/data/locations-store";
import {
  createIntegrationTicket,
  listOpsTickets,
} from "@/data/tickets-store";
import { prisma } from "@/lib/prisma";
import type { TicketLocation } from "@/config/sla.config";
import type { NocUser, OpsTicket } from "@/lib/ticketing";

export interface CampaignRunRow {
  id: string;
  kind: string;
  periodKey: string;
  status: string;
  ticketCount: number;
  metaJson?: string | null;
  createdById?: string | null;
  generatedAt: string;
}

function mapRun(row: {
  id: string;
  kind: string;
  periodKey: string;
  status: string;
  ticketCount: number;
  metaJson: string | null;
  createdById: string | null;
  generatedAt: Date;
}): CampaignRunRow {
  return {
    id: row.id,
    kind: row.kind,
    periodKey: row.periodKey,
    status: row.status,
    ticketCount: row.ticketCount,
    metaJson: row.metaJson,
    createdById: row.createdById,
    generatedAt: row.generatedAt.toISOString(),
  };
}

function slugRo(ro: string): string {
  return ro
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function locationForRo(ro: string): Promise<TicketLocation> {
  const locs = await listLocations({
    activeOnly: true,
    ticketSelectableOnly: true,
  });
  const match = locs.find(
    (l) =>
      l.regionalOffice &&
      l.regionalOffice.toLowerCase() === ro.toLowerCase()
  );
  if (match) return match.code as TicketLocation;
  return PM_CALENDAR_CONFIG.defaultLocation as TicketLocation;
}

export async function listCampaignRuns(limit = 40): Promise<CampaignRunRow[]> {
  const rows = await prisma.pmCampaignRun.findMany({
    orderBy: { generatedAt: "desc" },
    take: limit,
  });
  return rows.map(mapRun);
}

export async function listPmTicketsForPeriod(
  periodKey: string
): Promise<OpsTicket[]> {
  const tickets = await listOpsTickets();
  const prefix = `pm:${periodKey}:`;
  return tickets.filter(
    (t) =>
      t.itsmType === "REQUEST" &&
      t.process === "PM" &&
      (t.externalTicketId?.startsWith(prefix) ||
        t.description.includes(periodKey))
  );
}

export async function getPmCalendarSnapshot(asOf = new Date()) {
  const periodKey = jakartaPeriodKey(asOf);
  const [tickets, runs] = await Promise.all([
    listPmTicketsForPeriod(periodKey),
    listCampaignRuns(20),
  ]);
  const monthlyRun = runs.find(
    (r) => r.kind === "PM_MONTHLY" && r.periodKey === periodKey
  );
  return {
    periodKey,
    generateDayOfMonth: PM_CALENDAR_CONFIG.generateDayOfMonth,
    process: PM_CALENDAR_CONFIG.process,
    itsmType: PM_CALENDAR_CONFIG.itsmType,
    regionalOffices: [...REGIONAL_OFFICES],
    tickets,
    monthlyRun: monthlyRun ?? null,
    recentRuns: runs.filter((r) => r.kind === "PM_MONTHLY"),
  };
}

export async function generateMonthlyPm(input: {
  periodKey?: string;
  actor?: NocUser | null;
  force?: boolean;
}): Promise<{
  periodKey: string;
  run: CampaignRunRow;
  created: OpsTicket[];
  skipped: number;
}> {
  const periodKey = input.periodKey ?? jakartaPeriodKey();
  const existing = await prisma.pmCampaignRun.findUnique({
    where: {
      kind_periodKey: { kind: "PM_MONTHLY", periodKey },
    },
  });
  if (existing && !input.force) {
    return {
      periodKey,
      run: mapRun(existing),
      created: [],
      skipped: existing.ticketCount,
    };
  }

  const created: OpsTicket[] = [];
  let skipped = 0;
  const errors: string[] = [];

  for (const ro of REGIONAL_OFFICES) {
    const externalTicketId = `pm:${periodKey}:${slugRo(ro)}`;
    try {
      const location = await locationForRo(ro);
      const ticket = await createIntegrationTicket({
        merchantId: `PM-${slugRo(ro).toUpperCase()}`,
        location,
        category: PM_CALENDAR_CONFIG.category,
        description: PM_CALENDAR_CONFIG.descriptionTemplate(periodKey, ro),
        vendorName: "Vendor 1",
        itsmType: PM_CALENDAR_CONFIG.itsmType,
        process: PM_CALENDAR_CONFIG.process,
        externalTicketId,
        externalSystem: PM_CALENDAR_CONFIG.externalSystem,
      });
      created.push(ticket);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      if (msg.includes("already exists")) {
        skipped += 1;
      } else {
        errors.push(`${ro}: ${msg}`);
      }
    }
  }

  const run = await prisma.pmCampaignRun.upsert({
    where: {
      kind_periodKey: { kind: "PM_MONTHLY", periodKey },
    },
    create: {
      kind: "PM_MONTHLY",
      periodKey,
      status: errors.length ? "PARTIAL" : "DONE",
      ticketCount: created.length + skipped,
      createdById: input.actor?.id ?? null,
      metaJson: JSON.stringify({
        created: created.map((t) => t.ticketNumber),
        skipped,
        errors,
        regionalOffices: REGIONAL_OFFICES.length,
      }),
    },
    update: {
      status: errors.length ? "PARTIAL" : "DONE",
      ticketCount: created.length + skipped,
      createdById: input.actor?.id ?? null,
      metaJson: JSON.stringify({
        created: created.map((t) => t.ticketNumber),
        skipped,
        errors,
        regionalOffices: REGIONAL_OFFICES.length,
        forced: !!input.force,
      }),
      generatedAt: new Date(),
    },
  });

  return { periodKey, run: mapRun(run), created, skipped };
}

export async function getPeakSeasonSnapshot(asOf = new Date()): Promise<{
  asOf: string;
  seasons: PeakSeasonStatus[];
  active: PeakSeasonStatus[];
  intensifyDue: PeakSeasonStatus[];
}> {
  const seasons = await getPeakSeasonStatuses(asOf);
  return {
    asOf: asOf.toISOString(),
    seasons,
    active: seasons.filter((s) => s.state === "ACTIVE"),
    intensifyDue: seasons.filter((s) => s.intensifyDue),
  };
}

export async function runPeakIntensify(input: {
  /** DB window id (preferred). */
  windowId?: string;
  /** Kind filter — picks matching window from intensifyDue / seasons. */
  peakId?: PeakSeasonKind;
  actor?: NocUser | null;
  force?: boolean;
  notify?: boolean;
}): Promise<{
  periodKey: string;
  run: CampaignRunRow;
  season: PeakSeasonStatus | undefined;
  notified: boolean;
}> {
  const snapshot = await getPeakSeasonSnapshot();
  const season = input.windowId
    ? snapshot.seasons.find((s) => s.window.id === input.windowId)
    : input.peakId
      ? snapshot.seasons.find((s) => s.window.kind === input.peakId)
      : undefined;
  if (!season) {
    throw new Error(
      `Peak season ${input.windowId ?? input.peakId ?? "?"} tidak dikenal / tidak aktif.`
    );
  }

  const periodKey = peakPeriodKey(season.window.kind, season.window.startDate);
  const existing = await prisma.pmCampaignRun.findUnique({
    where: { kind_periodKey: { kind: "PEAK_INTENSIFY", periodKey } },
  });
  if (existing && !input.force) {
    return {
      periodKey,
      run: mapRun(existing),
      season,
      notified: false,
    };
  }

  let notified = false;
  if (input.notify !== false) {
    try {
      await notifyPeakIntensify(season);
      notified = true;
    } catch {
      notified = false;
    }
  }

  const run = await prisma.pmCampaignRun.upsert({
    where: { kind_periodKey: { kind: "PEAK_INTENSIFY", periodKey } },
    create: {
      kind: "PEAK_INTENSIFY",
      periodKey,
      status: "DONE",
      ticketCount: 0,
      createdById: input.actor?.id ?? null,
      metaJson: JSON.stringify({
        windowId: season.window.id,
        peakId: season.window.kind,
        name: season.window.name,
        state: season.state,
        bufferFloorPercent: season.window.bufferFloorPercent,
        checklist: season.window.checklist,
        notified,
      }),
    },
    update: {
      status: "DONE",
      createdById: input.actor?.id ?? null,
      metaJson: JSON.stringify({
        windowId: season.window.id,
        peakId: season.window.kind,
        name: season.window.name,
        state: season.state,
        bufferFloorPercent: season.window.bufferFloorPercent,
        checklist: season.window.checklist,
        notified,
        forced: !!input.force,
      }),
      generatedAt: new Date(),
    },
  });

  return { periodKey, run: mapRun(run), season, notified };
}

/** Peak intensify with a dedicated email body (ops playbook). */
export async function notifyPeakIntensify(season: PeakSeasonStatus) {
  const { addNotification } = await import("@/data/notifications-store");
  const { sendEmail } = await import("@/lib/notifications/smtp");
  const { NOTIFICATION_DEFAULTS, isSmtpConfigured } = await import(
    "@/config/smtp.config"
  );

  const subject = `[PEAK] Intensifikasi ${season.window.name} · buffer ≥${season.window.bufferFloorPercent}%`;
  const body = [
    `Peak season: ${season.window.name}`,
    `Status: ${season.state}`,
    `Window: ${season.window.startDate} → ${season.window.endDate}`,
    `Buffer floor: ${season.window.bufferFloorPercent}%`,
    "",
    "Checklist:",
    ...season.window.checklist.map((c, i) => `${i + 1}. ${c}`),
    "",
    "— EDC Manager Peak Playbook",
  ].join("\n");

  const recipients = Array.from(
    new Set(
      [
        NOTIFICATION_DEFAULTS.opsEmail,
        NOTIFICATION_DEFAULTS.supervisorEmail,
      ].filter(Boolean)
    )
  );

  const logs = [];
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, text: body });
    const status =
      result.mode === "sent"
        ? "SENT"
        : result.mode === "simulated"
          ? "SIMULATED"
          : "FAILED";
    logs.push(
      await addNotification({
        event: "DIGEST",
        channel: "EMAIL",
        status,
        toAddress: to,
        subject,
        body,
        error: result.error,
      })
    );
  }
  return { smtpConfigured: isSmtpConfigured(), logs };
}
