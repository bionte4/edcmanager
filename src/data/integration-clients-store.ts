import {
  INTEGRATION_CLIENT_SEED,
  INTEGRATION_SCOPES,
  type IntegrationClient,
  type IntegrationScope,
} from "@/config/integration.config";

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "client";
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

let clients: IntegrationClient[] = INTEGRATION_CLIENT_SEED.map((c) => ({
  ...c,
  scopes: [...c.scopes],
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));

export function listIntegrationClients(includeInactive = true): IntegrationClient[] {
  return clients
    .filter((c) => includeInactive || c.isActive)
    .map((c) => ({ ...c, scopes: [...c.scopes] }));
}

export function findIntegrationClientById(id: string): IntegrationClient | undefined {
  return clients.find((c) => c.id === id);
}

export function findIntegrationClientByApiKey(
  apiKey: string
): IntegrationClient | undefined {
  const key = apiKey.trim();
  return clients.find((c) => c.isActive && c.apiKey === key);
}

export function countActiveIntegrationClients(): number {
  return clients.filter((c) => c.isActive).length;
}

export function createIntegrationClient(input: {
  name: string;
  externalSystem: string;
  scopes?: IntegrationScope[];
  isActive?: boolean;
  keyId?: string;
  apiKey?: string;
}): IntegrationClient {
  const name = input.name.trim();
  const externalSystem = input.externalSystem.trim().toLowerCase();
  if (!name) throw new Error("Nama wajib diisi.");
  if (!externalSystem) throw new Error("External system wajib diisi.");

  if (clients.some((c) => c.externalSystem === externalSystem)) {
    throw new Error("External system sudah terpakai.");
  }

  const slug = slugify(externalSystem);
  const keyId = input.keyId?.trim() || `edc_sdk_${slug}`;
  const apiKey = input.apiKey?.trim() || `edc_sk_${slug}_${randomSuffix()}`;

  if (clients.some((c) => c.keyId === keyId)) {
    throw new Error("keyId sudah terpakai.");
  }
  if (clients.some((c) => c.apiKey === apiKey)) {
    throw new Error("apiKey sudah terpakai.");
  }

  const stamp = nowIso();
  const client: IntegrationClient = {
    id: `int-${Date.now()}`,
    name,
    externalSystem,
    keyId,
    apiKey,
    scopes: normalizeScopes(input.scopes),
    isActive: input.isActive ?? true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  clients = [client, ...clients];
  return { ...client, scopes: [...client.scopes] };
}

export function updateIntegrationClient(
  id: string,
  patch: Partial<{
    name: string;
    externalSystem: string;
    scopes: IntegrationScope[];
    isActive: boolean;
    keyId: string;
    apiKey: string;
  }>
): IntegrationClient {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Client tidak ditemukan.");

  const current = clients[idx]!;
  const nextName = patch.name?.trim() ?? current.name;
  const nextSystem =
    patch.externalSystem?.trim().toLowerCase() ?? current.externalSystem;
  const nextKeyId = patch.keyId?.trim() ?? current.keyId;
  const nextApiKey = patch.apiKey?.trim() ?? current.apiKey;

  if (!nextName) throw new Error("Nama wajib diisi.");
  if (!nextSystem) throw new Error("External system wajib diisi.");

  if (clients.some((c) => c.id !== id && c.externalSystem === nextSystem)) {
    throw new Error("External system sudah terpakai.");
  }
  if (clients.some((c) => c.id !== id && c.keyId === nextKeyId)) {
    throw new Error("keyId sudah terpakai.");
  }
  if (clients.some((c) => c.id !== id && c.apiKey === nextApiKey)) {
    throw new Error("apiKey sudah terpakai.");
  }

  const updated: IntegrationClient = {
    ...current,
    name: nextName,
    externalSystem: nextSystem,
    keyId: nextKeyId,
    apiKey: nextApiKey,
    scopes: patch.scopes ? normalizeScopes(patch.scopes) : current.scopes,
    isActive: patch.isActive ?? current.isActive,
    updatedAt: nowIso(),
  };
  clients[idx] = updated;
  return { ...updated, scopes: [...updated.scopes] };
}

export function rotateIntegrationClientKey(id: string): IntegrationClient {
  const current = findIntegrationClientById(id);
  if (!current) throw new Error("Client tidak ditemukan.");
  const slug = slugify(current.externalSystem);
  return updateIntegrationClient(id, {
    apiKey: `edc_sk_${slug}_${randomSuffix()}`,
  });
}

/** Soft-delete: deactivate + keep row for audit demo. */
export function deleteIntegrationClient(id: string): IntegrationClient {
  return updateIntegrationClient(id, { isActive: false });
}

export function hardDeleteIntegrationClient(id: string): IntegrationClient {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Client tidak ditemukan.");
  const [removed] = clients.splice(idx, 1);
  return { ...removed!, scopes: [...removed!.scopes] };
}
