import * as XLSX from "xlsx";
import {
  enumerateDates,
  parseYmd,
  resolveRosterPeriod,
  type RosterPeriodMode,
} from "@/config/wfm.config";
import { findUserByEmail, listUsers } from "@/data/users-store";
import {
  clearShiftsInRange,
  listWfmShifts,
  upsertShiftRow,
} from "@/data/wfm-store";
import type { NocShiftRow, ShiftDutyStatus, ShiftType } from "@/lib/ticketing";
import type { AppRole } from "@/config/rbac.config";

export const ROSTER_EXCEL_HEADERS = [
  "shiftDate",
  "email",
  "shiftType",
  "status",
  "notes",
] as const;

export type RosterExcelRow = {
  shiftDate: string;
  email: string;
  shiftType: string;
  status: string;
  notes: string;
};

const SHIFT_TYPES: ShiftType[] = ["MORNING", "AFTERNOON", "NIGHT"];
const DUTY_STATUSES: ShiftDutyStatus[] = ["SCHEDULED", "ON_DUTY", "OFF_DUTY"];

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date → YYYY-MM-DD
    if (value > 20000 && value < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + Math.round(value) * 86400000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  return String(value).trim();
}

function normalizeShiftType(raw: string): ShiftType {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  const aliases: Record<string, ShiftType> = {
    MORNING: "MORNING",
    PAGI: "MORNING",
    AFTERNOON: "AFTERNOON",
    Sore: "AFTERNOON",
    SORE: "AFTERNOON",
    NIGHT: "NIGHT",
    MALAM: "NIGHT",
  };
  const mapped = aliases[raw.trim()] ?? aliases[u];
  if (!mapped || !SHIFT_TYPES.includes(mapped)) {
    throw new Error(`shiftType tidak valid: "${raw}" (MORNING|AFTERNOON|NIGHT)`);
  }
  return mapped;
}

function normalizeStatus(raw: string): ShiftDutyStatus {
  if (!raw.trim()) return "SCHEDULED";
  const u = raw.trim().toUpperCase();
  if (!(DUTY_STATUSES as readonly string[]).includes(u)) {
    throw new Error(`status tidak valid: "${raw}" (SCHEDULED|ON_DUTY|OFF_DUTY)`);
  }
  return u as ShiftDutyStatus;
}

function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    parseYmd(s);
    return s;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (m) {
    const ymd = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    parseYmd(ymd);
    return ymd;
  }
  throw new Error(`shiftDate tidak valid: "${raw}" (pakai YYYY-MM-DD)`);
}

export async function shiftsToRosterRows(
  rows: NocShiftRow[]
): Promise<RosterExcelRow[]> {
  const users = await listUsers();
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((s) => ({
    shiftDate: s.shiftDate,
    email: emailById.get(s.userId) ?? "",
    shiftType: s.shiftType,
    status: s.status,
    notes: s.notes ?? "",
  }));
}

export function buildRosterWorkbook(
  rows: RosterExcelRow[],
  sheetName = "Roster"
): XLSX.WorkBook {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...ROSTER_EXCEL_HEADERS],
  });
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function buildRosterExportBuffer(
  from: string,
  to: string
): Promise<Buffer> {
  const rows = await shiftsToRosterRows(await listWfmShifts({ from, to }));
  return workbookToBuffer(buildRosterWorkbook(rows, "Roster"));
}

