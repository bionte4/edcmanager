import {
  DEMO_AS_OF,
  type BufferStockRow,
} from "@/data/dashboard";
import { loadVendorMetrics, type VendorMonthlyMetrics } from "@/data/vendors";
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
import { prisma } from "@/lib/prisma";

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

function monthStartUtc(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0, 1));
}

function formatMonthLabelId(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * National SLA trend from MetricLog (aggregated across vendors per month).
 */
export async function buildSlaTrendFromDb(
  asOf: Date = DEMO_AS_OF,
  months: number = EXECUTIVE_TREND_MONTHS
): Promise<MonthlyTrendPoint[]> {
  try {
    const end = monthStartUtc(asOf.getUTCFullYear(), asOf.getUTCMonth());
    const start = monthStartUtc(
      end.getUTCFullYear(),
      end.getUTCMonth() - (months - 1)
    );

    const logs = await prisma.metricLog.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      select: {
        date: true,
        uptimePercent: true,
        totalTickets: true,
        resolvedTickets: true,
        breachedTickets: true,
      },
    });

    const byMonth = new Map<
      string,
      {
        date: Date;
        totalTickets: number;
        resolvedTickets: number;
        breachedTickets: number;
        uptimeWeighted: number;
        uptimeWeight: number;
      }
    >();

    for (const log of logs) {
      const key = `${log.date.getUTCFullYear()}-${log.date.getUTCMonth()}`;
      const bucket = byMonth.get(key) ?? {
        date: monthStartUtc(log.date.getUTCFullYear(), log.date.getUTCMonth()),
        totalTickets: 0,
        resolvedTickets: 0,
        breachedTickets: 0,
        uptimeWeighted: 0,
        uptimeWeight: 0,
      };
      const uptime = Number(log.uptimePercent);
      const weight = Math.max(log.totalTickets, 1);
      bucket.totalTickets += log.totalTickets;
      bucket.resolvedTickets += log.resolvedTickets;
      bucket.breachedTickets += log.breachedTickets;
      bucket.uptimeWeighted += uptime * weight;
      bucket.uptimeWeight += weight;
      byMonth.set(key, bucket);
    }

    const points: MonthlyTrendPoint[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = monthStartUtc(end.getUTCFullYear(), end.getUTCMonth() - i);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      const bucket = byMonth.get(key);
      if (!bucket || bucket.totalTickets === 0) {
        points.push({
          monthLabel: formatMonthLabelId(d),
          slaCompliance: 0,
          uptimePercent: 0,
          breachedTickets: 0,
        });
        continue;
      }
      const denom = bucket.resolvedTickets + bucket.breachedTickets;
      const slaCompliance =
        denom > 0 ? (bucket.resolvedTickets / denom) * 100 : 100;
      points.push({
        monthLabel: formatMonthLabelId(d),
        slaCompliance,
        uptimePercent: bucket.uptimeWeighted / Math.max(bucket.uptimeWeight, 1),
        breachedTickets: bucket.breachedTickets,
      });
    }
    return points;
  } catch {
    return [];
  }
}

/** Safe placeholder when DB is unreachable (build / cold start). */
export function emptyExecutiveSummary(asOf: Date = DEMO_AS_OF): ExecutiveSummary {
  return {
    asOf: asOf.toISOString(),
    national: {
      slaCompliancePercent: 0,
      slaFloor: EXEC_SLA_COMPLIANCE_FLOOR,
      uptimePercent: 0,
      uptimeTarget: UPTIME_TARGET_PERCENT,
      breachedTickets: 0,
      openTickets: 0,
      penaltyRisk: "LOW",
    },
    buffer: {
      minPercent: BUFFER_STOCK_MIN_PERCENT,
      roTotal: 0,
      roBelow: 0,
      belowPercent: 0,
      rows: [],
    },
    deployment: {
      targetUnits: DEPLOYMENT_TARGET_UNITS,
      deployedUnits: 0,
      progressPercent: 0,
      byVendor: [],
    },
    vendors: [],
    trend: [],
    narrative: [
      "Data executive tidak tersedia — database belum terhubung atau belum di-seed.",
    ],
  };
}

export async function buildExecutiveSummary(
  asOf: Date = DEMO_AS_OF
): Promise<ExecutiveSummary> {
  const { summary } = await buildOpsReport(asOf);
  const vendors = await loadVendorMetrics();
  const bufferRows = summary.buffer.rows;
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

  const edc = await assetKpis();
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

  const trend = await buildSlaTrendFromDb(asOf);

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
    trend,
    narrative,
  };
}
