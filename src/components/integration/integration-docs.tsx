"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INTEGRATION_CLIENTS } from "@/config/integration.config";
import { useAuth } from "@/components/auth/auth-provider";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/tickets",
    scope: "tickets:read",
    desc: "List tickets (filter: itsmType, status, externalSystem, updatedSince)",
  },
  {
    method: "POST",
    path: "/api/v1/tickets",
    scope: "tickets:write",
    desc: "Create ticket from external system (requires externalTicketId)",
  },
  {
    method: "GET",
    path: "/api/v1/tickets/:id",
    scope: "tickets:read",
    desc: "Get by internal id or ticketNumber (e.g. INC-2026-8841)",
  },
  {
    method: "PATCH",
    path: "/api/v1/tickets/:id",
    scope: "tickets:write",
    desc: "Sync status / description / technician / problem links",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/:id/events",
    scope: "tickets:events",
    desc: "Append activity note from external system",
  },
] as const;

export function IntegrationDocs() {
  const { can } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Gunakan header{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              Authorization: Bearer &lt;apiKey&gt;
            </code>{" "}
            atau{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              X-Api-Key: &lt;apiKey&gt;
            </code>
            . Tidak memakai cookie login NOC.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground">
{`curl -s http://localhost:3000/api/v1/tickets \\
  -H "Authorization: Bearer edc_sk_demo_servicedesk_change_me"`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ENDPOINTS.map((ep) => (
            <div
              key={`${ep.method}-${ep.path}`}
              className="flex flex-col gap-1 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-mono text-xs">
                  <Badge variant="secondary" className="mr-2">
                    {ep.method}
                  </Badge>
                  {ep.path}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{ep.desc}</p>
              </div>
              <Badge variant="outline" className="w-fit font-mono text-[10px]">
                {ep.scope}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Create payload example</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px]">
{`POST /api/v1/tickets
{
  "externalTicketId": "SD-10042",
  "externalSystem": "service-desk",
  "itsmType": "INCIDENT",
  "process": "CM",
  "merchantId": "MID-778899",
  "location": "DALAM_KOTA",
  "category": "VIP",
  "description": "EDC offline synced from external desk",
  "vendorName": "Vendor 1"
}`}
          </pre>
        </CardContent>
      </Card>

      {can("admin:access") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Demo API keys</CardTitle>
            <p className="text-xs text-muted-foreground">
              Hanya terlihat untuk Admin — ganti sebelum production
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {INTEGRATION_CLIENTS.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-3 text-xs">
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground">system: {c.externalSystem}</p>
                <p className="mt-1 font-mono">keyId: {c.keyId}</p>
                <p className="font-mono break-all">apiKey: {c.apiKey}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.scopes.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
