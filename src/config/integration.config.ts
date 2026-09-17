/**
 * Machine-to-machine API keys for external ticketing / ITSM integrations.
 * Rotate keys in production; prefer DB-backed secrets later.
 */

export type IntegrationScope =
  | "tickets:read"
  | "tickets:write"
  | "tickets:events";

export interface IntegrationClient {
  id: string;
  name: string;
  /** Public key id shown to partners */
  keyId: string;
  /** Secret presented as Bearer / X-Api-Key */
  apiKey: string;
  scopes: readonly IntegrationScope[];
  isActive: boolean;
  externalSystem: string;
}

export const INTEGRATION_CLIENTS: IntegrationClient[] = [
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
