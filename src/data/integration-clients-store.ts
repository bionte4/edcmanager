import {
  INTEGRATION_SCOPES,
  type IntegrationClient,
  type IntegrationScope,
} from "@/config/integration.config";
import { prisma } from "@/lib/prisma";
import type { IntegrationClient as PrismaClientRow } from "@prisma/client";

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "client"
  );
}

function randomSuffix(len = 10): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function normalizeScopes(scopes: unknown): IntegrationScope[] {
  if (!Array.isArray(scopes)) return ["tickets:read"];
  const valid = scopes.filter((s): s is IntegrationScope =>
    INTEGRATION_SCOPES.includes(s as IntegrationScope)
  );
  return valid.length > 0 ? [...new Set(valid)] : ["tickets:read"];
}

function scopesToString(scopes: IntegrationScope[]): string {
  return scopes.join(",");
}

function scopesFromString(raw: string): IntegrationScope[] {
  return normalizeScopes(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Demo: keyId is derived (no dedicated DB column). */
function deriveKeyId(externalSystem: string): string {
  return `edc_sdk_${slugify(externalSystem)}`;
}

function mapClient(row: PrismaClientRow): IntegrationClient {
  return {
    id: row.id,
    name: row.name,
    keyId: deriveKeyId(row.externalSystem),
    apiKey: row.apiKey,
    scopes: scopesFromString(row.scopes),
    isActive: row.isActive,
    externalSystem: row.externalSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listIntegrationClients(
  includeInactive = true
): Promise<IntegrationClient[]> {
  const rows = await prisma.integrationClient.findMany({
    where: {
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapClient);
}

export async function findIntegrationClientById(
  id: string
): Promise<IntegrationClient | undefined> {
  const row = await prisma.integrationClient.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? mapClient(row) : undefined;
}

export async function findIntegrationClientByApiKey(
  apiKey: string
): Promise<IntegrationClient | undefined> {
  const key = apiKey.trim();
  const row = await prisma.integrationClient.findFirst({
    where: { apiKey: key, isActive: true, deletedAt: null },
  });
  return row ? mapClient(row) : undefined;
}

export async function countActiveIntegrationClients(): Promise<number> {
  return prisma.integrationClient.count({
    where: { isActive: true, deletedAt: null },
  });
}

export async function createIntegrationClient(input: {
  name: string;
  externalSystem: string;
  scopes?: IntegrationScope[];
  isActive?: boolean;
  keyId?: string;
  apiKey?: string;
}): Promise<IntegrationClient> {
  const name = input.name.trim();
  const externalSystem = input.externalSystem.trim().toLowerCase();
  if (!name) throw new Error("Nama wajib diisi.");
  if (!externalSystem) throw new Error("External system wajib diisi.");

  const existingSystem = await prisma.integrationClient.findFirst({
    where: { externalSystem, deletedAt: null },
  });
  if (existingSystem) throw new Error("External system sudah terpakai.");

  const slug = slugify(externalSystem);
  // keyId is derived for display; optional input.keyId is ignored (no DB column).
  void input.keyId;
  const apiKey = input.apiKey?.trim() || `edc_sk_${slug}_${randomSuffix()}`;

  const dupKey = await prisma.integrationClient.findFirst({
    where: { apiKey },
  });
  if (dupKey) throw new Error("apiKey sudah terpakai.");

  const row = await prisma.integrationClient.create({
    data: {
      name,
      externalSystem,
      apiKey,
      scopes: scopesToString(normalizeScopes(input.scopes)),
      isActive: input.isActive ?? true,
    },
  });
  return mapClient(row);
}

export async function updateIntegrationClient(
  id: string,
  patch: Partial<{
    name: string;
    externalSystem: string;
    scopes: IntegrationScope[];
    isActive: boolean;
    keyId: string;
    apiKey: string;
  }>
): Promise<IntegrationClient> {
  const current = await prisma.integrationClient.findFirst({
    where: { id, deletedAt: null },
  });
  if (!current) throw new Error("Client tidak ditemukan.");

  const nextName = patch.name?.trim() ?? current.name;
  const nextSystem =
    patch.externalSystem?.trim().toLowerCase() ?? current.externalSystem;
  const nextApiKey = patch.apiKey?.trim() ?? current.apiKey;
  void patch.keyId;

  if (!nextName) throw new Error("Nama wajib diisi.");
  if (!nextSystem) throw new Error("External system wajib diisi.");

  const systemDup = await prisma.integrationClient.findFirst({
    where: { externalSystem: nextSystem, deletedAt: null, NOT: { id } },
  });
  if (systemDup) throw new Error("External system sudah terpakai.");

  const keyDup = await prisma.integrationClient.findFirst({
    where: { apiKey: nextApiKey, NOT: { id } },
  });
  if (keyDup) throw new Error("apiKey sudah terpakai.");

  const row = await prisma.integrationClient.update({
    where: { id },
    data: {
      name: nextName,
      externalSystem: nextSystem,
      apiKey: nextApiKey,
      scopes: patch.scopes
        ? scopesToString(normalizeScopes(patch.scopes))
        : undefined,
      isActive: patch.isActive ?? current.isActive,
    },
  });
  return mapClient(row);
}

export async function rotateIntegrationClientKey(
  id: string
): Promise<IntegrationClient> {
  const current = await findIntegrationClientById(id);
  if (!current) throw new Error("Client tidak ditemukan.");
  const slug = slugify(current.externalSystem);
  return updateIntegrationClient(id, {
    apiKey: `edc_sk_${slug}_${randomSuffix()}`,
  });
}

/** Soft-delete: deactivate + keep row for audit demo. */
export async function deleteIntegrationClient(
  id: string
): Promise<IntegrationClient> {
  return updateIntegrationClient(id, { isActive: false });
}

export async function hardDeleteIntegrationClient(
  id: string
): Promise<IntegrationClient> {
  const current = await prisma.integrationClient.findFirst({
    where: { id },
  });
  if (!current) throw new Error("Client tidak ditemukan.");
  const mapped = mapClient(current);
  await prisma.integrationClient.delete({ where: { id } });
  return mapped;
}
