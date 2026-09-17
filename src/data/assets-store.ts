import {
  EDC_MUTATION_TYPES,
  EDC_UNIT_STATUSES,
  REGIONAL_OFFICES,
  type EdcMutationType,
  type EdcUnitStatus,
} from "@/config/assets.config";
import { prisma } from "@/lib/prisma";
import type {
  EdcMutationHistory,
  EdcUnit,
  MutationType,
  Vendor,
} from "@prisma/client";

export interface AssetMutation {
  id: string;
  assetId: string;
  mutationType: EdcMutationType;
  fromStatus?: EdcUnitStatus | null;
  toStatus?: EdcUnitStatus | null;
  fromRegionalOffice?: string | null;
  toRegionalOffice?: string | null;
  notes?: string | null;
  mutatedAt: string;
  mutatedBy?: string | null;
}

export interface EdcAsset {
  id: string;
  serialNumber: string;
  brand: string;
  regionalOffice: string;
  status: EdcUnitStatus;
  merchantId?: string | null;
  vendorName: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  mutations: AssetMutation[];
}

type UnitWithRelations = EdcUnit & {
  vendor: Vendor;
  mutationHistory: EdcMutationHistory[];
};

const unitInclude = {
  vendor: true,
  mutationHistory: { orderBy: { mutatedAt: "desc" as const } },
};

function assertStatus(value: string): EdcUnitStatus {
  if (!(EDC_UNIT_STATUSES as readonly string[]).includes(value)) {
    throw new Error("Status tidak valid.");
  }
  return value as EdcUnitStatus;
}

function assertMutation(value: string): EdcMutationType {
  if (!(EDC_MUTATION_TYPES as readonly string[]).includes(value)) {
    throw new Error("Tipe mutasi tidak valid.");
  }
  return value as EdcMutationType;
}

function mapMutation(row: EdcMutationHistory): AssetMutation {
  return {
    id: row.id,
    assetId: row.edcUnitId,
    mutationType: row.mutationType as EdcMutationType,
    fromStatus: (row.fromStatus as EdcUnitStatus | null) ?? null,
    toStatus: (row.toStatus as EdcUnitStatus | null) ?? null,
    fromRegionalOffice: row.fromRegionalOffice,
    toRegionalOffice: row.toRegionalOffice,
    notes: row.notes,
    mutatedAt: row.mutatedAt.toISOString(),
    mutatedBy: row.mutatedBy,
  };
}

/** EdcUnit has no notes column — surface registration notes from mutation history when present. */
function extractNotes(mutations: AssetMutation[]): string | null {
  const registered = mutations.find(
    (m) =>
      m.mutationType === "STATUS_CHANGE" &&
      m.notes &&
      m.notes !== "Asset registered"
  );
  if (registered?.notes) {
    const prefix = "Asset registered — ";
    if (registered.notes.startsWith(prefix)) {
      return registered.notes.slice(prefix.length) || null;
    }
    if (registered.notes !== "Asset registered") return registered.notes;
  }
  return null;
}

function mapAsset(row: UnitWithRelations): EdcAsset {
  const mutations = row.mutationHistory.map(mapMutation);
  return {
    id: row.id,
    serialNumber: row.serialNumber,
    brand: row.brand,
    regionalOffice: row.regionalOffice,
    status: row.status as EdcUnitStatus,
    merchantId: row.merchantId,
    vendorName: row.vendor.name,
    notes: extractNotes(mutations),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    mutations,
  };
}

async function resolveVendorId(vendorName: string): Promise<string> {
  const name = vendorName.trim();
  if (!name) throw new Error("Vendor wajib.");
  const vendor = await prisma.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, isActive: true },
  });
  if (!vendor) throw new Error(`Vendor tidak ditemukan: ${name}`);
  return vendor.id;
}

async function loadUnit(id: string): Promise<UnitWithRelations | null> {
  return prisma.edcUnit.findUnique({
    where: { id },
    include: unitInclude,
  });
}

