import { UPTIME_TARGET_PERCENT } from "@/config/sla.config";

export interface VendorMonthlyMetrics {
  vendorId: string;
  vendorName: string;
  type: "DISTRIBUTOR" | "FMS";
  monthLabel: string;
  /** Tickets closed within SLA / total closed */
  slaComplianceRate: number;
  avgResolutionHours: number;
  totalTickets: number;
  breachedTickets: number;
  /** Operational incidents (spare part delay, tech no-show, etc.) */
  operationalIssues: number;
  uptimePercent: number;
  allocationQuota: number;
  deployedUnits: number;
}

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

export interface VendorComparisonRow {
  metric: string;
  vendor1: string;
  vendor2: string;
  winner: "Vendor 1" | "Vendor 2" | "Tie";
}

export function buildVendorComparison(
  vendors: VendorMonthlyMetrics[] = MOCK_VENDOR_METRICS
): VendorComparisonRow[] {
  const v1 = vendors.find((v) => v.vendorId === "v1");
  const v2 = vendors.find((v) => v.vendorId === "v2");
  if (!v1 || !v2) return [];

  const pick = (
    metric: string,
    a: number,
    b: number,
    format: (n: number) => string,
    higherIsBetter: boolean
  ): VendorComparisonRow => {
    let winner: VendorComparisonRow["winner"] = "Tie";
    if (a !== b) {
      const aWins = higherIsBetter ? a > b : a < b;
      winner = aWins ? "Vendor 1" : "Vendor 2";
    }
    return {
      metric,
      vendor1: format(a),
      vendor2: format(b),
      winner,
    };
  };

  return [
    pick("SLA Compliance Rate", v1.slaComplianceRate, v2.slaComplianceRate, (n) => `${n.toFixed(1)}%`, true),
    pick("Avg Resolution Time", v1.avgResolutionHours, v2.avgResolutionHours, (n) => `${n.toFixed(1)} jam`, false),
    pick("Operational Issues", v1.operationalIssues, v2.operationalIssues, (n) => `${n}`, false),
    pick("Tickets Breached", v1.breachedTickets, v2.breachedTickets, (n) => `${n}`, false),
    pick("Uptime", v1.uptimePercent, v2.uptimePercent, (n) => `${n.toFixed(2)}%`, true),
    pick("Deployed Units", v1.deployedUnits, v2.deployedUnits, (n) => `${n}`, true),
  ];
}

export { UPTIME_TARGET_PERCENT };
