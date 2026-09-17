import {
  evaluateSlaStatus,
  type TicketCategory,
  type TicketLocation,
  type SlaEvaluationStatus,
} from "@/sla";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import { UPTIME_TARGET_PERCENT } from "@/config/sla.config";
import { DEFAULT_LOCATIONS } from "@/config/location.config";

export type { TicketCategory, TicketLocation, SlaEvaluationStatus };

export interface DashboardTicket {
  id: string;
  ticketNumber: string;
  merchantId: string;
  location: TicketLocation;
  category: TicketCategory;
  openedAt: string;
  closedAt?: string | null;
  vendorName: string;
  regionalOffice: string;
}

export interface BufferStockRow {
  regionalOffice: string;
  totalUnits: number;
  bufferUnits: number;
  deployedUnits: number;
  idleUnits: number;
  bufferPercent: number;
  belowThreshold: boolean;
}

export interface DashboardKpis {
  activeTickets: number;
  uptimePercent: number;
  uptimeTarget: number;
  approachingBreach: number;
  bufferOkCount: number;
  bufferTotalRo: number;
  bufferHealthy: boolean;
  bufferMinPercent: number;
}

export const DEMO_AS_OF = new Date("2026-09-17T07:00:00.000Z"); // 14:00 Asia/Jakarta (peak)

/** Demo tickets relative to a fixed peak-hour clock so SLA badges stay consistent. */
export const MOCK_TICKETS: DashboardTicket[] = [
  {
    id: "1",
    ticketNumber: "CM-2026-8841",
    merchantId: "MID-102938",
    location: "JKT_PUSAT",
    category: "VIP",
    openedAt: new Date(DEMO_AS_OF.getTime() - 100 * 60 * 1000).toISOString(),
    vendorName: "Vendor 1",
    regionalOffice: "RO Jakarta 1",
  },
  {
    id: "2",
    ticketNumber: "CM-2026-8842",
    merchantId: "MID-558201",
    location: "JKT_SELATAN",
    category: "VIP",
    openedAt: new Date(DEMO_AS_OF.getTime() - 40 * 60 * 1000).toISOString(),
    vendorName: "Vendor 1",
    regionalOffice: "RO Jakarta 1",
  },
  {
    id: "3",
    ticketNumber: "CM-2026-8843",
    merchantId: "MID-771004",
    location: "BDG_KOTA",
    category: "NON_VIP",
    openedAt: new Date(DEMO_AS_OF.getTime() - 7 * 60 * 60 * 1000).toISOString(),
    vendorName: "Vendor 2",
    regionalOffice: "RO Bandung",
  },
  {
    id: "4",
    ticketNumber: "CM-2026-8844",
    merchantId: "MID-330119",
    location: "DPS_BALI",
    category: "VIP",
    openedAt: new Date(DEMO_AS_OF.getTime() - 20 * 60 * 60 * 1000).toISOString(),
    vendorName: "Vendor 2",
    regionalOffice: "RO Denpasar",
  },
  {
    id: "5",
    ticketNumber: "CM-2026-8845",
    merchantId: "MID-990012",
    location: "JKT_BARAT",
    category: "NON_VIP",
    openedAt: new Date(DEMO_AS_OF.getTime() - 250 * 60 * 1000).toISOString(),
    vendorName: "Vendor 1",
    regionalOffice: "RO Jakarta 1",
  },
  {
    id: "6",
    ticketNumber: "CM-2026-8830",
    merchantId: "MID-441200",
    location: "SBY_PUSAT",
    category: "VIP",
    openedAt: new Date(DEMO_AS_OF.getTime() - 9 * 60 * 60 * 1000).toISOString(),
    closedAt: new Date(DEMO_AS_OF.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    vendorName: "Vendor 2",
    regionalOffice: "RO Surabaya",
  },
];

export const MOCK_BUFFER_STOCK: BufferStockRow[] = [
  {
    regionalOffice: "RO Jakarta 1",
    totalUnits: 200,
    bufferUnits: 22,
    deployedUnits: 168,
    idleUnits: 10,
    bufferPercent: 11,
    belowThreshold: false,
  },
  {
    regionalOffice: "RO Bandung",
    totalUnits: 150,
    bufferUnits: 12,
    deployedUnits: 130,
    idleUnits: 8,
    bufferPercent: 8,
    belowThreshold: true,
  },
  {
    regionalOffice: "RO Surabaya",
    totalUnits: 180,
    bufferUnits: 20,
    deployedUnits: 150,
    idleUnits: 10,
    bufferPercent: 11.1,
    belowThreshold: false,
  },
  {
    regionalOffice: "RO Denpasar",
    totalUnits: 90,
    bufferUnits: 7,
    deployedUnits: 78,
    idleUnits: 5,
    bufferPercent: 7.8,
    belowThreshold: true,
  },
].map((row) => ({
  ...row,
  belowThreshold: row.bufferPercent < BUFFER_STOCK_MIN_PERCENT,
}));

export interface EnrichedTicket extends DashboardTicket {
  slaStatus: SlaEvaluationStatus;
  elapsedLabel: string;
  remainingLabel: string;
  elapsedRatio: number;
}

export function enrichTickets(
  tickets: DashboardTicket[],
  asOf: Date = new Date()
): EnrichedTicket[] {
  return tickets.map((ticket) => {
    const evaluation = evaluateSlaStatus(
      {
        location: ticket.location,
        category: ticket.category,
        openedAt: new Date(ticket.openedAt),
        closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
      },
      asOf
    );

    const remainingMinutes = evaluation.remainingMs / (60 * 1000);
    const remainingLabel =
      evaluation.remainingMs < 0
        ? `+${Math.abs(Math.round(remainingMinutes))}m over`
        : `${Math.round(remainingMinutes)}m left`;

    return {
      ...ticket,
      slaStatus: evaluation.status,
      elapsedLabel: evaluation.duration.formatted,
      remainingLabel,
      elapsedRatio: evaluation.elapsedRatio,
    };
  });
}

export function buildDashboardKpis(
  tickets: EnrichedTicket[],
  buffer: BufferStockRow[],
  uptimePercent = 99.94
): DashboardKpis {
  const active = tickets.filter((t) => !t.closedAt);
  const approaching = active.filter(
    (t) => t.slaStatus === "WARNING" || t.slaStatus === "BREACHED"
  );
  const bufferOk = buffer.filter((b) => !b.belowThreshold).length;

  return {
    activeTickets: active.length,
    uptimePercent,
    uptimeTarget: UPTIME_TARGET_PERCENT,
    approachingBreach: approaching.length,
    bufferOkCount: bufferOk,
    bufferTotalRo: buffer.length,
    bufferHealthy: bufferOk === buffer.length,
    bufferMinPercent: BUFFER_STOCK_MIN_PERCENT,
  };
}

export const LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_LOCATIONS.map((l) => [l.code, l.label])
);

export const CATEGORY_LABELS: Record<string, string> = {
  VIP: "VIP",
  NON_VIP: "Non-VIP",
};

/** Resolve display label for a ticket category code (falls back to code). */
export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

/** Resolve display label for a location code (falls back to code). */
export function locationLabel(code: string): string {
  return LOCATION_LABELS[code] ?? code;
}

export const SLA_LABELS: Record<SlaEvaluationStatus, string> = {
  ON_TRACK: "Aman",
  WARNING: "Warning",
  BREACHED: "Breached",
  ACHIEVED: "Achieved",
};
