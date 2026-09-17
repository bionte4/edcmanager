import { UPTIME_TARGET_PERCENT } from "@/config/sla.config";
import { prisma } from "@/lib/prisma";

export interface VendorMonthlyMetrics {
  vendorId: string;
  vendorName: string;
  type: "DISTRIBUTOR" | "FMS";
  monthLabel: string;
  slaComplianceRate: number;
  avgResolutionHours: number;
  totalTickets: number;
  breachedTickets: number;
  operationalIssues: number;
  uptimePercent: number;
  allocationQuota: number;
  deployedUnits: number;
}

/** Fallback if DB empty — mirrors seed.mjs metric targets. */
export const MOCK_VENDOR_METRICS: VendorMonthlyMetrics[] = [
  {
    vendorId: "v1",
    vendorName: "Vendor 1",
    type: "FMS",
    monthLabel: "Sep 2026",
    slaComplianceRate: 96.4,
    avgResolutionHours: 1.8,
    totalTickets: 142,
    breachedTickets: 5,
    operationalIssues: 3,
    uptimePercent: 99.94,
    allocationQuota: 1200,
    deployedUnits: 1080,
  },
  {
    vendorId: "v2",
    vendorName: "Vendor 2",
    type: "DISTRIBUTOR",
    monthLabel: "Sep 2026",
    slaComplianceRate: 91.2,
    avgResolutionHours: 3.4,
    totalTickets: 128,
    breachedTickets: 11,
    operationalIssues: 8,
    uptimePercent: 99.86,
    allocationQuota: 900,
    deployedUnits: 820,
  },
];

export async function loadVendorMetrics(): Promise<VendorMonthlyMetrics[]> {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      include: {
        metricLogs: { orderBy: { date: "desc" }, take: 1 },
        edcUnits: { where: { status: "DEPLOYED" }, select: { id: true } },
      },
    });
    if (vendors.length === 0) return MOCK_VENDOR_METRICS;

    return vendors.map((v) => {
      const log = v.metricLogs[0];
      const total = log?.totalTickets ?? 0;
      const breached = log?.breachedTickets ?? 0;
      const resolved = log?.resolvedTickets ?? 0;
      const slaComplianceRate =
        resolved + breached > 0
          ? (resolved / (resolved + breached)) * 100
          : 100;
      const monthLabel = log
        ? new Intl.DateTimeFormat("id-ID", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }).format(log.date)
        : "—";
      return {
        vendorId: v.id,
        vendorName: v.name,
        type: v.type as "DISTRIBUTOR" | "FMS",
        monthLabel,
        slaComplianceRate,
        avgResolutionHours: 2.5,
        totalTickets: total,
        breachedTickets: breached,
        operationalIssues: 0,
        uptimePercent: log ? Number(log.uptimePercent) : UPTIME_TARGET_PERCENT,
        allocationQuota: v.allocationQuota,
        deployedUnits: v.edcUnits.length,
      };
    });
  } catch {
    return MOCK_VENDOR_METRICS;
  }
}

export interface VendorComparisonRow {
  metric: string;
  vendor1: string;
  vendor2: string;
  winner: string;
}

export function buildVendorComparison(
  vendors: VendorMonthlyMetrics[] = MOCK_VENDOR_METRICS
): VendorComparisonRow[] {
  const v1 = vendors.find((v) => v.vendorId === "v1") ?? vendors[0];
  const v2 = vendors.find((v) => v.vendorId === "v2") ?? vendors[1];
  if (!v1 || !v2) return [];

  const pick = (
    metric: string,
    a: number,
    b: number,
    format: (n: number) => string,
    higherIsBetter: boolean
  ): VendorComparisonRow => {
    let winner = "Tie";
    if (a !== b) {
      const aWins = higherIsBetter ? a > b : a < b;
      winner = aWins ? v1.vendorName : v2.vendorName;
    }
    return {
      metric,
      vendor1: format(a),
      vendor2: format(b),
      winner,
    };
  };

  return [
    pick("SLA compliance", v1.slaComplianceRate, v2.slaComplianceRate, (n) => `${n.toFixed(1)}%`, true),
    pick("Uptime", v1.uptimePercent, v2.uptimePercent, (n) => `${n.toFixed(2)}%`, true),
    pick("Breached tickets", v1.breachedTickets, v2.breachedTickets, (n) => String(n), false),
    pick("Deployed units", v1.deployedUnits, v2.deployedUnits, (n) => String(n), true),
  ];
}
