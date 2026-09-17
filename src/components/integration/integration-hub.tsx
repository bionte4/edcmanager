"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import {
  ConnectorCards,
  type ConnectorStatusPayload,
} from "@/components/integration/connector-cards";
import { IntegrationClientsCrud } from "@/components/integration/integration-clients-crud";
import { cn } from "@/lib/utils";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/tickets",
    scope: "tickets:read",
    desc: "List tickets",
  },
  {
    method: "POST",
    path: "/api/v1/tickets",
    scope: "tickets:write",
    desc: "Create ticket from external system",
  },
  {
    method: "GET",
    path: "/api/v1/tickets/:id",
    scope: "tickets:read",
    desc: "Get by id atau ticketNumber",
  },
  {
    method: "PATCH",
    path: "/api/v1/tickets/:id",
    scope: "tickets:write",
    desc: "Sync status / deskripsi / teknisi",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/:id/events",
    scope: "tickets:events",
    desc: "Append activity note",
  },
] as const;

export function IntegrationHub() {
  const { can } = useAuth();
  const canManage = can("admin:access");
  const [status, setStatus] = useState<ConnectorStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApiDocs, setShowApiDocs] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status", { cache: "no-store" });
      const data = (await res.json()) as ConnectorStatusPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memuat status");
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-sla-breached">{error}</p>}

      <ConnectorCards
        canManage={canManage}
        status={status}
        onRefresh={loadStatus}
        apiDocsOpen={showApiDocs}
        onToggleApiDocs={() => setShowApiDocs((v) => !v)}
      />

      {canManage && <IntegrationClientsCrud onChanged={() => void loadStatus()} />}

      {showApiDocs && (
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                Header{" "}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">
                  Authorization: Bearer &lt;apiKey&gt;
                </code>{" "}
                atau{" "}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">
                  X-Api-Key: &lt;apiKey&gt;
                </code>
                .
              </p>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[11px] text-foreground">
{`curl -s http://localhost:3000/api/v1/tickets \\
  -H "Authorization: Bearer <apiKey dari CRUD client>"`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {ENDPOINTS.map((ep) => (
                <div
                  key={`${ep.method}-${ep.path}`}
                  className={cn(
                    "flex flex-col gap-1 rounded-md border border-border px-2.5 py-2",
                    "sm:flex-row sm:items-center sm:justify-between"
                  )}
                >
                  <div>
                    <p className="font-mono text-xs">
                      <Badge variant="secondary" className="mr-2">
                        {ep.method}
                      </Badge>
                      {ep.path}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{ep.desc}</p>
                  </div>
                  <Badge variant="outline" className="w-fit font-mono text-[10px]">
                    {ep.scope}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
