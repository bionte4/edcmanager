import { pauseCountsTowardSla } from "@/config/sla-pause.config";
import type { SlaPauseInterval } from "./types";

function isEffective(interval: SlaPauseInterval): boolean {
  return pauseCountsTowardSla(interval.approvalStatus);
}

/** Sum of completed + open effective pause intervals up to asOf. */
export function totalPausedMs(
  intervals: readonly SlaPauseInterval[],
  asOf: Date
): number {
  let total = 0;
  for (const interval of intervals) {
    if (!isEffective(interval)) continue;
    const start = interval.startedAt.getTime();
    const end = (interval.endedAt ?? asOf).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      total += end - start;
    }
  }
  return total;
}

export function isClockStopped(
  intervals: readonly SlaPauseInterval[]
): boolean {
  return intervals.some((i) => i.endedAt == null && isEffective(i));
}

export function openPauseInterval(
  intervals: readonly SlaPauseInterval[]
): SlaPauseInterval | null {
  return intervals.find((i) => i.endedAt == null && isEffective(i)) ?? null;
}

export function pendingPauseInterval(
  intervals: readonly SlaPauseInterval[]
): SlaPauseInterval | null {
  return (
    intervals.find(
      (i) => i.endedAt == null && i.approvalStatus === "PENDING"
    ) ?? null
  );
}
