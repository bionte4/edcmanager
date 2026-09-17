import {
  EDC_MUTATION_TYPES,
  EDC_UNIT_STATUSES,
  REGIONAL_OFFICES,
  type EdcMutationType,
  type EdcUnitStatus,
} from "@/config/assets.config";

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

function nowIso() {
  return new Date().toISOString();
}

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

const seed: EdcAsset[] = [
  {
    id: "asset-1",
    serialNumber: "ING-JKT-10021",
    brand: "Ingenico",
    regionalOffice: "RO Jakarta 1",
    status: "BUFFER",
    merchantId: null,
    vendorName: "Vendor 1",
    notes: "Cadangan VIP peak",
    createdAt: "2026-01-10T02:00:00.000Z",
    updatedAt: "2026-01-10T02:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-2",
    serialNumber: "VRF-JKT-10088",
    brand: "Verifone",
    regionalOffice: "RO Jakarta 1",
    status: "DEPLOYED",
    merchantId: "MID-102938",
    vendorName: "Vendor 1",
    createdAt: "2026-01-12T02:00:00.000Z",
    updatedAt: "2026-08-01T04:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-3",
    serialNumber: "PAX-BDG-20011",
    brand: "PAX",
    regionalOffice: "RO Bandung",
    status: "IDLE",
    merchantId: null,
    vendorName: "Vendor 2",
    notes: "Idle — kandidat pooling",
    createdAt: "2026-02-01T02:00:00.000Z",
    updatedAt: "2026-07-15T06:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-4",
    serialNumber: "ING-BDG-20044",
    brand: "Ingenico",
    regionalOffice: "RO Bandung",
    status: "BUFFER",
    merchantId: null,
    vendorName: "Vendor 2",
    createdAt: "2026-02-10T02:00:00.000Z",
    updatedAt: "2026-02-10T02:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-5",
    serialNumber: "CST-SBY-30001",
    brand: "Castles",
    regionalOffice: "RO Surabaya",
    status: "DEPLOYED",
    merchantId: "MID-778899",
    vendorName: "Vendor 1",
    createdAt: "2026-03-01T02:00:00.000Z",
    updatedAt: "2026-09-01T03:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-6",
    serialNumber: "PAX-SBY-30077",
    brand: "PAX",
    regionalOffice: "RO Surabaya",
    status: "BUFFER",
    merchantId: null,
    vendorName: "Vendor 1",
    createdAt: "2026-03-05T02:00:00.000Z",
    updatedAt: "2026-03-05T02:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-7",
    serialNumber: "VRF-DPS-40012",
    brand: "Verifone",
    regionalOffice: "RO Denpasar",
    status: "DEPLOYED",
    merchantId: "MID-441200",
    vendorName: "Vendor 2",
    createdAt: "2026-04-01T02:00:00.000Z",
    updatedAt: "2026-08-20T05:00:00.000Z",
    mutations: [],
  },
  {
    id: "asset-8",
    serialNumber: "ING-DPS-40055",
    brand: "Ingenico",
    regionalOffice: "RO Denpasar",
    status: "IDLE",
    merchantId: null,
    vendorName: "Vendor 2",
    notes: "Menunggu recall ke buffer",
    createdAt: "2026-04-12T02:00:00.000Z",
    updatedAt: "2026-09-10T01:00:00.000Z",
    mutations: [],
  },
];

let assets: EdcAsset[] = seed.map((a) => ({
  ...a,
  mutations: [...a.mutations],
}));

function clone(asset: EdcAsset): EdcAsset {
  return {
    ...asset,
    mutations: asset.mutations.map((m) => ({ ...m })),
  };
}

export function listAssets(): EdcAsset[] {
  return assets.map(clone);
}

export function findAssetById(id: string): EdcAsset | undefined {
  const found = assets.find((a) => a.id === id);
  return found ? clone(found) : undefined;
}

export function findAssetBySerial(serialNumber: string): EdcAsset | undefined {
  const sn = serialNumber.trim().toUpperCase();
  const found = assets.find((a) => a.serialNumber === sn);
  return found ? clone(found) : undefined;
}

export function assetKpis() {
  const all = assets;
  return {
    total: all.length,
    buffer: all.filter((a) => a.status === "BUFFER").length,
    deployed: all.filter((a) => a.status === "DEPLOYED").length,
    idle: all.filter((a) => a.status === "IDLE").length,
    regionalOffices: REGIONAL_OFFICES.length,
  };
}

