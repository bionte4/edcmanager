/**
 * Integration scopes & seed clients.
 * Mutable client list lives in `data/integration-clients-store.ts`.
 */

export const INTEGRATION_SCOPES = [
  "tickets:read",
  "tickets:write",
  "tickets:events",
] as const;

export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

export interface IntegrationClient {
  id: string;
  name: string;
  /** Public key id shown to partners */
  keyId: string;
  /** Secret presented as Bearer / X-Api-Key */
  apiKey: string;
  scopes: IntegrationScope[];
  isActive: boolean;
  externalSystem: string;
  createdAt: string;
  updatedAt: string;
}

export const INTEGRATION_CLIENT_SEED: Omit<
  IntegrationClient,
  "createdAt" | "updatedAt"
>[] = [
  {
    id: "int-servicedesk",
    name: "External Service Desk",
    keyId: "edc_sdk_demo",
    apiKey: "edc_sk_demo_servicedesk_change_me",
    scopes: ["tickets:read", "tickets:write", "tickets:events"],
    isActive: true,
    externalSystem: "service-desk",
  },
  {
    id: "int-readonly",
    name: "BI / Reporting (read-only)",
    keyId: "edc_sdk_readonly",
    apiKey: "edc_sk_demo_readonly_change_me",
    scopes: ["tickets:read"],
    isActive: true,
    externalSystem: "reporting",
  },
];
