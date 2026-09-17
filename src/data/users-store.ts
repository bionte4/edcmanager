import type { AppRole } from "@/config/rbac.config";
import { DEMO_PASSWORD } from "@/config/rbac.config";
import type { AuthUser } from "@/lib/rbac";

export interface ManagedUser extends AuthUser {
  phone?: string;
  /** Demo only — plaintext for mock store; Prisma uses passwordHash */
  password: string;
  deletedAt?: string | null;
  createdAt: string;
}

const seed: ManagedUser[] = [
  {
    id: "u-admin-1",
    name: "Admin Sistem",
    email: "admin@edc.local",
    phone: "0812-0000-0001",
    role: "ADMIN",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-noc-1",
    name: "Andi Pratama",
    email: "andi.noc@edc.local",
    phone: "0812-1111-0001",
    role: "NOC",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-noc-2",
    name: "Siti Rahma",
    email: "siti.noc@edc.local",
    phone: "0812-1111-0002",
    role: "NOC",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-noc-3",
    name: "Budi Santoso",
    email: "budi.noc@edc.local",
    phone: "0812-1111-0003",
    role: "NOC",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-sup-1",
    name: "Dewi Lestari",
    email: "dewi.supervisor@edc.local",
    phone: "0812-2222-0001",
    role: "SUPERVISOR",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-ops-1",
    name: "Rudi Hartono",
    email: "rudi.ops@edc.local",
    role: "OPS_MANAGER",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-gm-1",
    name: "Hendra Wijaya",
    email: "hendra.gm@edc.local",
    phone: "0812-9999-0001",
    role: "GM",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-tech-1",
    name: "Eko Teknisi",
    email: "eko.tech@edc.local",
    role: "VENDOR_TECH",
    isActive: true,
    password: DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  },
];

/** In-memory user store for demo CRUD (replace with Prisma later). */
let users: ManagedUser[] = seed.map((u) => ({ ...u }));

export function listUsers(includeDeleted = false): ManagedUser[] {
  return users
    .filter((u) => includeDeleted || !u.deletedAt)
    .map((u) => ({ ...u }));
}

export function findUserByEmail(email: string): ManagedUser | undefined {
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized && !u.deletedAt);
}

export function findUserById(id: string): ManagedUser | undefined {
  return users.find((u) => u.id === id && !u.deletedAt);
}

export function authenticateUser(
  email: string,
  password: string
): AuthUser | null {
  const user = findUserByEmail(email);
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

export function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  role: AppRole;
  password?: string;
  isActive?: boolean;
}): ManagedUser {
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim()) throw new Error("Nama wajib diisi.");
  if (!email.includes("@")) throw new Error("Email tidak valid.");
  if (users.some((u) => u.email.toLowerCase() === email && !u.deletedAt)) {
    throw new Error("Email sudah terpakai.");
  }

  const user: ManagedUser = {
    id: `u-${Date.now()}`,
    name: input.name.trim(),
    email,
    phone: input.phone?.trim() || undefined,
    role: input.role,
    isActive: input.isActive ?? true,
    password: input.password?.trim() || DEMO_PASSWORD,
    createdAt: new Date().toISOString(),
  };
  users = [user, ...users];
  return { ...user };
}

export function updateUser(
  id: string,
  patch: Partial<Pick<ManagedUser, "name" | "email" | "phone" | "role" | "isActive" | "password">>
): ManagedUser {
  const idx = users.findIndex((u) => u.id === id && !u.deletedAt);
  if (idx < 0) throw new Error("User tidak ditemukan.");

  const current = users[idx]!;
  const nextEmail = patch.email?.trim().toLowerCase();
  if (nextEmail && nextEmail !== current.email) {
    if (users.some((u) => u.email.toLowerCase() === nextEmail && !u.deletedAt)) {
      throw new Error("Email sudah terpakai.");
    }
  }

  const updated: ManagedUser = {
    ...current,
    ...patch,
    name: patch.name?.trim() ?? current.name,
    email: nextEmail ?? current.email,
    phone: patch.phone !== undefined ? patch.phone.trim() || undefined : current.phone,
    password: patch.password?.trim() || current.password,
  };
  users[idx] = updated;
  return { ...updated };
}

/** Soft delete */
export function deleteUser(id: string): ManagedUser {
  const idx = users.findIndex((u) => u.id === id && !u.deletedAt);
  if (idx < 0) throw new Error("User tidak ditemukan.");
  if (users[idx]!.role === "ADMIN") {
    const otherAdmins = users.filter(
      (u) => u.role === "ADMIN" && !u.deletedAt && u.id !== id && u.isActive
    );
    if (otherAdmins.length === 0) {
      throw new Error("Tidak bisa menghapus ADMIN terakhir yang aktif.");
    }
  }
  const updated = {
    ...users[idx]!,
    isActive: false,
    deletedAt: new Date().toISOString(),
  };
  users[idx] = updated;
  return { ...updated };
}

export function toPublicUser(user: ManagedUser): AuthUser & { phone?: string; createdAt: string } {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
