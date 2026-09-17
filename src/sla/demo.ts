/**
 * Smoke checks for the SLA engine (run: npm run sla:demo).
 */
import {
  calculateResolutionDuration,
  evaluateSlaStatus,
  generateMonthlyUptimeReport,
  getResolutionLimitMinutes,
  UPTIME_TARGET_PERCENT,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// Dalam Kota VIP peak: open 10:00 WIB → 2h limit; at 1h36m → WARNING
const openedPeak = new Date("2026-09-17T03:00:00.000Z"); // 10:00 Asia/Jakarta (UTC+7)
const limit = getResolutionLimitMinutes("DALAM_KOTA", "VIP", openedPeak);
assert(limit.isPeakHours === true, "expected peak hours");
assert(limit.limitMinutes === 120, "VIP peak limit must be 2 hours");
assert(limit.warningAtMinutes === 96, "80% of 120m = 96m (1h36m)");

const atWarning = new Date(openedPeak.getTime() + 96 * 60 * 1000);
const warningEval = evaluateSlaStatus(
  { location: "DALAM_KOTA", category: "VIP", itsmType: "INCIDENT", openedAt: openedPeak },
  atWarning
);
assert(warningEval.status === "WARNING", `expected WARNING, got ${warningEval.status}`);

const breached = evaluateSlaStatus(
  { location: "DALAM_KOTA", category: "VIP", openedAt: openedPeak },
  new Date(openedPeak.getTime() + 121 * 60 * 1000)
);
assert(breached.status === "BREACHED", `expected BREACHED, got ${breached.status}`);

const achieved = evaluateSlaStatus({
  location: "DALAM_KOTA",
  category: "VIP",
  openedAt: openedPeak,
  closedAt: new Date(openedPeak.getTime() + 90 * 60 * 1000),
});
assert(achieved.status === "ACHIEVED", `expected ACHIEVED, got ${achieved.status}`);

const duration = calculateResolutionDuration(
  openedPeak,
  new Date(openedPeak.getTime() + 90 * 60 * 1000)
);
assert(duration.formatted === "1h 30m", `expected 1h 30m, got ${duration.formatted}`);

// September 2026 = 30 days; 0.1% of month ≈ 43.2 minutes downtime → still meets 99.9%
const okReport = generateMonthlyUptimeReport({
  year: 2026,
  month: 9,
  downtimeMinutes: 40,
  vendorName: "Vendor 1",
});
assert(okReport.metTarget === true, "40m downtime should meet 99.9%");
assert(okReport.targetPercent === UPTIME_TARGET_PERCENT, "target must come from config");

const riskReport = generateMonthlyUptimeReport({
  year: 2026,
  month: 9,
  downtimeMinutes: 50,
  vendorName: "Vendor 2",
});
assert(riskReport.riskOfPenalty === true, "50m downtime should risk penalty");

const requestLimit = getResolutionLimitMinutes(
  "DALAM_KOTA",
  "NON_VIP",
  openedPeak,
  "REQUEST"
);
assert(requestLimit.limitMinutes === 3 * 24 * 60, "REQUEST default SLA should be 3 days");
assert(requestLimit.itsmType === "REQUEST", "itsmType should echo REQUEST");

console.log("SLA engine smoke checks passed.");
console.log(
  JSON.stringify(
    {
      vipPeakLimit: limit,
      warningEval: { status: warningEval.status, formatted: warningEval.duration.formatted },
      uptimeOk: okReport.uptimePercent,
      uptimeRisk: riskReport.uptimePercent,
    },
    null,
    2
  )
);
