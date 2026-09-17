import {
  DEMO_AS_OF,
  MOCK_BUFFER_STOCK,
  SLA_LABELS,
  type BufferStockRow,
} from "@/data/dashboard";
import { listOlaPolicies } from "@/data/ola-store";
import { listIntegrationTickets } from "@/data/tickets-store";
import { MOCK_VENDOR_METRICS } from "@/data/vendors";
import { listAttendance, listWfmShifts, wfmKpis } from "@/data/wfm-store";
import { enrichOpsTicket } from "@/lib/ticketing";
import { OLA_STATUS_LABELS } from "@/ola";
import { UPTIME_TARGET_PERCENT } from "@/config/sla.config";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import * as XLSX from "xlsx";

export interface OpsReportSummary {
  asOf: string;
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
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export function buildOpsReport(asOf: Date = DEMO_AS_OF): {
  summary: OpsReportSummary;
  tickets: OpsReportTicketRow[];
} {
  const olaPolicies = listOlaPolicies({ activeOnly: true });
  const enriched = listIntegrationTickets().map((t) =>
    enrichOpsTicket(t, asOf, olaPolicies)
  );

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
    if (t.olaNeedsEscalation && t.status !== "CLOSED" && t.status !== "RESOLVED") {
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
      olaAck: t.olaAckStatus
        ? OLA_STATUS_LABELS[t.olaAckStatus]
        : "—",
      olaDispatch: t.olaDispatchStatus
        ? OLA_STATUS_LABELS[t.olaDispatchStatus]
        : "—",
      openedAt: t.openedAt,
      closedAt: t.closedAt ?? "",
    };
  });

  const bufferOk = MOCK_BUFFER_STOCK.filter((b) => !b.belowThreshold).length;
  const wfm = wfmKpis(asOf);

  return {
    summary: {
      asOf: asOf.toISOString(),
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
        rosterPeriodCount: listWfmShifts().length,
        attendanceSample: listAttendance(200).length,
      },
    },
    tickets,
  };
}

export function buildOpsReportWorkbook(asOf: Date = DEMO_AS_OF): Buffer {
  const { summary, tickets } = buildOpsReport(asOf);
  const wb = XLSX.utils.book_new();

  const summaryRows = [
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
      metric: "Roster rows",
      value: summary.wfm.rosterPeriodCount,
    },
    {
      section: "WFM",
      metric: "Present today",
      value: summary.wfm.presentToday,
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

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
