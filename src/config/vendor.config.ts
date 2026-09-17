/**
 * Vendor master defaults & labels — keep in sync with prisma VendorType / seed.
 */

export const VENDOR_TYPES = ["DISTRIBUTOR", "FMS"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  DISTRIBUTOR: "Distributor",
  FMS: "FMS (Field Maintenance)",
};

export interface VendorDef {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  type: VendorType;
  allocationQuota: number;
  isActive: boolean;
}

/** Seed defaults — stable ids referenced by demo units / metrics / tickets. */
export const DEFAULT_VENDORS: readonly VendorDef[] = [
  {
    id: "v1",
    name: "Vendor 1",
    contactName: "Budi FMS",
    contactEmail: "budi@vendor1.local",
    contactPhone: "0812-1000-0001",
    type: "FMS",
    allocationQuota: 1200,
    isActive: true,
  },
  {
    id: "v2",
    name: "Vendor 2",
    contactName: "Ani Dist",
    contactEmail: "ani@vendor2.local",
    contactPhone: "0812-1000-0002",
    type: "DISTRIBUTOR",
    allocationQuota: 900,
    isActive: true,
  },
];
