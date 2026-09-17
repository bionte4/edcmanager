import {
  DEFAULT_OLA_POLICIES,
  OLA_WARNING_THRESHOLD,
  type OlaPolicySeed,
  type OlaStage,
} from "@/config/ola.config";
import type { ItsmType, OperationalProcess } from "@/config/itsm.config";
import type { TicketCategory, TicketLocation } from "@/config/sla.config";
import type { OlaPolicy } from "@/ola/types";

function nowIso() {
  return new Date().toISOString();
}

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
    updatedAt: nowIso(),
  };
}

let policies: OlaPolicy[] = DEFAULT_OLA_POLICIES.map(fromSeed);

function clone(p: OlaPolicy): OlaPolicy {
  return { ...p };
}

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

export function createOlaPolicy(input: OlaPolicyInput): OlaPolicy {
  validateInput(input);
  const row: OlaPolicy = {
    id: `ola-${Date.now()}`,
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
    updatedAt: nowIso(),
  };
  policies = [row, ...policies];
  return clone(row);
}

export function updateOlaPolicy(id: string, input: Partial<OlaPolicyInput>): OlaPolicy {
  const idx = policies.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Policy OLA tidak ditemukan.");

  const current = policies[idx];
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

  const updated: OlaPolicy = {
    ...current,
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
    updatedAt: nowIso(),
  };
  policies[idx] = updated;
  return clone(updated);
}

export function deleteOlaPolicy(id: string): void {
  const before = policies.length;
  policies = policies.filter((p) => p.id !== id);
  if (policies.length === before) throw new Error("Policy OLA tidak ditemukan.");
}

export function resetOlaPolicies(): OlaPolicy[] {
  policies = DEFAULT_OLA_POLICIES.map(fromSeed);
  return listOlaPolicies();
}
