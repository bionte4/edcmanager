import * as XLSX from "xlsx";
import {
  EDC_UNIT_STATUSES,
  type EdcUnitStatus,
} from "@/config/assets.config";
import {
  createAsset,
  findAssetBySerial,
  listAssets,
  updateAsset,
  type EdcAsset,
} from "@/data/assets-store";

export const ASSET_EXCEL_HEADERS = [
  "serialNumber",
  "brand",
  "regionalOffice",
  "status",
  "merchantId",
  "vendorName",
  "notes",
] as const;

export type AssetExcelRow = {
  serialNumber: string;
  brand: string;
  regionalOffice: string;
  status: string;
  merchantId: string;
  vendorName: string;
  notes: string;
};

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStatus(raw: string): EdcUnitStatus {
  const upper = raw.trim().toUpperCase();
  const aliases: Record<string, EdcUnitStatus> = {
    BUFFER: "BUFFER",
    DEPLOYED: "DEPLOYED",
    IDLE: "IDLE",
    Buffer: "BUFFER",
    Deployed: "DEPLOYED",
    Idle: "IDLE",
  };
  const mapped = aliases[raw.trim()] ?? aliases[upper];
  if (!mapped || !(EDC_UNIT_STATUSES as readonly string[]).includes(mapped)) {
    throw new Error(`Status tidak valid: "${raw}" (gunakan BUFFER|DEPLOYED|IDLE)`);
  }
  return mapped;
}

export function assetsToRows(assets: EdcAsset[]): AssetExcelRow[] {
  return assets.map((a) => ({
    serialNumber: a.serialNumber,
    brand: a.brand,
    regionalOffice: a.regionalOffice,
    status: a.status,
    merchantId: a.merchantId ?? "",
    vendorName: a.vendorName,
    notes: a.notes ?? "",
  }));
}

export function buildAssetsWorkbook(
  rows: AssetExcelRow[],
  sheetName = "Assets"
): XLSX.WorkBook {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...ASSET_EXCEL_HEADERS],
  });
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
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

export function buildAssetsExportBuffer(assets = listAssets()): Buffer {
  return workbookToBuffer(buildAssetsWorkbook(assetsToRows(assets)));
}

export function buildAssetsTemplateBuffer(): Buffer {
  const sample: AssetExcelRow[] = [
    {
      serialNumber: "ING-DEMO-00001",
      brand: "Ingenico",
      regionalOffice: "RO Jakarta 1",
      status: "BUFFER",
      merchantId: "",
      vendorName: "Vendor 1",
      notes: "Contoh baris template",
    },
  ];
  return workbookToBuffer(buildAssetsWorkbook(sample, "Template"));
}

export function parseAssetsWorkbook(buffer: ArrayBuffer | Buffer): AssetExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("File Excel kosong (tidak ada sheet).");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Sheet pertama tidak ditemukan.");

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (raw.length === 0) throw new Error("Tidak ada baris data di Excel.");

  return raw.map((row, index) => {
    const serialNumber = cell(
      row.serialNumber ?? row.SerialNumber ?? row["Serial Number"] ?? row.SN
    );
    if (!serialNumber) {
      throw new Error(`Baris ${index + 2}: serialNumber wajib diisi.`);
    }
    return {
      serialNumber,
      brand: cell(row.brand ?? row.Brand ?? row.Merek),
      regionalOffice: cell(
        row.regionalOffice ?? row.RegionalOffice ?? row.RO ?? row["Regional Office"]
      ),
      status: cell(row.status ?? row.Status),
      merchantId: cell(row.merchantId ?? row.MerchantId ?? row["Merchant ID"]),
      vendorName: cell(row.vendorName ?? row.VendorName ?? row.Vendor),
      notes: cell(row.notes ?? row.Notes ?? row.Catatan),
    };
  });
}

export interface ImportAssetsResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalRows: number;
}

export function importAssetRows(
  rows: AssetExcelRow[],
  options?: { actorName?: string }
): ImportAssetsResult {
  const result: ImportAssetsResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    totalRows: rows.length,
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      if (!row.brand) throw new Error("brand wajib");
      if (!row.regionalOffice) throw new Error("regionalOffice wajib");
      if (!row.vendorName) throw new Error("vendorName wajib");
      if (!row.status) throw new Error("status wajib");

      const status = normalizeStatus(row.status);
      const serial = row.serialNumber.trim().toUpperCase();
      const existing = findAssetBySerial(serial);

      if (existing) {
        updateAsset(existing.id, {
          serialNumber: serial,
          brand: row.brand,
          regionalOffice: row.regionalOffice,
          vendorName: row.vendorName,
          notes: row.notes || null,
          merchantId: status === "DEPLOYED" ? row.merchantId || null : null,
        });
        // If status differs, leave status as-is on update of master data only
        // (status changes should go through mutation). Still allow setting merchant for deployed.
        if (existing.status !== status) {
          result.errors.push(
            `Baris ${line} (${serial}): master data di-update; status tetap ${existing.status} (ubah via mutasi, bukan import).`
          );
        }
        result.updated += 1;
      } else {
        createAsset({
          serialNumber: serial,
          brand: row.brand,
          regionalOffice: row.regionalOffice,
          status,
          merchantId: row.merchantId || null,
          vendorName: row.vendorName,
          notes: row.notes || null,
          actorName: options?.actorName ?? "excel-import",
        });
        result.created += 1;
      }
    } catch (e) {
      result.skipped += 1;
      result.errors.push(
        `Baris ${line}: ${e instanceof Error ? e.message : "Gagal impor"}`
      );
    }
  }

  return result;
}
