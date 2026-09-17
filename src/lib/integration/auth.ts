import {
  INTEGRATION_CLIENTS,
  type IntegrationClient,
  type IntegrationScope,
} from "@/config/integration.config";

export function findClientByApiKey(raw: string | null): IntegrationClient | null {
  if (!raw) return null;
  const key = raw.trim();
  if (!key) return null;
  const client = INTEGRATION_CLIENTS.find((c) => c.isActive && c.apiKey === key);
  return client ?? null;
}

/** Accept `Authorization: Bearer <key>` or `X-Api-Key: <key>`. */
export function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey;

  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export function requireIntegrationClient(
  request: Request,
  scope: IntegrationScope
): IntegrationClient {
  const apiKey = extractApiKey(request);
  const client = findClientByApiKey(apiKey);
  if (!client) {
    throw Object.assign(new Error("Invalid or missing API key"), { status: 401 });
  }
  if (!client.scopes.includes(scope)) {
    throw Object.assign(new Error(`Forbidden: missing scope ${scope}`), {
      status: 403,
    });
  }
  return client;
}
