import {
  DEMO_AS_OF,
  MOCK_BUFFER_STOCK,
  SLA_LABELS,
  type BufferStockRow,
} from "@/data/dashboard";
import { listOlaPolicies } from "@/data/ola-store";
import { listIntegrationTickets } from "@/data/tickets-store";
import { MOCK_VENDOR_METRICS } from "@/data/vendors";
import {
  listAttendance,
  listWfmShifts,
  wfmKpis,
  type AttendanceLog,
} from "@/data/wfm-store";
import { MOCK_USERS } from "@/data/noc";
import { enrichOpsTicket } from "@/lib/ticketing";
import { OLA_STATUS_LABELS } from "@/ola";
import { UPTIME_TARGET_PERCENT } from "@/config/sla.config";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import {
  PERSONNEL_ATTENDANCE_FLOOR_PERCENT,
  PERSONNEL_SCORE_ATTENDANCE_WEIGHT,
  PERSONNEL_SCORE_SLA_WEIGHT,
  PERSONNEL_SCORE_THROUGHPUT_WEIGHT,
  PERSONNEL_SLA_FLOOR_PERCENT,
  PERSONNEL_THROUGHPUT_FULL_AT,
} from "@/config/personnel-report.config";
import { ATTENDANCE_STATUS_LABELS } from "@/config/wfm.config";
import * as XLSX from "xlsx";

export interface OpsReportSummary {
  asOf: string;
  period: { from: string; to: string; label: string };
  tickets: {
    total: number;
    open: number;
    byItsm: Record<string, number>;
    sla: Record<string, number>;
    olaAck: Record<string, number>;
    olaDispatch: Record<string, number>;
    slaEscalations: number;
    olaEscalations: number;
  };
  buffer: {
    minPercent: number;
    roTotal: number;
    roOk: number;
    roBelow: number;
    rows: BufferStockRow[];
  };
  vendors: typeof MOCK_VENDOR_METRICS;
  uptimeTarget: number;
  wfm: ReturnType<typeof wfmKpis> & {
    rosterPeriodCount: number;
    attendanceSample: number;
  };
  personnel: {
    rows: PersonnelPerformanceRow[];
    slaFloor: number;
    attendanceFloor: number;
    avgScore: number;
    belowSlaFloor: number;
    belowAttendanceFloor: number;
  };
}

export interface OpsReportTicketRow {
  ticketNumber: string;
  itsmType: string;
  process: string;
  merchantId: string;
  location: string;
  category: string;
  status: string;
  vendorName: string;
  slaStatus: string;
  olaAck: string;
  olaDispatch: string;
  openedAt: string;
  closedAt: string;
  nocOwner: string;
  technician: string;
}

export interface PersonnelPerformanceRow {
  personKey: string;
  name: string;
  role: string;
  kind: "INTERNAL" | "TECHNICIAN";
  shiftsScheduled: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
  ticketsOwned: number;
  ticketsCreated: number;
  ticketsClosed: number;
  ticketsBreached: number;
  ticketsWarning: number;
  ticketsOnTrack: number;
  slaCompliancePercent: number;
  activitiesCount: number;
  performanceScore: number;
}

export interface ReportPeriodInput {
  from: string;
  to: string;
  label?: string;
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function parseYmdStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0));
}

function parseYmdEnd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999));
}

function inPeriod(iso: string, from: Date, to: Date): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= from.getTime() && t <= to.getTime();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeScore(opts: {
  slaCompliance: number | null;
  attendanceRate: number | null;
  ticketsHandled: number;
}): number {
  const slaPart =
    opts.slaCompliance == null ? 70 : clamp(opts.slaCompliance, 0, 100);
  const attPart =
    opts.attendanceRate == null ? 70 : clamp(opts.attendanceRate, 0, 100);
  const throughputPart = clamp(
    (opts.ticketsHandled / PERSONNEL_THROUGHPUT_FULL_AT) * 100,
    0,
    100
  );
  return Math.round(
    slaPart * PERSONNEL_SCORE_SLA_WEIGHT +
      attPart * PERSONNEL_SCORE_ATTENDANCE_WEIGHT +
      throughputPart * PERSONNEL_SCORE_THROUGHPUT_WEIGHT
  );
}

