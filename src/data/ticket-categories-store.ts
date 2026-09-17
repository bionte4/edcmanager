import {
  DEFAULT_TICKET_CATEGORIES,
  normalizeCategoryCode,
  slaProfileFromCatalog,
  type SlaProfile,
  type TicketCategoryDef,
} from "@/config/ticket-category.config";

function clone(c: TicketCategoryDef): TicketCategoryDef {
  return { ...c };
}

let categories: TicketCategoryDef[] = DEFAULT_TICKET_CATEGORIES.map(clone);

export function listTicketCategories(opts?: {
  activeOnly?: boolean;
}): TicketCategoryDef[] {
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

export function getCategorySlaProfile(code: string): SlaProfile {
  return slaProfileFromCatalog(code, categories);
}

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
  const dup = categories.find(
    (c) => c.code === code && c.id !== exceptId
  );
  if (dup) throw new Error(`Kode kategori "${code}" sudah dipakai.`);
}

export function createTicketCategory(input: TicketCategoryInput): TicketCategoryDef {
  validate(input);
  const row: TicketCategoryDef = {
    id: `cat-${Date.now()}`,
    code: normalizeCategoryCode(input.code),
    label: input.label.trim(),
    slaProfile: input.slaProfile,
    description: input.description?.trim() || undefined,
    sortOrder: input.sortOrder ?? 100,
    isActive: input.isActive ?? true,
  };
  categories = [...categories, row];
  return clone(row);
}

export function updateTicketCategory(
  id: string,
  input: Partial<TicketCategoryInput>
): TicketCategoryDef {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Kategori tidak ditemukan.");
  const current = categories[idx]!;
  const next: TicketCategoryInput = {
    code: input.code ?? current.code,
    label: input.label ?? current.label,
    slaProfile: input.slaProfile ?? current.slaProfile,
    description: input.description ?? current.description,
    sortOrder: input.sortOrder ?? current.sortOrder,
    isActive: input.isActive ?? current.isActive,
  };
  validate(next, id);
  const updated: TicketCategoryDef = {
    ...current,
    code: normalizeCategoryCode(next.code),
    label: next.label.trim(),
    slaProfile: next.slaProfile,
    description: next.description?.trim() || undefined,
    sortOrder: next.sortOrder ?? 100,
    isActive: next.isActive ?? true,
  };
  categories[idx] = updated;
  return clone(updated);
}

export function deleteTicketCategory(id: string): void {
  const row = categories.find((c) => c.id === id);
  if (!row) throw new Error("Kategori tidak ditemukan.");
  if (row.code === "VIP" || row.code === "NON_VIP") {
    throw new Error("Kategori bawaan VIP / NON_VIP tidak boleh dihapus (bisa di-nonaktifkan).");
  }
  categories = categories.filter((c) => c.id !== id);
}

export function resetTicketCategories(): TicketCategoryDef[] {
  categories = DEFAULT_TICKET_CATEGORIES.map(clone);
  return listTicketCategories();
}
