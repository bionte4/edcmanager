import type { AppRole } from "@/config/rbac.config";
import { DEMO_PASSWORD } from "@/config/rbac.config";
import type { AuthUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export interface ManagedUser extends AuthUser {
  phone?: string;
  /** Demo: compared as plaintext against passwordHash column. */
  password: string;
  deletedAt?: string | null;
  createdAt: string;
}

function mapUser(row: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AppRole | string;
  passwordHash: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}): ManagedUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    role: row.role as AppRole,
    isActive: row.isActive,
    password: row.passwordHash ?? DEMO_PASSWORD,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(includeDeleted = false): Promise<ManagedUser[]> {
  const rows = await prisma.user.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapUser);
}

export async function findUserByEmail(
  email: string
): Promise<ManagedUser | undefined> {
  const normalized = email.trim().toLowerCase();
  const row = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" }, deletedAt: null },
  });
  return row ? mapUser(row) : undefined;
}

export async function findUserById(
  id: string
): Promise<ManagedUser | undefined> {
  const row = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? mapUser(row) : undefined;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.isActive) return null;
  if (user.password !== password) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  role: AppRole;
  password?: string;
  isActive?: boolean;
}): Promise<ManagedUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing && !existing.deletedAt) {
    throw new Error("Email sudah terdaftar.");
  }
  const row = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      role: input.role,
      passwordHash: input.password?.trim() || DEMO_PASSWORD,
      isActive: input.isActive ?? true,
    },
  });
  return mapUser(row);
}

export async function updateUser(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    phone: string;
    role: AppRole;
    password: string;
    isActive: boolean;
  }>
): Promise<ManagedUser> {
  const current = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!current) throw new Error("User tidak ditemukan.");

  if (input.email) {
    const email = input.email.trim().toLowerCase();
    const dup = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        NOT: { id },
        deletedAt: null,
      },
    });
    if (dup) throw new Error("Email sudah dipakai user lain.");
  }

  const row = await prisma.user.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      email: input.email?.trim().toLowerCase(),
      phone: input.phone !== undefined ? input.phone.trim() || null : undefined,
      role: input.role,
      passwordHash: input.password?.trim() || undefined,
      isActive: input.isActive,
    },
  });
  return mapUser(row);
}

export async function deleteUser(id: string): Promise<void> {
  const current = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!current) throw new Error("User tidak ditemukan.");
  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export function toPublicUser(u: ManagedUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}
