import type { SlaPauseInterval } from "./types";

/** Sum of completed + open pause intervals up to asOf. */
export function totalPausedMs(
  intervals: readonly SlaPauseInterval[],
  asOf: Date
): number {
  let total = 0;
  for (const interval of intervals) {
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
  return intervals.some((i) => i.endedAt == null);
}

export function openPauseInterval(
  intervals: readonly SlaPauseInterval[]
): SlaPauseInterval | null {
  return intervals.find((i) => i.endedAt == null) ?? null;
}
