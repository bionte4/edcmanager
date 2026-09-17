import {
  DEFAULT_TICKET_CATEGORIES,
  normalizeCategoryCode,
  slaProfileFromCatalog,
  type SlaProfile,
  type TicketCategoryDef,
} from "@/config/ticket-category.config";
import { prisma } from "@/lib/prisma";
import type { TicketCategoryDef as PrismaTicketCategoryDef } from "@prisma/client";

function clone(c: TicketCategoryDef): TicketCategoryDef {
  return { ...c };
}

function mapRow(row: PrismaTicketCategoryDef): TicketCategoryDef {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    slaProfile: row.slaProfile,
    description: row.description ?? undefined,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** In-memory cache; seeded with defaults until DB refresh completes. */
let categories: TicketCategoryDef[] = DEFAULT_TICKET_CATEGORIES.map(clone);

export async function refreshTicketCategoryCache(): Promise<void> {
  try {
    const rows = await prisma.ticketCategoryDef.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    categories =
      rows.length > 0
        ? rows.map(mapRow)
        : DEFAULT_TICKET_CATEGORIES.map(clone);
  } catch {
    categories = DEFAULT_TICKET_CATEGORIES.map(clone);
  }
}

// Do not refresh on module import — breaks `next build` when DB is unreachable.
let categoryCacheWarmed = false;

export async function listTicketCategories(opts?: {
  activeOnly?: boolean;
}): Promise<TicketCategoryDef[]> {
  if (!categoryCacheWarmed) {
    await refreshTicketCategoryCache();
    categoryCacheWarmed = true;
  }
  return categories
    .filter((c) => (opts?.activeOnly ? c.isActive : true))
    .map(clone)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export function findCategoryByCode(code: string): TicketCategoryDef | null {
  const normalized = normalizeCategoryCode(code);
  const found = categories.find((c) => c.code === normalized);
  return found ? clone(found) : null;
}

/** Sync read from cache — safe for SLA engine hot paths. */
export function getCategorySlaProfile(code: string): SlaProfile {
  return slaProfileFromCatalog(code, categories);
}

/** Sync read from cache. */
export function getCategoryLabel(code: string): string {
  return findCategoryByCode(code)?.label ?? code;
}

export interface TicketCategoryInput {
  code: string;
  label: string;
  slaProfile: SlaProfile;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

function validate(input: TicketCategoryInput, exceptId?: string): void {
  const code = normalizeCategoryCode(input.code);
  if (!code) throw new Error("Kode kategori wajib diisi.");
  if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(code)) {
    throw new Error("Kode: huruf besar/angka/underscore, mulai huruf (max 32).");
  }
  if (!input.label?.trim()) throw new Error("Label wajib diisi.");
  if (input.slaProfile !== "VIP" && input.slaProfile !== "NON_VIP") {
    throw new Error("slaProfile harus VIP atau NON_VIP.");
  }
  const dup = categories.find((c) => c.code === code && c.id !== exceptId);
  if (dup) throw new Error(`Kode kategori "${code}" sudah dipakai.`);
}

export async function createTicketCategory(
  input: TicketCategoryInput
): Promise<TicketCategoryDef> {
  validate(input);
  const row = await prisma.ticketCategoryDef.create({
    data: {
      code: normalizeCategoryCode(input.code),
      label: input.label.trim(),
      slaProfile: input.slaProfile,
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 100,
      isActive: input.isActive ?? true,
    },
  });
  await refreshTicketCategoryCache();
  return mapRow(row);
}

export async function updateTicketCategory(
  id: string,
  input: Partial<TicketCategoryInput>
): Promise<TicketCategoryDef> {
  const existing =
    categories.find((c) => c.id === id) ??
    (await prisma.ticketCategoryDef.findUnique({ where: { id } }).then((r) =>
      r ? mapRow(r) : null
    ));
  if (!existing) throw new Error("Kategori tidak ditemukan.");

  const next: TicketCategoryInput = {
    code: input.code ?? existing.code,
    label: input.label ?? existing.label,
    slaProfile: input.slaProfile ?? existing.slaProfile,
    description: input.description ?? existing.description,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    isActive: input.isActive ?? existing.isActive,
  };
  validate(next, id);
  const row = await prisma.ticketCategoryDef.update({
    where: { id },
    data: {
      code: normalizeCategoryCode(next.code),
      label: next.label.trim(),
      slaProfile: next.slaProfile,
      description: next.description?.trim() || null,
      sortOrder: next.sortOrder ?? 100,
      isActive: next.isActive ?? true,
    },
  });
  await refreshTicketCategoryCache();
  return mapRow(row);
}

export async function deleteTicketCategory(id: string): Promise<void> {
  const row =
    categories.find((c) => c.id === id) ??
    (await prisma.ticketCategoryDef.findUnique({ where: { id } }).then((r) =>
      r ? mapRow(r) : null
    ));
  if (!row) throw new Error("Kategori tidak ditemukan.");
  if (row.code === "VIP" || row.code === "NON_VIP") {
    throw new Error(
      "Kategori bawaan VIP / NON_VIP tidak boleh dihapus (bisa di-nonaktifkan)."
    );
  }
  await prisma.ticketCategoryDef.delete({ where: { id } });
  await refreshTicketCategoryCache();
}

export async function resetTicketCategories(): Promise<TicketCategoryDef[]> {
  await prisma.$transaction(async (tx) => {
    await tx.ticketCategoryDef.deleteMany();
    await tx.ticketCategoryDef.createMany({
      data: DEFAULT_TICKET_CATEGORIES.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        slaProfile: c.slaProfile,
        description: c.description ?? null,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
    });
  });
  await refreshTicketCategoryCache();
  return listTicketCategories();
}
