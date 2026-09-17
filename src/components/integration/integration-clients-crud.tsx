"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INTEGRATION_SCOPES,
  type IntegrationClient,
  type IntegrationScope,
} from "@/config/integration.config";

export function IntegrationClientsCrud({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [clients, setClients] = useState<IntegrationClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [externalSystem, setExternalSystem] = useState("");
  const [scopes, setScopes] = useState<IntegrationScope[]>(["tickets:read"]);
  const [isActive, setIsActive] = useState(true);
  const [keyId, setKeyId] = useState("");
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/integrations/clients", { cache: "no-store" });
    const data = (await res.json()) as {
      clients?: IntegrationClient[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Gagal memuat clients");
      return;
    }
    setClients(data.clients ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setExternalSystem("");
    setScopes(["tickets:read"]);
    setIsActive(true);
    setKeyId("");
    setApiKey("");
  }

  function startEdit(client: IntegrationClient) {
    setEditingId(client.id);
    setName(client.name);
    setExternalSystem(client.externalSystem);
    setScopes([...client.scopes]);
    setIsActive(client.isActive);
    setKeyId(client.keyId);
    setApiKey(client.apiKey);
    setMessage(null);
    setError(null);
  }

  function toggleScope(scope: IntegrationScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const payload = {
      id: editingId ?? undefined,
      name,
      externalSystem,
      scopes,
      isActive,
      ...(editingId
        ? { keyId, apiKey }
        : {
            ...(keyId ? { keyId } : {}),
            ...(apiKey ? { apiKey } : {}),
          }),
    };

    const res = await fetch("/api/integrations/clients", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan");
      return;
    }
    setMessage(editingId ? "Client diperbarui." : "Client dibuat.");
    resetForm();
    await load();
    onChanged?.();
  }

  async function onRotate(id: string) {
    if (!confirm("Rotate API key? Key lama langsung invalid.")) return;
    setError(null);
    setMessage(null);
    const res = await fetch("/api/integrations/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate", id }),
    });
    const data = (await res.json()) as { error?: string; client?: IntegrationClient };
    if (!res.ok) {
      setError(data.error || "Gagal rotate key");
      return;
    }
    setMessage(`Key di-rotate: ${data.client?.apiKey ?? ""}`);
    await load();
    onChanged?.();
  }

  async function onDelete(id: string, hard: boolean) {
    const ok = confirm(
      hard
        ? "Hapus permanen client ini?"
        : "Nonaktifkan client ini (soft delete)?"
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    const qs = new URLSearchParams({ id });
    if (hard) qs.set("hard", "1");
    const res = await fetch(`/api/integrations/clients?${qs.toString()}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Gagal hapus");
      return;
    }
    setMessage(hard ? "Client dihapus." : "Client dinonaktifkan.");
    if (editingId === id) resetForm();
    await load();
    onChanged?.();
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-foreground">
            <Plus className="h-3.5 w-3.5" />
            {editingId ? "Edit API Client" : "Tambah API Client"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2.5" onSubmit={(e) => void onSubmit(e)}>
            <Field label="Nama">
              <input
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="External Service Desk"
              />
            </Field>
            <Field label="External system">
              <input
                className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs"
                value={externalSystem}
                onChange={(e) => setExternalSystem(e.target.value)}
                required
                placeholder="service-desk"
              />
            </Field>
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] text-muted-foreground">Scopes</legend>
              <div className="flex flex-wrap gap-1.5">
                {INTEGRATION_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    <span className="font-mono">{scope}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Aktif
            </label>
            {editingId && (
              <>
                <Field label="keyId">
                  <input
                    className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    required
                  />
                </Field>
                <Field label="apiKey">
                  <input
                    className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                  />
                </Field>
              </>
            )}
            {!editingId && (
              <p className="text-[11px] text-muted-foreground">
                keyId & apiKey di-generate otomatis jika dikosongkan.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button type="submit" size="xs">
                {editingId ? "Update" : "Create"}
              </Button>
              {editingId && (
                <Button type="button" size="xs" variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              )}
            </div>
            {error && <p className="text-xs text-sla-breached">{error}</p>}
            {message && <p className="text-xs text-sla-safe">{message}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            API Clients ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                    Belum ada client.
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-[11px]">{c.externalSystem}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {c.scopes.map((s) => (
                          <Badge key={s} variant="secondary" className="font-mono text-[9px]">
                            {s.replace("tickets:", "")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "safe" : "warning"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-[10px]" title={c.apiKey}>
                      {c.keyId}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(c)}
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => void onRotate(c.id)}
                          title="Rotate key"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => void onDelete(c.id, false)}
                          title="Deactivate"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
