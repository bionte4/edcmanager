import {
  DEMO_AS_OF,
  MOCK_BUFFER_STOCK,
  type BufferStockRow,
} from "@/data/dashboard";
import { MOCK_VENDOR_METRICS, type VendorMonthlyMetrics } from "@/data/vendors";
import { buildOpsReport } from "@/data/reporting";
import { assetKpis } from "@/data/assets-store";
import {
  DEPLOYMENT_TARGET_UNITS,
  EXEC_BREACH_ALERT_COUNT,
  EXEC_SLA_COMPLIANCE_FLOOR,
  EXECUTIVE_TREND_MONTHS,
} from "@/config/executive.config";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import { UPTIME_TARGET_PERCENT } from "@/config/sla.config";

export interface MonthlyTrendPoint {
  monthLabel: string;
  slaCompliance: number;
  uptimePercent: number;
  breachedTickets: number;
}

export interface ExecutiveSummary {
  asOf: string;
  national: {
    slaCompliancePercent: number;
    slaFloor: number;
    uptimePercent: number;
    uptimeTarget: number;
    breachedTickets: number;
    openTickets: number;
    penaltyRisk: "LOW" | "MEDIUM" | "HIGH";
  };
  buffer: {
    minPercent: number;
    roTotal: number;
    roBelow: number;
    belowPercent: number;
    rows: BufferStockRow[];
  };
  deployment: {
    targetUnits: number;
    deployedUnits: number;
    progressPercent: number;
    byVendor: Array<{
      vendorName: string;
      quota: number;
      deployed: number;
      progressPercent: number;
    }>;
  };
  vendors: VendorMonthlyMetrics[];
  trend: MonthlyTrendPoint[];
  narrative: string[];
}

function penaltyRisk(opts: {
  breached: number;
  uptime: number;
  bufferBelowPct: number;
}): ExecutiveSummary["national"]["penaltyRisk"] {
  let score = 0;
  if (opts.breached >= EXEC_BREACH_ALERT_COUNT) score += 2;
  else if (opts.breached > 0) score += 1;
  if (opts.uptime < UPTIME_TARGET_PERCENT) score += 2;
  else if (opts.uptime < UPTIME_TARGET_PERCENT + 0.02) score += 1;
  if (opts.bufferBelowPct > 40) score += 2;
  else if (opts.bufferBelowPct > 0) score += 1;
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

/** Synthetic 6-month trend seeded from current vendor metrics (demo). */
function buildTrend(vendors: VendorMonthlyMetrics[]): MonthlyTrendPoint[] {
  const avgSla =
    vendors.reduce((s, v) => s + v.slaComplianceRate, 0) / Math.max(vendors.length, 1);
  const avgUptime =
    vendors.reduce((s, v) => s + v.uptimePercent, 0) / Math.max(vendors.length, 1);
  const breaches = vendors.reduce((s, v) => s + v.breachedTickets, 0);

  const labels = [
    "Apr 2026",
    "Mei 2026",
    "Jun 2026",
    "Jul 2026",
    "Agu 2026",
    "Sep 2026",
  ].slice(-EXECUTIVE_TREND_MONTHS);

  return labels.map((monthLabel, i) => {
    const drift = (i - labels.length + 1) * 0.35;
    return {
      monthLabel,
      slaCompliance: Math.min(99.5, Math.max(88, avgSla + drift)),
      uptimePercent: Math.min(99.99, Math.max(99.7, avgUptime + drift * 0.01)),
      breachedTickets: Math.max(0, Math.round(breaches / labels.length - drift)),
    };
  });
}

export function buildExecutiveSummary(
  asOf: Date = DEMO_AS_OF
): ExecutiveSummary {
  const { summary } = buildOpsReport(asOf);
  const vendors = MOCK_VENDOR_METRICS;
  const bufferRows = MOCK_BUFFER_STOCK;
  const roBelow = bufferRows.filter((r) => r.belowThreshold).length;
  const belowPercent =
    bufferRows.length > 0 ? (roBelow / bufferRows.length) * 100 : 0;

  const weightedSla =
    vendors.reduce((s, v) => s + v.slaComplianceRate * v.totalTickets, 0) /
    Math.max(
      vendors.reduce((s, v) => s + v.totalTickets, 0),
      1
    );
  const weightedUptime =
    vendors.reduce((s, v) => s + v.uptimePercent * v.deployedUnits, 0) /
    Math.max(
      vendors.reduce((s, v) => s + v.deployedUnits, 0),
      1
    );
  const breached = vendors.reduce((s, v) => s + v.breachedTickets, 0);

  const edc = assetKpis();
  const deployedFromAssets = edc.deployed;
  const deployedFromVendors = vendors.reduce((s, v) => s + v.deployedUnits, 0);
  const deployedUnits = Math.max(deployedFromAssets, deployedFromVendors);
  const progressPercent = (deployedUnits / DEPLOYMENT_TARGET_UNITS) * 100;

  const risk = penaltyRisk({
    breached,
    uptime: weightedUptime,
    bufferBelowPct: belowPercent,
  });

  const narrative: string[] = [];
  if (risk === "HIGH") {
    narrative.push(
      "Risiko penalti tinggi — prioritaskan tiket breached dan RO buffer di bawah 10%."
    );
  } else if (risk === "MEDIUM") {
    narrative.push(
      "Ada tekanan SLA/buffer — pantau vendor dengan compliance terendah minggu ini."
    );
  } else {
    narrative.push(
      "Posisi nasional relatif aman vs target SLA & uptime 99.9%."
    );
  }
  if (weightedSla < EXEC_SLA_COMPLIANCE_FLOOR) {
    narrative.push(
      `SLA compliance nasional ${weightedSla.toFixed(1)}% di bawah lantai ${EXEC_SLA_COMPLIANCE_FLOOR}%.`
    );
  }
  if (roBelow > 0) {
    narrative.push(
      `${roBelow}/${bufferRows.length} RO buffer di bawah ambang ${BUFFER_STOCK_MIN_PERCENT}% — pertimbangkan pooling.`
    );
  }
  narrative.push(
    `Progres deployment ${progressPercent.toFixed(1)}% dari kuota 3 tahun (${deployedUnits.toLocaleString("id-ID")} / ${DEPLOYMENT_TARGET_UNITS.toLocaleString("id-ID")} unit).`
  );

  return {
    asOf: asOf.toISOString(),
    national: {
      slaCompliancePercent: weightedSla,
      slaFloor: EXEC_SLA_COMPLIANCE_FLOOR,
      uptimePercent: weightedUptime,
      uptimeTarget: UPTIME_TARGET_PERCENT,
      breachedTickets: breached,
      openTickets: summary.tickets.open,
      penaltyRisk: risk,
    },
    buffer: {
      minPercent: BUFFER_STOCK_MIN_PERCENT,
      roTotal: bufferRows.length,
      roBelow,
      belowPercent,
      rows: bufferRows,
    },
    deployment: {
      targetUnits: DEPLOYMENT_TARGET_UNITS,
      deployedUnits,
      progressPercent,
      byVendor: vendors.map((v) => ({
        vendorName: v.vendorName,
        quota: v.allocationQuota,
        deployed: v.deployedUnits,
        progressPercent: (v.deployedUnits / Math.max(v.allocationQuota, 1)) * 100,
      })),
    },
    vendors,
    trend: buildTrend(vendors),
    narrative,
  };
}
