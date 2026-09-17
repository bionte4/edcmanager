/**
 * NOC shift windows (Asia/Jakarta) — adjust when ops policy changes.
 * Times are minutes-from-midnight, end exclusive.
 */
export const NOC_SHIFT_WINDOWS = {
  MORNING: { label: "Pagi", startMinutes: 6 * 60, endMinutes: 14 * 60 },
  AFTERNOON: { label: "Siang", startMinutes: 14 * 60, endMinutes: 22 * 60 },
  NIGHT: { label: "Malam", startMinutes: 22 * 60, endMinutes: 6 * 60 },
} as const;

export type NocShiftType = keyof typeof NOC_SHIFT_WINDOWS;

/** Label for any roster shift type (NOC 3-shift or LO DOG). */
export function shiftTypeLabel(shiftType: string): string {
  if (shiftType in NOC_SHIFT_WINDOWS) {
    return NOC_SHIFT_WINDOWS[shiftType as NocShiftType].label;
  }
  if (shiftType === "DAY_DOG") return "DOG Siang";
  if (shiftType === "NIGHT_DOG") return "DOG Malam";
  return shiftType;
}

/** Allowed ticket status transitions for NOC workflow. */
export const TICKET_STATUS_TRANSITIONS = {
  OPEN: ["ACKNOWLEDGED", "CLOSED"],
  ACKNOWLEDGED: ["DISPATCHED", "CLOSED"],
  DISPATCHED: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
} as const;

export type WorkflowTicketStatus = keyof typeof TICKET_STATUS_TRANSITIONS;

export const TICKET_STATUS_LABELS: Record<WorkflowTicketStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  DISPATCHED: "Dispatched",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
