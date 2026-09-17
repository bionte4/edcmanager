/**
 * Ticket priority categories (VIP, Non-VIP, and custom).
 * CRUD at runtime via ticket-categories-store; SLA matrix still keyed by slaProfile.
 */

import type { SlaProfile } from "@/config/sla.config";

export type { SlaProfile };

export const SLA_PROFILE_LABELS: Record<SlaProfile, string> = {
  VIP: "Profil SLA VIP (ketat)",
  NON_VIP: "Profil SLA Non-VIP (standar)",
};

export interface TicketCategoryDef {
  id: string;
  /** Stable code stored on tickets (e.g. VIP, NON_VIP, GOLD). */
  code: string;
  label: string;
  /** Which RESOLUTION_SLA_MINUTES profile to use. */
  slaProfile: SlaProfile;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export const DEFAULT_TICKET_CATEGORIES: readonly TicketCategoryDef[] = [
  {
    id: "cat-vip",
    code: "VIP",
    label: "VIP",
    slaProfile: "VIP",
    description: "Merchant prioritas — peak Dalam Kota 2 jam",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "cat-non-vip",
    code: "NON_VIP",
    label: "Non-VIP",
    slaProfile: "NON_VIP",
    description: "Merchant standar",
    sortOrder: 20,
    isActive: true,
  },
] as const;

export function normalizeCategoryCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export function slaProfileFromCatalog(
  code: string,
  catalog: readonly TicketCategoryDef[] = DEFAULT_TICKET_CATEGORIES
): SlaProfile {
  const normalized = normalizeCategoryCode(code);
  const found = catalog.find((c) => c.code === normalized);
  if (found) return found.slaProfile;
  if (normalized === "VIP") return "VIP";
  return "NON_VIP";
}

export function labelFromCatalog(
  code: string,
  catalog: readonly TicketCategoryDef[] = DEFAULT_TICKET_CATEGORIES
): string {
  const normalized = normalizeCategoryCode(code);
  return catalog.find((c) => c.code === normalized)?.label ?? code;
}
