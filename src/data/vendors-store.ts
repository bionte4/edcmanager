import {
  DEFAULT_VENDORS,
  VENDOR_TYPES,
  type VendorDef,
  type VendorType,
} from "@/config/vendor.config";
import { prisma } from "@/lib/prisma";
import type { Vendor as PrismaVendor } from "@prisma/client";

export type { VendorDef, VendorType };

function mapRow(row: PrismaVendor): VendorDef {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    type: row.type as VendorType,
    allocationQuota: row.allocationQuota,
    isActive: row.isActive,
  };
}

function isVendorType(v: string): v is VendorType {
  return (VENDOR_TYPES as readonly string[]).includes(v);
}

export interface VendorInput {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  type: VendorType;
  allocationQuota: number;
  isActive?: boolean;
}

function validate(input: VendorInput): void {
  const name = input.name.trim();
  if (!name) throw new Error("Nama vendor wajib diisi.");
  if (name.length > 120) throw new Error("Nama vendor max 120 karakter.");
  if (!input.contactName?.trim()) throw new Error("Nama kontak wajib diisi.");
  if (!input.contactEmail?.trim()) throw new Error("Email kontak wajib diisi.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail.trim())) {
    throw new Error("Format email kontak tidak valid.");
  }
  if (!input.contactPhone?.trim()) throw new Error("Telepon kontak wajib diisi.");
  if (!isVendorType(input.type)) {
    throw new Error("Tipe harus DISTRIBUTOR atau FMS.");
  }
  const quota = Number(input.allocationQuota);
  if (!Number.isFinite(quota) || quota < 0 || !Number.isInteger(quota)) {
    throw new Error("Alokasi kuota harus bilangan bulat ≥ 0.");
  }
}

export async function listVendors(opts?: {
  activeOnly?: boolean;
}): Promise<VendorDef[]> {
  try {
    const rows = await prisma.vendor.findMany({
      where: opts?.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ name: "asc" }],
    });
    if (rows.length === 0 && !opts?.activeOnly) {
      return DEFAULT_VENDORS.map((v) => ({ ...v }));
    }
    return rows.map(mapRow);
  } catch {
    return DEFAULT_VENDORS.filter((v) => (opts?.activeOnly ? v.isActive : true)).map(
      (v) => ({ ...v })
    );
  }
}

export async function listActiveVendorNames(): Promise<string[]> {
  const rows = await listVendors({ activeOnly: true });
  return rows.map((v) => v.name);
}

export async function getVendor(id: string): Promise<VendorDef | null> {
  try {
    const row = await prisma.vendor.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  } catch {
    return DEFAULT_VENDORS.find((v) => v.id === id) ?? null;
  }
}

export async function createVendor(input: VendorInput): Promise<VendorDef> {
  validate(input);
  const name = input.name.trim();
  const dup = await prisma.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (dup) throw new Error(`Vendor "${name}" sudah ada.`);

  const row = await prisma.vendor.create({
    data: {
      name,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      contactPhone: input.contactPhone.trim(),
      type: input.type,
      allocationQuota: Number(input.allocationQuota),
      isActive: input.isActive ?? true,
    },
  });
  return mapRow(row);
}

export async function updateVendor(
  id: string,
  input: Partial<VendorInput>
): Promise<VendorDef> {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw new Error("Vendor tidak ditemukan.");

  const next: VendorInput = {
    name: input.name ?? existing.name,
    contactName: input.contactName ?? existing.contactName,
    contactEmail: input.contactEmail ?? existing.contactEmail,
    contactPhone: input.contactPhone ?? existing.contactPhone,
    type: (input.type ?? existing.type) as VendorType,
    allocationQuota: input.allocationQuota ?? existing.allocationQuota,
    isActive: input.isActive ?? existing.isActive,
  };
  validate(next);

  const name = next.name.trim();
  const dup = await prisma.vendor.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
  });
  if (dup) throw new Error(`Vendor "${name}" sudah ada.`);

  const row = await prisma.vendor.update({
    where: { id },
    data: {
      name,
      contactName: next.contactName.trim(),
      contactEmail: next.contactEmail.trim().toLowerCase(),
      contactPhone: next.contactPhone.trim(),
      type: next.type,
      allocationQuota: Number(next.allocationQuota),
      isActive: next.isActive ?? true,
    },
  });
  return mapRow(row);
}

/**
 * Soft-deactivate if vendor has related units/tickets/metrics;
 * hard-delete only when unused.
 */
export async function deleteVendor(id: string): Promise<{ soft: boolean }> {
  const existing = await prisma.vendor.findUnique({
    where: { id },
    include: {
      _count: { select: { edcUnits: true, tickets: true, metricLogs: true } },
    },
  });
  if (!existing) throw new Error("Vendor tidak ditemukan.");

  const used =
    existing._count.edcUnits +
      existing._count.tickets +
      existing._count.metricLogs >
    0;

  if (used) {
    await prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });
    return { soft: true };
  }

  await prisma.vendor.delete({ where: { id } });
  return { soft: false };
}

export async function resetVendors(): Promise<VendorDef[]> {
  await prisma.$transaction(async (tx) => {
    const seeded = await tx.vendor.findMany({
      where: { id: { in: DEFAULT_VENDORS.map((v) => v.id) } },
      include: {
        _count: { select: { edcUnits: true, tickets: true, metricLogs: true } },
      },
    });

    for (const def of DEFAULT_VENDORS) {
      const hit = seeded.find((s) => s.id === def.id);
      if (hit) {
        await tx.vendor.update({
          where: { id: def.id },
          data: {
            name: def.name,
            contactName: def.contactName,
            contactEmail: def.contactEmail,
            contactPhone: def.contactPhone,
            type: def.type,
            allocationQuota: def.allocationQuota,
            isActive: def.isActive,
          },
        });
      } else {
        await tx.vendor.create({
          data: {
            id: def.id,
            name: def.name,
            contactName: def.contactName,
            contactEmail: def.contactEmail,
            contactPhone: def.contactPhone,
            type: def.type,
            allocationQuota: def.allocationQuota,
            isActive: def.isActive,
          },
        });
      }
    }
  });
  return listVendors();
}
