import {
  DEFAULT_OLA_POLICIES,
  OLA_WARNING_THRESHOLD,
  type OlaPolicySeed,
  type OlaStage,
} from "@/config/ola.config";
import type { ItsmType, OperationalProcess } from "@/config/itsm.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";
import { prisma } from "@/lib/prisma";
import type { OlaPolicy } from "@/ola/types";
import type { OlaPolicy as PrismaOlaPolicy } from "@prisma/client";

function fromSeed(seed: OlaPolicySeed): OlaPolicy {
  return {
    id: seed.id,
    name: seed.name,
    stage: seed.stage,
    limitMinutes: seed.limitMinutes,
    warningThreshold: seed.warningThreshold ?? OLA_WARNING_THRESHOLD,
    itsmType: seed.itsmType ?? "*",
    location: seed.location ?? "*",
    category: seed.category ?? "*",
    process: seed.process ?? "*",
    isActive: seed.isActive ?? true,
    priority: seed.priority ?? 0,
    updatedAt: new Date().toISOString(),
  };
}

function mapRow(row: PrismaOlaPolicy): OlaPolicy {
  return {
    id: row.id,
    name: row.name,
    stage: row.stage,
    limitMinutes: row.limitMinutes,
    warningThreshold: row.warningThreshold,
    itsmType: row.itsmType as ItsmType | "*",
    location: row.location as TicketLocation | "*",
    category: row.category as TicketCategory | "*",
    process: row.process as OperationalProcess | "*",
    isActive: row.isActive,
    priority: row.priority,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function clone(p: OlaPolicy): OlaPolicy {
  return { ...p };
}

/** In-memory cache; seeded with defaults until DB refresh completes. */
let policies: OlaPolicy[] = DEFAULT_OLA_POLICIES.map(fromSeed);

export async function refreshOlaCache(): Promise<void> {
  try {
    const rows = await prisma.olaPolicy.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
    policies =
      rows.length > 0 ? rows.map(mapRow) : DEFAULT_OLA_POLICIES.map(fromSeed);
  } catch {
    policies = DEFAULT_OLA_POLICIES.map(fromSeed);
  }
}

void refreshOlaCache();

/** Sync read from cache — reporting / ticketing call this synchronously. */
export function listOlaPolicies(opts?: {
  stage?: OlaStage;
  activeOnly?: boolean;
}): OlaPolicy[] {
  return policies
    .filter((p) => (opts?.stage ? p.stage === opts.stage : true))
    .filter((p) => (opts?.activeOnly ? p.isActive : true))
    .map(clone)
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

export function getOlaPolicy(id: string): OlaPolicy | null {
  const found = policies.find((p) => p.id === id);
  return found ? clone(found) : null;
}

export interface OlaPolicyInput {
  name: string;
  stage: OlaStage;
  limitMinutes: number;
  warningThreshold?: number;
  itsmType?: ItsmType | "*";
  location?: TicketLocation | "*";
  category?: TicketCategory | "*";
  process?: OperationalProcess | "*";
  isActive?: boolean;
  priority?: number;
}

function validateInput(input: OlaPolicyInput): void {
  if (!input.name?.trim()) throw new Error("Nama policy wajib diisi.");
  if (input.stage !== "ACKNOWLEDGE" && input.stage !== "DISPATCH") {
    throw new Error("Stage OLA tidak valid.");
  }
  if (!Number.isFinite(input.limitMinutes) || input.limitMinutes <= 0) {
    throw new Error("limitMinutes harus > 0.");
  }
  const thr = input.warningThreshold ?? OLA_WARNING_THRESHOLD;
  if (thr <= 0 || thr >= 1) {
    throw new Error("warningThreshold harus antara 0 dan 1 (mis. 0.8).");
  }
}

export async function createOlaPolicy(
  input: OlaPolicyInput
): Promise<OlaPolicy> {
  validateInput(input);
  const row = await prisma.olaPolicy.create({
    data: {
      name: input.name.trim(),
      stage: input.stage,
      limitMinutes: Math.round(input.limitMinutes),
      warningThreshold: input.warningThreshold ?? OLA_WARNING_THRESHOLD,
      itsmType: input.itsmType ?? "*",
      location: input.location ?? "*",
      category: input.category ?? "*",
      process: input.process ?? "*",
      isActive: input.isActive ?? true,
      priority: input.priority ?? 50,
    },
  });
  await refreshOlaCache();
  return mapRow(row);
}

export async function updateOlaPolicy(
  id: string,
  input: Partial<OlaPolicyInput>
): Promise<OlaPolicy> {
  const current =
    policies.find((p) => p.id === id) ??
    (await prisma.olaPolicy.findUnique({ where: { id } }).then((r) =>
      r ? mapRow(r) : null
    ));
  if (!current) throw new Error("Policy OLA tidak ditemukan.");

  const nextInput: OlaPolicyInput = {
    name: input.name ?? current.name,
    stage: input.stage ?? current.stage,
    limitMinutes: input.limitMinutes ?? current.limitMinutes,
    warningThreshold: input.warningThreshold ?? current.warningThreshold,
    itsmType: input.itsmType ?? current.itsmType,
    location: input.location ?? current.location,
    category: input.category ?? current.category,
    process: input.process ?? current.process,
    isActive: input.isActive ?? current.isActive,
    priority: input.priority ?? current.priority,
  };
  validateInput(nextInput);

  const row = await prisma.olaPolicy.update({
    where: { id },
    data: {
      name: nextInput.name.trim(),
      stage: nextInput.stage,
      limitMinutes: Math.round(nextInput.limitMinutes),
      warningThreshold: nextInput.warningThreshold ?? OLA_WARNING_THRESHOLD,
      itsmType: nextInput.itsmType ?? "*",
      location: nextInput.location ?? "*",
      category: nextInput.category ?? "*",
      process: nextInput.process ?? "*",
      isActive: nextInput.isActive ?? true,
      priority: nextInput.priority ?? 50,
    },
  });
  await refreshOlaCache();
  return mapRow(row);
}

export async function deleteOlaPolicy(id: string): Promise<void> {
  const existing =
    policies.find((p) => p.id === id) ??
    (await prisma.olaPolicy.findUnique({ where: { id } }));
  if (!existing) throw new Error("Policy OLA tidak ditemukan.");
  await prisma.olaPolicy.delete({ where: { id } });
  await refreshOlaCache();
}

export async function resetOlaPolicies(): Promise<OlaPolicy[]> {
  await prisma.$transaction(async (tx) => {
    await tx.olaPolicy.deleteMany();
    await tx.olaPolicy.createMany({
      data: DEFAULT_OLA_POLICIES.map((seed) => ({
        id: seed.id,
        name: seed.name,
        stage: seed.stage,
        limitMinutes: seed.limitMinutes,
        warningThreshold: seed.warningThreshold ?? OLA_WARNING_THRESHOLD,
        itsmType: seed.itsmType ?? "*",
        location: seed.location ?? "*",
        category: seed.category ?? "*",
        process: seed.process ?? "*",
        isActive: seed.isActive ?? true,
        priority: seed.priority ?? 0,
      })),
    });
  });
  await refreshOlaCache();
  return listOlaPolicies();
}
