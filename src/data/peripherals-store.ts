import { REGIONAL_OFFICES } from "@/config/assets.config";
import {
  DEFAULT_PERIPHERAL_MIN_STOCK,
  PERIPHERAL_CATEGORIES,
  STOCK_MUTATION_TYPES,
  type PeripheralCategory,
  type PeripheralUnit,
  type StockMutationType,
} from "@/config/peripherals.config";
import { prisma } from "@/lib/prisma";
import type {
  PeripheralBalance as PrismaBalance,
  PeripheralMutation as PrismaMutation,
  PeripheralSku as PrismaSku,
  StockMutationType as PrismaMutationType,
} from "@prisma/client";

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

function mapSku(row: PrismaSku): PeripheralSku {
  return {
    id: row.id,
    skuCode: row.skuCode,
    name: row.name,
    category: row.category as PeripheralCategory,
    unit: row.unit as PeripheralUnit,
    minStock: row.minStock,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBalance(row: PrismaBalance): StockBalance {
  return {
    skuId: row.skuId,
    regionalOffice: row.regionalOffice,
    quantity: row.quantity,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMutation(row: PrismaMutation): StockMutation {
  return {
    id: row.id,
    skuId: row.skuId,
    type: row.type as StockMutationType,
    quantity: row.quantity,
    fromRo: row.fromRo,
    toRo: row.toRo,
    notes: row.notes,
    mutatedAt: row.mutatedAt.toISOString(),
    mutatedBy: row.mutatedBy,
  };
}

const SEED_SKUS: Array<{
  id: string;
  skuCode: string;
  name: string;
  category: PeripheralCategory;
  unit: PeripheralUnit;
  minStock: number;
  notes?: string;
}> = [
  {
    id: "sku-cable-usb",
    skuCode: "CBL-USB-1M",
    name: "Kabel USB EDC 1m",
    category: "CABLE",
    unit: "pcs",
    minStock: 50,
    notes: "Standar deploy",
  },
  {
    id: "sku-cable-pwr",
    skuCode: "CBL-PWR-ADAPTER",
    name: "Kabel Power / Adapter",
    category: "CABLE",
    unit: "pcs",
    minStock: 40,
  },
  {
    id: "sku-paper-57",
    skuCode: "PPR-57MM",
    name: "Kertas thermal 57mm",
    category: "PAPER_ROLL",
    unit: "roll",
    minStock: 200,
  },
  {
    id: "sku-sim-xl",
    skuCode: "SIM-XL-DATA",
    name: "SIM XL Data M2M",
    category: "SIM_CARD",
    unit: "pcs",
    minStock: 30,
  },
  {
    id: "sku-spare-batt",
    skuCode: "SPR-BATT-PAX",
    name: "Battery spare PAX",
    category: "SPARE_PART",
    unit: "pcs",
    minStock: 15,
  },
];

const SEED_BALANCES: Array<[string, string, number]> = [
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

export async function listPeripheralSkus(opts?: {
  category?: PeripheralCategory;
  activeOnly?: boolean;
  q?: string;
}): Promise<PeripheralSku[]> {
  const q = opts?.q?.trim();
  const rows = await prisma.peripheralSku.findMany({
    where: {
      ...(opts?.activeOnly ? { isActive: true } : {}),
      ...(opts?.category ? { category: opts.category } : {}),
      ...(q
        ? {
            OR: [
              { skuCode: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { skuCode: "asc" },
  });
  return rows.map(mapSku);
}

export async function findPeripheralSku(id: string): Promise<PeripheralSku | null> {
  const row = await prisma.peripheralSku.findUnique({ where: { id } });
  return row ? mapSku(row) : null;
}

export async function listStockBalances(opts?: {
  skuId?: string;
  regionalOffice?: string;
}): Promise<StockBalance[]> {
  const rows = await prisma.peripheralBalance.findMany({
    where: {
      ...(opts?.skuId ? { skuId: opts.skuId } : {}),
      ...(opts?.regionalOffice
        ? { regionalOffice: opts.regionalOffice }
        : {}),
    },
    orderBy: [{ regionalOffice: "asc" }, { skuId: "asc" }],
  });
  return rows.map(mapBalance);
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

export async function listStockAlerts(): Promise<StockAlertRow[]> {
  const skus = await prisma.peripheralSku.findMany({
    where: { isActive: true },
    include: { balances: true },
  });
  const rows: StockAlertRow[] = [];
  for (const sku of skus) {
    const byRo = new Map(
      sku.balances.map((b) => [b.regionalOffice, b.quantity] as const)
    );
    for (const ro of REGIONAL_OFFICES) {
      const quantity = byRo.get(ro) ?? 0;
      if (quantity < sku.minStock) {
        rows.push({
          skuId: sku.id,
          skuCode: sku.skuCode,
          name: sku.name,
          category: sku.category as PeripheralCategory,
          unit: sku.unit as PeripheralUnit,
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

export async function peripheralKpis() {
  const [skuCount, qtyAgg, alerts] = await Promise.all([
    prisma.peripheralSku.count({ where: { isActive: true } }),
    prisma.peripheralBalance.aggregate({ _sum: { quantity: true } }),
    listStockAlerts(),
  ]);
  return {
    skuCount,
    totalQuantity: qtyAgg._sum.quantity ?? 0,
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

export async function createPeripheralSku(
  input: PeripheralSkuInput
): Promise<PeripheralSku> {
  const code = input.skuCode.trim().toUpperCase();
  if (!code) throw new Error("SKU code wajib diisi.");
  if (!input.name?.trim()) throw new Error("Nama wajib diisi.");
  assertCategory(input.category);

  const dup = await prisma.peripheralSku.findUnique({
    where: { skuCode: code },
  });
  if (dup) throw new Error(`SKU "${code}" sudah ada.`);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.peripheralSku.create({
      data: {
        skuCode: code,
        name: input.name.trim(),
        category: input.category,
        unit: input.unit,
        minStock: input.minStock ?? DEFAULT_PERIPHERAL_MIN_STOCK,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    await tx.peripheralBalance.createMany({
      data: REGIONAL_OFFICES.map((ro) => ({
        skuId: created.id,
        regionalOffice: ro,
        quantity: 0,
      })),
    });
    return created;
  });

  return mapSku(row);
}

export async function updatePeripheralSku(
  id: string,
  input: Partial<PeripheralSkuInput>
): Promise<PeripheralSku> {
  const current = await prisma.peripheralSku.findUnique({ where: { id } });
  if (!current) throw new Error("SKU tidak ditemukan.");

  const nextCode = (input.skuCode ?? current.skuCode).trim().toUpperCase();
  if (input.category) assertCategory(input.category);

  const dup = await prisma.peripheralSku.findFirst({
    where: { skuCode: nextCode, NOT: { id } },
  });
  if (dup) throw new Error(`SKU "${nextCode}" sudah ada.`);

  const row = await prisma.peripheralSku.update({
    where: { id },
    data: {
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
    },
  });
  return mapSku(row);
}

export async function deletePeripheralSku(id: string): Promise<void> {
  const row = await prisma.peripheralSku.findUnique({ where: { id } });
  if (!row) throw new Error("SKU tidak ditemukan.");
  await prisma.peripheralSku.delete({ where: { id } });
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

export async function mutatePeripheralStock(input: StockMutateInput): Promise<{
  balances: StockBalance[];
  mutation: StockMutation;
}> {
  const sku = await findPeripheralSku(input.skuId);
  if (!sku) throw new Error("SKU tidak ditemukan.");
  const type = assertMutation(input.type);
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity harus angka > 0.");
  }

  const mutation = await prisma.$transaction(async (tx) => {
    if (type === "TRANSFER") {
      const fromRo = input.fromRo?.trim();
      const toRo = input.toRo?.trim();
      if (!fromRo || !toRo) {
        throw new Error("fromRo dan toRo wajib untuk TRANSFER.");
      }
      if (fromRo === toRo) {
        throw new Error("RO asal dan tujuan harus berbeda.");
      }

      const fromBal = await tx.peripheralBalance.findUnique({
        where: {
          skuId_regionalOffice: { skuId: sku.id, regionalOffice: fromRo },
        },
      });
      const fromQty = fromBal?.quantity ?? 0;
      if (fromQty < qty) {
        throw new Error(`Stok ${fromRo} tidak cukup (tersedia ${fromQty}).`);
      }

      await tx.peripheralBalance.upsert({
        where: {
          skuId_regionalOffice: { skuId: sku.id, regionalOffice: fromRo },
        },
        update: { quantity: fromQty - qty },
        create: { skuId: sku.id, regionalOffice: fromRo, quantity: fromQty - qty },
      });
      const toBal = await tx.peripheralBalance.findUnique({
        where: {
          skuId_regionalOffice: { skuId: sku.id, regionalOffice: toRo },
        },
      });
      await tx.peripheralBalance.upsert({
        where: {
          skuId_regionalOffice: { skuId: sku.id, regionalOffice: toRo },
        },
        update: { quantity: (toBal?.quantity ?? 0) + qty },
        create: {
          skuId: sku.id,
          regionalOffice: toRo,
          quantity: (toBal?.quantity ?? 0) + qty,
        },
      });

      return tx.peripheralMutation.create({
        data: {
          skuId: sku.id,
          type: type as PrismaMutationType,
          quantity: qty,
          fromRo,
          toRo,
          notes: input.notes?.trim() || null,
          mutatedBy: input.mutatedBy ?? null,
        },
      });
    }

    const ro = (input.regionalOffice ?? input.toRo ?? input.fromRo)?.trim();
    if (!ro) throw new Error("regionalOffice wajib diisi.");

    const currentBal = await tx.peripheralBalance.findUnique({
      where: {
        skuId_regionalOffice: { skuId: sku.id, regionalOffice: ro },
      },
    });
    const current = currentBal?.quantity ?? 0;
    let next = current;
    if (type === "IN") next = current + qty;
    else if (type === "OUT") {
      if (current < qty) {
        throw new Error(`Stok ${ro} tidak cukup (tersedia ${current}).`);
      }
      next = current - qty;
    } else if (type === "ADJUST") next = qty;

    await tx.peripheralBalance.upsert({
      where: {
        skuId_regionalOffice: { skuId: sku.id, regionalOffice: ro },
      },
      update: { quantity: next },
      create: { skuId: sku.id, regionalOffice: ro, quantity: next },
    });

    return tx.peripheralMutation.create({
      data: {
        skuId: sku.id,
        type: type as PrismaMutationType,
        quantity: qty,
        fromRo: type === "OUT" ? ro : null,
        toRo: type === "IN" || type === "ADJUST" ? ro : null,
        notes: input.notes?.trim() || null,
        mutatedBy: input.mutatedBy ?? null,
      },
    });
  });

  return {
    balances: await listStockBalances({ skuId: sku.id }),
    mutation: mapMutation(mutation),
  };
}

export async function listStockMutations(
  skuId?: string,
  limit = 50
): Promise<StockMutation[]> {
  const rows = await prisma.peripheralMutation.findMany({
    where: skuId ? { skuId } : undefined,
    orderBy: { mutatedAt: "desc" },
    take: limit,
  });
  return rows.map(mapMutation);
}

export async function resetPeripherals(): Promise<{
  skus: PeripheralSku[];
  kpis: Awaited<ReturnType<typeof peripheralKpis>>;
}> {
  await prisma.$transaction(async (tx) => {
    await tx.peripheralMutation.deleteMany();
    await tx.peripheralBalance.deleteMany();
    await tx.peripheralSku.deleteMany();

    for (const s of SEED_SKUS) {
      await tx.peripheralSku.create({
        data: {
          id: s.id,
          skuCode: s.skuCode,
          name: s.name,
          category: s.category,
          unit: s.unit,
          minStock: s.minStock,
          notes: s.notes ?? null,
          isActive: true,
        },
      });
    }
    for (const [skuId, ro, qty] of SEED_BALANCES) {
      await tx.peripheralBalance.create({
        data: { skuId, regionalOffice: ro, quantity: qty },
      });
    }
  });

  return {
    skus: await listPeripheralSkus(),
    kpis: await peripheralKpis(),
  };
}