type Acc = {
  personKey: string;
  name: string;
  role: string;
  kind: "INTERNAL" | "TECHNICIAN";
  shiftsScheduled: number;
  present: number;
  late: number;
  absent: number;
  ticketsOwned: number;
  ticketsCreated: number;
  ticketsClosed: number;
  ticketsBreached: number;
  ticketsWarning: number;
  ticketsOnTrack: number;
  activitiesCount: number;
};

function ensureAcc(
  map: Map<string, Acc>,
  key: string,
  name: string,
  role: string,
  kind: Acc["kind"]
): Acc {
  let row = map.get(key);
  if (!row) {
    row = {
      personKey: key,
      name,
      role,
      kind,
      shiftsScheduled: 0,
      present: 0,
      late: 0,
      absent: 0,
      ticketsOwned: 0,
      ticketsCreated: 0,
      ticketsClosed: 0,
      ticketsBreached: 0,
      ticketsWarning: 0,
      ticketsOnTrack: 0,
      activitiesCount: 0,
    };
    map.set(key, row);
  }
  return row;
}

function resolveUserRole(userId?: string | null, name?: string | null): string {
  if (userId) {
    const u = MOCK_USERS.find((x) => x.id === userId);
    if (u) return u.role;
  }
  if (name) {
    const u = MOCK_USERS.find((x) => x.name === name);
    if (u) return u.role;
  }
  return "UNKNOWN";
}