export function createAsset(input: {
  serialNumber: string;
  brand: string;
  regionalOffice: string;
  status?: EdcUnitStatus;
  merchantId?: string | null;
  vendorName: string;
  notes?: string | null;
  actorName?: string;
}): EdcAsset {
  const serialNumber = input.serialNumber.trim().toUpperCase();
  const brand = input.brand.trim();
  const regionalOffice = input.regionalOffice.trim();
  const vendorName = input.vendorName.trim();
  const status = input.status ? assertStatus(input.status) : "BUFFER";

  if (!serialNumber) throw new Error("Serial number wajib.");
  if (!brand) throw new Error("Merek wajib.");
  if (!regionalOffice) throw new Error("Regional Office wajib.");
  if (!vendorName) throw new Error("Vendor wajib.");
  if (assets.some((a) => a.serialNumber === serialNumber)) {
    throw new Error("Serial number sudah terdaftar.");
  }
  if (status === "DEPLOYED" && !input.merchantId?.trim()) {
    throw new Error("Merchant ID wajib untuk status Deployed.");
  }

  const stamp = nowIso();
  const asset: EdcAsset = {
    id: `asset-${Date.now()}`,
    serialNumber,
    brand,
    regionalOffice,
    status,
    merchantId: status === "DEPLOYED" ? input.merchantId?.trim() || null : null,
    vendorName,
    notes: input.notes?.trim() || null,
    createdAt: stamp,
    updatedAt: stamp,
    mutations: [
      {
        id: `mut-${Date.now()}`,
        assetId: "",
        mutationType: "STATUS_CHANGE",
        fromStatus: null,
        toStatus: status,
        fromRegionalOffice: null,
        toRegionalOffice: regionalOffice,
        notes: "Asset registered",
        mutatedAt: stamp,
        mutatedBy: input.actorName ?? "system",
      },
    ],
  };
  asset.mutations[0]!.assetId = asset.id;
  assets = [asset, ...assets];
  return clone(asset);
}

export function updateAsset(
  id: string,
  patch: Partial<{
    serialNumber: string;
    brand: string;
    regionalOffice: string;
    vendorName: string;
    notes: string | null;
    merchantId: string | null;
  }>
): EdcAsset {
  const idx = assets.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Asset tidak ditemukan.");
  const current = assets[idx]!;

  const nextSerial = patch.serialNumber?.trim().toUpperCase() ?? current.serialNumber;
  if (assets.some((a) => a.id !== id && a.serialNumber === nextSerial)) {
    throw new Error("Serial number sudah terdaftar.");
  }

  const updated: EdcAsset = {
    ...current,
    serialNumber: nextSerial,
    brand: patch.brand?.trim() ?? current.brand,
    regionalOffice: patch.regionalOffice?.trim() ?? current.regionalOffice,
    vendorName: patch.vendorName?.trim() ?? current.vendorName,
    notes:
      patch.notes !== undefined ? patch.notes?.trim() || null : current.notes,
    merchantId:
      patch.merchantId !== undefined
        ? patch.merchantId?.trim() || null
        : current.merchantId,
    updatedAt: nowIso(),
  };

  if (!updated.brand) throw new Error("Merek wajib.");
  if (!updated.regionalOffice) throw new Error("Regional Office wajib.");
  if (!updated.vendorName) throw new Error("Vendor wajib.");

  assets[idx] = updated;
  return clone(updated);
}

export function deleteAsset(id: string): EdcAsset {
  const idx = assets.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Asset tidak ditemukan.");
  const [removed] = assets.splice(idx, 1);
  return clone(removed!);
}

export function mutateAsset(input: {
  id: string;
  mutationType: EdcMutationType | string;
  toStatus?: EdcUnitStatus | string;
  toRegionalOffice?: string;
  merchantId?: string | null;
  notes?: string;
  actorName?: string;
}): EdcAsset {
  const idx = assets.findIndex((a) => a.id === input.id);
  if (idx < 0) throw new Error("Asset tidak ditemukan.");

  const current = assets[idx]!;
  const mutationType = assertMutation(input.mutationType);
  const fromStatus = current.status;
  const fromRo = current.regionalOffice;
  let toStatus = current.status;
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

  const stamp = nowIso();
  const mutation: AssetMutation = {
    id: `mut-${Date.now()}`,
    assetId: current.id,
    mutationType,
    fromStatus,
    toStatus,
    fromRegionalOffice: fromRo,
    toRegionalOffice: toRo,
    notes: input.notes?.trim() || null,
    mutatedAt: stamp,
    mutatedBy: input.actorName ?? "system",
  };

  const updated: EdcAsset = {
    ...current,
    status: toStatus,
    regionalOffice: toRo,
    merchantId,
    updatedAt: stamp,
    mutations: [mutation, ...current.mutations],
  };
  assets[idx] = updated;
  return clone(updated);
}