export async function listAssets(): Promise<EdcAsset[]> {
  const rows = await prisma.edcUnit.findMany({
    include: unitInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapAsset);
}

export async function findAssetById(id: string): Promise<EdcAsset | undefined> {
  const row = await loadUnit(id);
  return row ? mapAsset(row) : undefined;
}

export async function findAssetBySerial(
  serialNumber: string
): Promise<EdcAsset | undefined> {
  const sn = serialNumber.trim().toUpperCase();
  const row = await prisma.edcUnit.findUnique({
    where: { serialNumber: sn },
    include: unitInclude,
  });
  return row ? mapAsset(row) : undefined;
}

export async function assetKpis() {
  const [total, buffer, deployed, idle] = await Promise.all([
    prisma.edcUnit.count(),
    prisma.edcUnit.count({ where: { status: "BUFFER" } }),
    prisma.edcUnit.count({ where: { status: "DEPLOYED" } }),
    prisma.edcUnit.count({ where: { status: "IDLE" } }),
  ]);
  return {
    total,
    buffer,
    deployed,
    idle,
    regionalOffices: REGIONAL_OFFICES.length,
  };
}

export async function createAsset(input: {
  serialNumber: string;
  brand: string;
  regionalOffice: string;
  status?: EdcUnitStatus;
  merchantId?: string | null;
  vendorName: string;
  notes?: string | null;
  actorName?: string;
}): Promise<EdcAsset> {
  const serialNumber = input.serialNumber.trim().toUpperCase();
  const brand = input.brand.trim();
  const regionalOffice = input.regionalOffice.trim();
  const vendorName = input.vendorName.trim();
  const status = input.status ? assertStatus(input.status) : "BUFFER";
  const notes = input.notes?.trim() || null;

  if (!serialNumber) throw new Error("Serial number wajib.");
  if (!brand) throw new Error("Merek wajib.");
  if (!regionalOffice) throw new Error("Regional Office wajib.");
  if (!vendorName) throw new Error("Vendor wajib.");
  if (status === "DEPLOYED" && !input.merchantId?.trim()) {
    throw new Error("Merchant ID wajib untuk status Deployed.");
  }

  const existing = await prisma.edcUnit.findUnique({
    where: { serialNumber },
  });
  if (existing) throw new Error("Serial number sudah terdaftar.");

  const vendorId = await resolveVendorId(vendorName);
  const mutationNotes = notes
    ? `Asset registered — ${notes}`
    : "Asset registered";

  const row = await prisma.edcUnit.create({
    data: {
      serialNumber,
      brand,
      regionalOffice,
      status,
      merchantId: status === "DEPLOYED" ? input.merchantId?.trim() || null : null,
      vendorId,
      mutationHistory: {
        create: {
          mutationType: "STATUS_CHANGE" satisfies MutationType,
          fromStatus: null,
          toStatus: status,
          fromRegionalOffice: null,
          toRegionalOffice: regionalOffice,
          notes: mutationNotes,
          mutatedBy: input.actorName ?? "system",
        },
      },
    },
    include: unitInclude,
  });

  return mapAsset(row);
}

export async function updateAsset(
  id: string,
  patch: Partial<{
    serialNumber: string;
    brand: string;
    regionalOffice: string;
    vendorName: string;
    notes: string | null;
    merchantId: string | null;
  }>
): Promise<EdcAsset> {
  const current = await loadUnit(id);
  if (!current) throw new Error("Asset tidak ditemukan.");

  const nextSerial =
    patch.serialNumber?.trim().toUpperCase() ?? current.serialNumber;
  if (nextSerial !== current.serialNumber) {
    const clash = await prisma.edcUnit.findUnique({
      where: { serialNumber: nextSerial },
    });
    if (clash) throw new Error("Serial number sudah terdaftar.");
  }

  const brand = patch.brand?.trim() ?? current.brand;
  const regionalOffice =
    patch.regionalOffice?.trim() ?? current.regionalOffice;
  const vendorName = patch.vendorName?.trim() ?? current.vendor.name;
  if (!brand) throw new Error("Merek wajib.");
  if (!regionalOffice) throw new Error("Regional Office wajib.");
  if (!vendorName) throw new Error("Vendor wajib.");

  const vendorId =
    vendorName.toLowerCase() === current.vendor.name.toLowerCase()
      ? current.vendorId
      : await resolveVendorId(vendorName);

  const merchantId =
    patch.merchantId !== undefined
      ? patch.merchantId?.trim() || null
      : current.merchantId;

  // Persist free-text notes via a STATUS_CHANGE history entry when notes change.
  const nextNotes =
    patch.notes !== undefined ? patch.notes?.trim() || null : undefined;
  const currentNotes = extractNotes(current.mutationHistory.map(mapMutation));
  const notesChanged =
    nextNotes !== undefined && nextNotes !== (currentNotes ?? null);

  const row = await prisma.edcUnit.update({
    where: { id },
    data: {
      serialNumber: nextSerial,
      brand,
      regionalOffice,
      vendorId,
      merchantId,
      ...(notesChanged
        ? {
            mutationHistory: {
              create: {
                mutationType: "STATUS_CHANGE" as MutationType,
                fromStatus: current.status,
                toStatus: current.status,
                fromRegionalOffice: current.regionalOffice,
                toRegionalOffice: regionalOffice,
                notes: nextNotes
                  ? `Asset registered — ${nextNotes}`
                  : "Asset registered",
                mutatedBy: "system",
              },
            },
          }
        : {}),
    },
    include: unitInclude,
  });

  return mapAsset(row);
}

export async function deleteAsset(id: string): Promise<EdcAsset> {
  const current = await loadUnit(id);
  if (!current) throw new Error("Asset tidak ditemukan.");

  const linkedTickets = await prisma.ticket.count({
    where: { edcUnitId: id },
  });
  if (linkedTickets > 0) {
    throw new Error("Asset tidak bisa dihapus karena masih terhubung ke ticket.");
  }

  await prisma.edcUnit.delete({ where: { id } });
  return mapAsset(current);
}

export async function mutateAsset(input: {
  id: string;
  mutationType: EdcMutationType | string;
  toStatus?: EdcUnitStatus | string;
  toRegionalOffice?: string;
  merchantId?: string | null;
  notes?: string;
  actorName?: string;
}): Promise<EdcAsset> {
  const current = await loadUnit(input.id);
  if (!current) throw new Error("Asset tidak ditemukan.");

  const mutationType = assertMutation(input.mutationType);
  const fromStatus = current.status as EdcUnitStatus;
  const fromRo = current.regionalOffice;
  let toStatus = current.status as EdcUnitStatus;
  let toRo = current.regionalOffice;
  let merchantId = current.merchantId ?? null;

  switch (mutationType) {
    case "DEPLOY":
      if (current.status === "DEPLOYED") throw new Error("Asset sudah deployed.");
      toStatus = "DEPLOYED";
      merchantId = input.merchantId?.trim() || null;
      if (!merchantId) throw new Error("Merchant ID wajib untuk deploy.");
      break;
    case "RECALL":
      if (current.status !== "DEPLOYED") {
        throw new Error("Hanya unit deployed yang bisa di-recall.");
      }
      toStatus = "BUFFER";
      merchantId = null;
      break;
    case "TRANSFER":
    case "POOLING": {
      const dest = input.toRegionalOffice?.trim();
      if (!dest) throw new Error("RO tujuan wajib.");
      if (dest === current.regionalOffice) throw new Error("RO tujuan harus berbeda.");
      toRo = dest;
      if (mutationType === "POOLING" && current.status === "IDLE") {
        toStatus = "BUFFER";
      }
      break;
    }
    case "BUFFER_TO_IDLE":
      if (current.status !== "BUFFER") throw new Error("Status harus Buffer.");
      toStatus = "IDLE";
      merchantId = null;
      break;
    case "IDLE_TO_BUFFER":
      if (current.status !== "IDLE") throw new Error("Status harus Idle.");
      toStatus = "BUFFER";
      merchantId = null;
      break;
    case "STATUS_CHANGE":
      if (!input.toStatus) throw new Error("toStatus wajib untuk STATUS_CHANGE.");
      toStatus = assertStatus(input.toStatus);
      if (input.toRegionalOffice?.trim()) toRo = input.toRegionalOffice.trim();
      if (toStatus === "DEPLOYED") {
        merchantId = input.merchantId?.trim() || merchantId;
        if (!merchantId) throw new Error("Merchant ID wajib untuk Deployed.");
      } else {
        merchantId = null;
      }
      break;
    default:
      throw new Error("Tipe mutasi tidak dikenali.");
  }

  const row = await prisma.edcUnit.update({
    where: { id: input.id },
    data: {
      status: toStatus,
      regionalOffice: toRo,
      merchantId,
      mutationHistory: {
        create: {
          mutationType: mutationType as MutationType,
          fromStatus,
          toStatus,
          fromRegionalOffice: fromRo,
          toRegionalOffice: toRo,
          notes: input.notes?.trim() || null,
          mutatedBy: input.actorName ?? "system",
        },
      },
    },
    include: unitInclude,
  });

  return mapAsset(row);
}