export function buildPersonnelPerformance(
  enrichedTickets: ReturnType<typeof enrichOpsTicket>[],
  fromYmd: string,
  toYmd: string,
  attendanceLogs: AttendanceLog[] = listAttendance(500)
): PersonnelPerformanceRow[] {
  const map = new Map<string, Acc>();

  const shifts = listWfmShifts({ from: fromYmd, to: toYmd });
  for (const s of shifts) {
    const acc = ensureAcc(map, s.userId, s.userName, s.role, "INTERNAL");
    acc.shiftsScheduled += 1;
    const log = attendanceLogs.find(
      (a) =>
        a.userId === s.userId &&
        a.shiftDate === s.shiftDate &&
        (a.shiftType == null || a.shiftType === s.shiftType)
    );
    if (log?.status === "PRESENT") acc.present += 1;
    else if (log?.status === "LATE") acc.late += 1;
    else if (s.status === "ON_DUTY") acc.present += 1;
    else acc.absent += 1;
  }

  for (const a of attendanceLogs) {
    if (a.shiftDate < fromYmd || a.shiftDate > toYmd) continue;
    const acc = ensureAcc(map, a.userId, a.userName, a.role, "INTERNAL");
    if (acc.shiftsScheduled === 0) {
      if (a.status === "PRESENT") acc.present += 1;
      else if (a.status === "LATE") acc.late += 1;
    }
  }

  for (const t of enrichedTickets) {
    if (t.nocOwnerId || t.nocOwnerName) {
      const key = t.nocOwnerId ?? `name:${t.nocOwnerName}`;
      const acc = ensureAcc(
        map,
        key,
        t.nocOwnerName ?? t.nocOwnerId ?? "NOC",
        resolveUserRole(t.nocOwnerId, t.nocOwnerName),
        "INTERNAL"
      );
      acc.ticketsOwned += 1;
      if (t.status === "CLOSED" || t.status === "RESOLVED") acc.ticketsClosed += 1;
      if (t.slaStatus === "BREACHED") acc.ticketsBreached += 1;
      else if (t.slaStatus === "WARNING") acc.ticketsWarning += 1;
      else if (t.slaStatus === "ON_TRACK" || t.slaStatus === "ACHIEVED") {
        acc.ticketsOnTrack += 1;
      }
    }

    if (t.createdById || t.createdByName) {
      const key = t.createdById ?? `name:${t.createdByName}`;
      const acc = ensureAcc(
        map,
        key,
        t.createdByName ?? t.createdById ?? "Creator",
        resolveUserRole(t.createdById, t.createdByName),
        "INTERNAL"
      );
      acc.ticketsCreated += 1;
    }

    if (t.technicianName?.trim()) {
      const name = t.technicianName.trim();
      const key = `tech:${name}`;
      const acc = ensureAcc(map, key, name, "TECHNICIAN", "TECHNICIAN");
      acc.ticketsOwned += 1;
      if (t.status === "CLOSED" || t.status === "RESOLVED") acc.ticketsClosed += 1;
      if (t.slaStatus === "BREACHED") acc.ticketsBreached += 1;
      else if (t.slaStatus === "WARNING") acc.ticketsWarning += 1;
      else if (t.slaStatus === "ON_TRACK" || t.slaStatus === "ACHIEVED") {
        acc.ticketsOnTrack += 1;
      }
    }

    for (const act of t.activities) {
      const actor = act.actorName?.trim();
      if (!actor) continue;
      const known = MOCK_USERS.find((u) => u.name === actor);
      const key = known?.id ?? `name:${actor}`;
      const acc = ensureAcc(
        map,
        key,
        actor,
        known?.role ?? "UNKNOWN",
        "INTERNAL"
      );
      acc.activitiesCount += 1;
    }
  }

  const rows: PersonnelPerformanceRow[] = [...map.values()].map((acc) => {
    const attended = acc.present + acc.late;
    const attendanceDenom = acc.shiftsScheduled || attended;
    const attendanceRate =
      attendanceDenom > 0 ? (attended / attendanceDenom) * 100 : NaN;
    const slaDenom =
      acc.ticketsOnTrack + acc.ticketsWarning + acc.ticketsBreached;
    const slaCompliancePercent =
      slaDenom > 0 ? (acc.ticketsOnTrack / slaDenom) * 100 : NaN;
    const ticketsHandled = Math.max(acc.ticketsOwned, acc.ticketsCreated);

    return {
      personKey: acc.personKey,
      name: acc.name,
      role: acc.role,
      kind: acc.kind,
      shiftsScheduled: acc.shiftsScheduled,
      present: acc.present,
      late: acc.late,
      absent: acc.absent,
      attendanceRate: Number.isFinite(attendanceRate) ? attendanceRate : 0,
      ticketsOwned: acc.ticketsOwned,
      ticketsCreated: acc.ticketsCreated,
      ticketsClosed: acc.ticketsClosed,
      ticketsBreached: acc.ticketsBreached,
      ticketsWarning: acc.ticketsWarning,
      ticketsOnTrack: acc.ticketsOnTrack,
      slaCompliancePercent: Number.isFinite(slaCompliancePercent)
        ? slaCompliancePercent
        : 0,
      activitiesCount: acc.activitiesCount,
      performanceScore: computeScore({
        slaCompliance: Number.isFinite(slaCompliancePercent)
          ? slaCompliancePercent
          : null,
        attendanceRate: Number.isFinite(attendanceRate) ? attendanceRate : null,
        ticketsHandled,
      }),
    };
  });

  return rows.sort(
    (a, b) =>
      b.performanceScore - a.performanceScore ||
      b.ticketsOwned - a.ticketsOwned ||
      a.name.localeCompare(b.name)
  );
}

