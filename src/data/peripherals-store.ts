import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  DEFAULT_PERIPHERAL_MIN_STOCK,
  PERIPHERAL_CATEGORIES,
  STOCK_MUTATION_TYPES,
  type PeripheralCategory,
  type PeripheralUnit,
  type StockMutationType,
} from "@/config/peripherals.config";

export interface StockMutation {
  id: string;
  skuId: string;
  type: StockMutationType;
  quantity: number;
  fromRo?: string | null;
  toRo?: string | null;
  notes?: string | null;
  mutatedAt: string;
  mutatedBy?: string | null;
}

export interface PeripheralSku {
  id: string;
  skuCode: string;
  name: string;
  category: PeripheralCategory;
  unit: PeripheralUnit;
  minStock: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Stock balance keyed by `${skuId}::${regionalOffice}` */
export interface StockBalance {
  skuId: string;
  regionalOffice: string;
  quantity: number;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

function balKey(skuId: string, ro: string) {
  return `${skuId}::${ro}`;
}

function assertCategory(v: string): PeripheralCategory {
  if (!(PERIPHERAL_CATEGORIES as readonly string[]).includes(v)) {
    throw new Error("Kategori peripheral tidak valid.");
  }
  return v as PeripheralCategory;
}

function assertMutation(v: string): StockMutationType {
  if (!(STOCK_MUTATION_TYPES as readonly string[]).includes(v)) {
    throw new Error("Tipe mutasi stok tidak valid.");
  }
  return v as StockMutationType;
}

const seedSkus: PeripheralSku[] = [
  {
    id: "sku-cable-usb",
    skuCode: "CBL-USB-1M",
    name: "Kabel USB EDC 1m",
    category: "CABLE",
    unit: "pcs",
    minStock: 50,
    notes: "Standar deploy",
    isActive: true,
    createdAt: "2026-01-05T02:00:00.000Z",
    updatedAt: "2026-01-05T02:00:00.000Z",
  },
  {
    id: "sku-cable-pwr",
    skuCode: "CBL-PWR-ADAPTER",
    name: "Kabel Power / Adapter",
    category: "CABLE",
    unit: "pcs",
    minStock: 40,
    isActive: true,
    createdAt: "2026-01-05T02:00:00.000Z",
    updatedAt: "2026-01-05T02:00:00.000Z",
  },
  {
    id: "sku-paper-57",
    skuCode: "PPR-57MM",
    name: "Kertas thermal 57mm",
    category: "PAPER_ROLL",
    unit: "roll",
    minStock: 200,
    isActive: true,
    createdAt: "2026-01-05T02:00:00.000Z",
    updatedAt: "2026-01-05T02:00:00.000Z",
  },
  {
    id: "sku-sim-xl",
    skuCode: "SIM-XL-DATA",
    name: "SIM XL Data M2M",
    category: "SIM_CARD",
    unit: "pcs",
    minStock: 30,
    isActive: true,
    createdAt: "2026-01-08T02:00:00.000Z",
    updatedAt: "2026-01-08T02:00:00.000Z",
  },
  {
    id: "sku-spare-batt",
    skuCode: "SPR-BATT-PAX",
    name: "Battery spare PAX",
    category: "SPARE_PART",
    unit: "pcs",
    minStock: 15,
    isActive: true,
    createdAt: "2026-02-01T02:00:00.000Z",
    updatedAt: "2026-02-01T02:00:00.000Z",
  },
];

const seedBalances: Array<[string, string, number]> = [
  ["sku-cable-usb", "RO Jakarta 1", 80],
  ["sku-cable-usb", "RO Bandung", 18],
  ["sku-cable-usb", "RO Surabaya", 45],
  ["sku-cable-usb", "RO Denpasar", 12],
  ["sku-cable-pwr", "RO Jakarta 1", 55],
  ["sku-cable-pwr", "RO Bandung", 22],
  ["sku-cable-pwr", "RO Surabaya", 30],
  ["sku-cable-pwr", "RO Denpasar", 8],
  ["sku-paper-57", "RO Jakarta 1", 320],
  ["sku-paper-57", "RO Bandung", 90],
  ["sku-paper-57", "RO Surabaya", 150],
  ["sku-paper-57", "RO Denpasar", 40],
  ["sku-sim-xl", "RO Jakarta 1", 60],
  ["sku-sim-xl", "RO Bandung", 25],
  ["sku-sim-xl", "RO Surabaya", 28],
  ["sku-sim-xl", "RO Denpasar", 10],
  ["sku-spare-batt", "RO Jakarta 1", 20],
  ["sku-spare-batt", "RO Bandung", 6],
  ["sku-spare-batt", "RO Surabaya", 12],
  ["sku-spare-batt", "RO Denpasar", 4],
];

let skus: PeripheralSku[] = seedSkus.map((s) => ({ ...s }));
let balances = new Map<string, StockBalance>();
let mutations: StockMutation[] = [];

function resetBalancesFromSeed() {
  balances = new Map();
  for (const [skuId, ro, qty] of seedBalances) {
    balances.set(balKey(skuId, ro), {
      skuId,
      regionalOffice: ro,
      quantity: qty,
      updatedAt: nowIso(),
    });
  }
  mutations = [];
}

resetBalancesFromSeed();

function getQty(skuId: string, ro: string): number {
  return balances.get(balKey(skuId, ro))?.quantity ?? 0;
}

function setQty(skuId: string, ro: string, quantity: number) {
  if (quantity < 0) throw new Error("Stok tidak boleh negatif.");
  balances.set(balKey(skuId, ro), {
    skuId,
    regionalOffice: ro,
    quantity,
    updatedAt: nowIso(),
  });
}

export function listPeripheralSkus(opts?: {
  category?: PeripheralCategory;
  activeOnly?: boolean;
  q?: string;
}): PeripheralSku[] {
  const q = opts?.q?.trim().toLowerCase();
  return skus
    .filter((s) => (opts?.activeOnly ? s.isActive : true))
    .filter((s) => (opts?.category ? s.category === opts.category : true))
    .filter((s) =>
      q
        ? s.skuCode.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
        : true
    )
    .map((s) => ({ ...s }))
    .sort((a, b) => a.skuCode.localeCompare(b.skuCode));
}

export function findPeripheralSku(id: string): PeripheralSku | null {
  const found = skus.find((s) => s.id === id);
  return found ? { ...found } : null;
}

export function listStockBalances(opts?: {
  skuId?: string;
  regionalOffice?: string;
}): StockBalance[] {
  return [...balances.values()]
    .filter((b) => (opts?.skuId ? b.skuId === opts.skuId : true))
    .filter((b) =>
      opts?.regionalOffice ? b.regionalOffice === opts.regionalOffice : true
    )
    .map((b) => ({ ...b }))
    .sort(
      (a, b) =>
        a.regionalOffice.localeCompare(b.regionalOffice) ||
        a.skuId.localeCompare(b.skuId)
    );
}

export interface StockAlertRow {
  skuId: string;
  skuCode: string;
  name: string;
  category: PeripheralCategory;
  unit: PeripheralUnit;
  regionalOffice: string;
  quantity: number;
  minStock: number;
  belowMin: boolean;
}

export function listStockAlerts(): StockAlertRow[] {
  const rows: StockAlertRow[] = [];
  for (const sku of skus.filter((s) => s.isActive)) {
    for (const ro of REGIONAL_OFFICES) {
      const quantity = getQty(sku.id, ro);
      const belowMin = quantity < sku.minStock;
      if (belowMin) {
        rows.push({
          skuId: sku.id,
          skuCode: sku.skuCode,
          name: sku.name,
          category: sku.category,
          unit: sku.unit,
          regionalOffice: ro,
          quantity,
          minStock: sku.minStock,
          belowMin: true,
        });
      }
    }
  }
  return rows.sort((a, b) => a.quantity - b.quantity);
}

export function peripheralKpis() {
  const active = skus.filter((s) => s.isActive);
  const alerts = listStockAlerts();
  let totalQty = 0;
  for (const b of balances.values()) totalQty += b.quantity;
  return {
    skuCount: active.length,
    totalQuantity: totalQty,
    alertCount: alerts.length,
    roCount: REGIONAL_OFFICES.length,
  };
}

export interface PeripheralSkuInput {
  skuCode: string;
  name: string;
  category: PeripheralCategory;
  unit: PeripheralUnit;
  minStock?: number;
  notes?: string;
  isActive?: boolean;
}

export function createPeripheralSku(input: PeripheralSkuInput): PeripheralSku {
  const code = input.skuCode.trim().toUpperCase();
  if (!code) throw new Error("SKU code wajib diisi.");
  if (!input.name?.trim()) throw new Error("Nama wajib diisi.");
  assertCategory(input.category);
  if (skus.some((s) => s.skuCode === code)) {
    throw new Error(`SKU "${code}" sudah ada.`);
  }
  const row: PeripheralSku = {
    id: `sku-${Date.now()}`,
    skuCode: code,
    name: input.name.trim(),
    category: input.category,
    unit: input.unit,
    minStock: input.minStock ?? DEFAULT_PERIPHERAL_MIN_STOCK,
    notes: input.notes?.trim() || null,
    isActive: input.isActive ?? true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  skus = [...skus, row];
  for (const ro of REGIONAL_OFFICES) {
    setQty(row.id, ro, 0);
  }
  return { ...row };
}

export function updatePeripheralSku(
  id: string,
  input: Partial<PeripheralSkuInput>
): PeripheralSku {
  const idx = skus.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("SKU tidak ditemukan.");
  const current = skus[idx]!;
  const nextCode = (input.skuCode ?? current.skuCode).trim().toUpperCase();
  if (skus.some((s) => s.skuCode === nextCode && s.id !== id)) {
    throw new Error(`SKU "${nextCode}" sudah ada.`);
  }
  if (input.category) assertCategory(input.category);
  const updated: PeripheralSku = {
    ...current,
    skuCode: nextCode,
    name: (input.name ?? current.name).trim(),
    category: input.category ?? current.category,
    unit: input.unit ?? current.unit,
    minStock: input.minStock ?? current.minStock,
    notes:
      input.notes !== undefined
        ? input.notes.trim() || null
        : current.notes,
    isActive: input.isActive ?? current.isActive,
    updatedAt: nowIso(),
  };
  skus[idx] = updated;
  return { ...updated };
}

export function deletePeripheralSku(id: string): void {
  const row = skus.find((s) => s.id === id);
  if (!row) throw new Error("SKU tidak ditemukan.");
  skus = skus.filter((s) => s.id !== id);
  for (const key of [...balances.keys()]) {
    if (key.startsWith(`${id}::`)) balances.delete(key);
  }
  mutations = mutations.filter((m) => m.skuId !== id);
}

export interface StockMutateInput {
  skuId: string;
  type: StockMutationType;
  quantity: number;
  regionalOffice?: string;
  fromRo?: string;
  toRo?: string;
  notes?: string;
  mutatedBy?: string;
}

export function mutatePeripheralStock(input: StockMutateInput): {
  balances: StockBalance[];
  mutation: StockMutation;
} {
  const sku = findPeripheralSku(input.skuId);
  if (!sku) throw new Error("SKU tidak ditemukan.");
  const type = assertMutation(input.type);
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity harus angka > 0.");
  }

  if (type === "TRANSFER") {
    const fromRo = input.fromRo?.trim();
    const toRo = input.toRo?.trim();
    if (!fromRo || !toRo) throw new Error("fromRo dan toRo wajib untuk TRANSFER.");
    if (fromRo === toRo) throw new Error("RO asal dan tujuan harus berbeda.");
    const fromQty = getQty(sku.id, fromRo);
    if (fromQty < qty) {
      throw new Error(`Stok ${fromRo} tidak cukup (tersedia ${fromQty}).`);
    }
    setQty(sku.id, fromRo, fromQty - qty);
    setQty(sku.id, toRo, getQty(sku.id, toRo) + qty);
    const mutation: StockMutation = {
      id: `smut-${Date.now()}`,
      skuId: sku.id,
      type,
      quantity: qty,
      fromRo,
      toRo,
      notes: input.notes?.trim() || null,
      mutatedAt: nowIso(),
      mutatedBy: input.mutatedBy ?? null,
    };
    mutations = [mutation, ...mutations].slice(0, 200);
    return {
      balances: listStockBalances({ skuId: sku.id }),
      mutation,
    };
  }

  const ro = (input.regionalOffice ?? input.toRo ?? input.fromRo)?.trim();
  if (!ro) throw new Error("regionalOffice wajib diisi.");

  const current = getQty(sku.id, ro);
  if (type === "IN") {
    setQty(sku.id, ro, current + qty);
  } else if (type === "OUT") {
    if (current < qty) {
      throw new Error(`Stok ${ro} tidak cukup (tersedia ${current}).`);
    }
    setQty(sku.id, ro, current - qty);
  } else if (type === "ADJUST") {
    setQty(sku.id, ro, qty);
  }

  const mutation: StockMutation = {
    id: `smut-${Date.now()}`,
    skuId: sku.id,
    type,
    quantity: qty,
    fromRo: type === "OUT" ? ro : null,
    toRo: type === "IN" || type === "ADJUST" ? ro : null,
    notes: input.notes?.trim() || null,
    mutatedAt: nowIso(),
    mutatedBy: input.mutatedBy ?? null,
  };
  mutations = [mutation, ...mutations].slice(0, 200);
  return {
    balances: listStockBalances({ skuId: sku.id }),
    mutation,
  };
}

export function listStockMutations(skuId?: string, limit = 50): StockMutation[] {
  return mutations
    .filter((m) => (skuId ? m.skuId === skuId : true))
    .slice(0, limit)
    .map((m) => ({ ...m }));
}

export function resetPeripherals(): {
  skus: PeripheralSku[];
  kpis: ReturnType<typeof peripheralKpis>;
} {
  skus = seedSkus.map((s) => ({ ...s }));
  resetBalancesFromSeed();
  return { skus: listPeripheralSkus(), kpis: peripheralKpis() };
}
