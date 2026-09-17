/**
 * Liaison LO (DOG) — 2-shift windows Asia/Jakarta.
 * Adjust when BRI DOG roster policy changes.
 */

export const LO_SHIFT_WINDOWS = {
  DAY_DOG: {
    label: "DOG Siang",
    startMinutes: 7 * 60,
    endMinutes: 19 * 60,
  },
  NIGHT_DOG: {
    label: "DOG Malam",
    startMinutes: 19 * 60,
    endMinutes: 7 * 60,
  },
} as const;

export type LoShiftType = keyof typeof LO_SHIFT_WINDOWS;

export const LO_SHIFT_TYPES = Object.keys(LO_SHIFT_WINDOWS) as LoShiftType[];

export const LO_SHIFT_LABELS: Record<LoShiftType, string> = {
  DAY_DOG: LO_SHIFT_WINDOWS.DAY_DOG.label,
  NIGHT_DOG: LO_SHIFT_WINDOWS.NIGHT_DOG.label,
};

export function isLoShiftType(v: string): v is LoShiftType {
  return (LO_SHIFT_TYPES as readonly string[]).includes(v);
}

/** Opposite DOG shift for handover target. */
export function oppositeLoShift(type: LoShiftType): LoShiftType {
  return type === "DAY_DOG" ? "NIGHT_DOG" : "DAY_DOG";
}

export function resolveCurrentLoShiftType(now = new Date()): LoShiftType {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = hour * 60 + minute;
  const day = LO_SHIFT_WINDOWS.DAY_DOG;
  if (mins >= day.startMinutes && mins < day.endMinutes) return "DAY_DOG";
  return "NIGHT_DOG";
}