export function buildOpsReport(
  asOf: Date = DEMO_AS_OF,
  period?: ReportPeriodInput
): {
  summary: OpsReportSummary;
  tickets: OpsReportTicketRow[];
} {
  const fromYmd = period?.from ?? asOf.toISOString().slice(0, 10);
  const toYmd = period?.to ?? asOf.toISOString().slice(0, 10);
  const from = parseYmdStart(fromYmd);
  const to = parseYmdEnd(toYmd);
  if (to.getTime() < from.getTime()) {
    throw new Error("Tanggal akhir harus ≥ tanggal awal.");
  }

  const olaPolicies = listOlaPolicies({ activeOnly: true });
  const enrichedAll = listIntegrationTickets().map((t) =>
    enrichOpsTicket(t, asOf, olaPolicies)
  );
  const enriched = enrichedAll.filter((t) => inPeriod(t.openedAt, from, to));

  const byItsm: Record<string, number> = {};
  const sla: Record<string, number> = {};
  const olaAck: Record<string, number> = {};
  const olaDispatch: Record<string, number> = {};
  let slaEscalations = 0;
  let olaEscalations = 0;
  let open = 0;

  const tickets: OpsReportTicketRow[] = enriched.map((t) => {
    bump(byItsm, t.itsmType);
    bump(sla, t.slaStatus);
    if (t.olaAckStatus) bump(olaAck, t.olaAckStatus);
    if (t.olaDispatchStatus) bump(olaDispatch, t.olaDispatchStatus);
    if (t.status !== "CLOSED" && t.status !== "RESOLVED") open += 1;
    if (t.needsEscalation && t.status !== "CLOSED") slaEscalations += 1;
    if (
      t.olaNeedsEscalation &&
      t.status !== "CLOSED" &&
      t.status !== "RESOLVED"
    ) {
      olaEscalations += 1;
    }

    return {
      ticketNumber: t.ticketNumber,
      itsmType: t.itsmType,
      process: t.process,
      merchantId: t.merchantId,
      location: t.location,
      category: t.category,
      status: t.status,
      vendorName: t.vendorName,
      slaStatus: SLA_LABELS[t.slaStatus] ?? t.slaStatus,
      olaAck: t.olaAckStatus ? OLA_STATUS_LABELS[t.olaAckStatus] : "—",
      olaDispatch: t.olaDispatchStatus
        ? OLA_STATUS_LABELS[t.olaDispatchStatus]
        : "—",
      openedAt: t.openedAt,
      closedAt: t.closedAt ?? "",
      nocOwner: t.nocOwnerName ?? "",
      technician: t.technicianName ?? "",
    };
  });

  const bufferOk = MOCK_BUFFER_STOCK.filter((b) => !b.belowThreshold).length;
  const wfm = wfmKpis(asOf);
  const label = period?.label ?? `${fromYmd} → ${toYmd}`;
  const attendanceInPeriod = listAttendance(500).filter((a) =>
    inPeriod(a.loggedAt, from, to)
  );
  const personnelRows = buildPersonnelPerformance(
    enriched,
    fromYmd,
    toYmd,
    listAttendance(500)
  );
  const avgScore =
    personnelRows.length > 0
      ? personnelRows.reduce((s, r) => s + r.performanceScore, 0) /
        personnelRows.length
      : 0;

  return {
    summary: {
      asOf: asOf.toISOString(),
      period: { from: fromYmd, to: toYmd, label },
      tickets: {
        total: enriched.length,
        open,
        byItsm,
        sla,
        olaAck,
        olaDispatch,
        slaEscalations,
        olaEscalations,
      },
      buffer: {
        minPercent: BUFFER_STOCK_MIN_PERCENT,
        roTotal: MOCK_BUFFER_STOCK.length,
        roOk: bufferOk,
        roBelow: MOCK_BUFFER_STOCK.length - bufferOk,
        rows: MOCK_BUFFER_STOCK,
      },
      vendors: MOCK_VENDOR_METRICS,
      uptimeTarget: UPTIME_TARGET_PERCENT,
      wfm: {
        ...wfm,
        rosterPeriodCount: listWfmShifts({ from: fromYmd, to: toYmd }).length,
        attendanceSample: attendanceInPeriod.length,
      },
      personnel: {
        rows: personnelRows,
        slaFloor: PERSONNEL_SLA_FLOOR_PERCENT,
        attendanceFloor: PERSONNEL_ATTENDANCE_FLOOR_PERCENT,
        avgScore,
        belowSlaFloor: personnelRows.filter(
          (r) =>
            r.ticketsOwned + r.ticketsCreated > 0 &&
            r.slaCompliancePercent < PERSONNEL_SLA_FLOOR_PERCENT
        ).length,
        belowAttendanceFloor: personnelRows.filter(
          (r) =>
            r.shiftsScheduled > 0 &&
            r.attendanceRate < PERSONNEL_ATTENDANCE_FLOOR_PERCENT
        ).length,
      },
    },
    tickets,
  };
}