export async function buildRosterTemplateBuffer(opts: {
  mode: RosterPeriodMode;
  anchor?: string;
  from?: string;
  to?: string;
}): Promise<Buffer> {
  const period = resolveRosterPeriod(opts);
  const sampleUsers = (await listUsers()).filter(
    (u) => u.role === "NOC" || u.role === "SUPERVISOR"
  );
  const dates = enumerateDates(period.from, period.to).slice(0, 7);
  const sample: RosterExcelRow[] = [];
  for (const date of dates) {
    for (const u of sampleUsers.slice(0, 2)) {
      sample.push({
        shiftDate: date,
        email: u.email,
        shiftType: "MORNING",
        status: "SCHEDULED",
        notes: `Template ${period.label}`,
      });
    }
  }
  if (sample.length === 0) {
    sample.push({
      shiftDate: period.from,
      email: "andi.noc@edc.local",
      shiftType: "MORNING",
      status: "SCHEDULED",
      notes: "Contoh baris template",
    });
  }
  return workbookToBuffer(buildRosterWorkbook(sample, "Template"));
}

export function parseRosterWorkbook(buffer: ArrayBuffer | Buffer): RosterExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("File Excel kosong (tidak ada sheet).");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Sheet pertama tidak ditemukan.");

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  if (raw.length === 0) throw new Error("Tidak ada baris data di Excel.");

  return raw.map((row, i) => {
    const line = i + 2;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        if (k in row && cell(row[k]) !== "") return cell(row[k]);
      }
      // case-insensitive
      const lower = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
      );
      for (const k of keys) {
        const v = lower[k.toLowerCase()];
        if (v !== undefined && cell(v) !== "") return cell(v);
      }
      return "";
    };

    const shiftDate = pick("shiftDate", "ShiftDate", "Tanggal", "Date", "date");
    const email = pick("email", "Email", "UserEmail", "userEmail");
    const shiftType = pick("shiftType", "ShiftType", "Shift", "shift");
    const status = pick("status", "Status", "Duty", "duty");
    const notes = pick("notes", "Notes", "Catatan", "note");

    if (!shiftDate) throw new Error(`Baris ${line}: shiftDate wajib.`);
    if (!email) throw new Error(`Baris ${line}: email wajib.`);
    if (!shiftType) throw new Error(`Baris ${line}: shiftType wajib.`);

    return {
      shiftDate: normalizeDate(shiftDate),
      email: email.toLowerCase(),
      shiftType,
      status,
      notes,
    };
  });
}

export interface RosterImportResult {
  created: number;
  updated: number;
  cleared: number;
  errors: string[];
  from: string;
  to: string;
}

export async function importRosterRows(
  rows: RosterExcelRow[],
  opts?: { mode?: "merge" | "replace" }
): Promise<RosterImportResult> {
  if (rows.length === 0) throw new Error("Tidak ada baris untuk diimpor.");

  const dates = rows.map((r) => r.shiftDate).sort();
  const from = dates[0]!;
  const to = dates[dates.length - 1]!;
  let cleared = 0;
  if (opts?.mode === "replace") {
    cleared = await clearShiftsInRange(from, to);
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      const user = await findUserByEmail(row.email);
      if (!user) {
        throw new Error(`User tidak ditemukan untuk email "${row.email}"`);
      }
      if (user.role !== "NOC" && user.role !== "SUPERVISOR") {
        throw new Error(
          `Role ${user.role} tidak bisa di-roster (hanya NOC/SUPERVISOR)`
        );
      }
      const shiftType = normalizeShiftType(row.shiftType);
      const status = normalizeStatus(row.status);
      const existing = await listWfmShifts({
        date: row.shiftDate,
        userId: user.id,
        shiftType,
      });
      await upsertShiftRow({
        userId: user.id,
        userName: user.name,
        role: user.role as AppRole & NocShiftRow["role"],
        shiftDate: row.shiftDate,
        shiftType,
        status,
        notes: row.notes || null,
      });
      if (existing.length > 0 && opts?.mode !== "replace") updated += 1;
      else created += 1;
    } catch (e) {
      errors.push(`Baris ${line}: ${e instanceof Error ? e.message : "Error"}`);
    }
  }

  if (created + updated === 0 && errors.length > 0) {
    throw new Error(errors.slice(0, 5).join(" · "));
  }

  return { created, updated, cleared, errors, from, to };
}