export function buildOpsReportWorkbook(
  asOf: Date = DEMO_AS_OF,
  period?: ReportPeriodInput
): Buffer {
  const { summary, tickets } = buildOpsReport(asOf, period);
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { section: "Period", metric: "From", value: summary.period.from },
    { section: "Period", metric: "To", value: summary.period.to },
    { section: "Period", metric: "Label", value: summary.period.label },
    { section: "Tickets", metric: "Total", value: summary.tickets.total },
    { section: "Tickets", metric: "Open", value: summary.tickets.open },
    {
      section: "Tickets",
      metric: "SLA escalations",
      value: summary.tickets.slaEscalations,
    },
    {
      section: "Tickets",
      metric: "OLA escalations",
      value: summary.tickets.olaEscalations,
    },
    {
      section: "Buffer",
      metric: `RO OK (≥${summary.buffer.minPercent}%)`,
      value: `${summary.buffer.roOk}/${summary.buffer.roTotal}`,
    },
    {
      section: "Buffer",
      metric: "RO below threshold",
      value: summary.buffer.roBelow,
    },
    {
      section: "WFM",
      metric: "Roster rows (period)",
      value: summary.wfm.rosterPeriodCount,
    },
    {
      section: "WFM",
      metric: "Attendance in period",
      value: summary.wfm.attendanceSample,
    },
    {
      section: "Personnel",
      metric: "Headcount scored",
      value: summary.personnel.rows.length,
    },
    {
      section: "Personnel",
      metric: "Avg performance score",
      value: Number(summary.personnel.avgScore.toFixed(1)),
    },
    {
      section: "Personnel",
      metric: `Below SLA floor (<${summary.personnel.slaFloor}%)`,
      value: summary.personnel.belowSlaFloor,
    },
    {
      section: "Personnel",
      metric: `Below attendance floor (<${summary.personnel.attendanceFloor}%)`,
      value: summary.personnel.belowAttendanceFloor,
    },
    {
      section: "Uptime",
      metric: "Target %",
      value: summary.uptimeTarget,
    },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summaryRows),
    "Summary"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tickets),
    "Tickets"
  );

  const personnelSheet = summary.personnel.rows.map((r) => ({
    name: r.name,
    role: r.role,
    kind: r.kind,
    performanceScore: r.performanceScore,
    shiftsScheduled: r.shiftsScheduled,
    present: r.present,
    late: r.late,
    absent: r.absent,
    attendanceRate: Number(r.attendanceRate.toFixed(1)),
    ticketsOwned: r.ticketsOwned,
    ticketsCreated: r.ticketsCreated,
    ticketsClosed: r.ticketsClosed,
    ticketsOnTrack: r.ticketsOnTrack,
    ticketsWarning: r.ticketsWarning,
    ticketsBreached: r.ticketsBreached,
    slaCompliancePercent: Number(r.slaCompliancePercent.toFixed(1)),
    activitiesCount: r.activitiesCount,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(personnelSheet),
    "Personnel"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summary.vendors),
    "Vendors"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summary.buffer.rows),
    "Buffer"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      Object.entries(ATTENDANCE_STATUS_LABELS).map(([code, label]) => ({
        code,
        label,
      }))
    ),
    "AttendanceLegend"
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
