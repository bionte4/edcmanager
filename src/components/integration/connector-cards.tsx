"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Cable,
  FlaskConical,
  Mail,
  Pencil,
  Server,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_MODEL_PRESETS } from "@/config/ai-models";

interface EmailStatus {
  enabled: boolean;
  configured: boolean;
  mode: string;
  from: string;
  supervisorEmail: string;
  opsEmail: string;
  nocFallbackEmail: string;
  smtpReady: boolean;
}

interface SmtpStatus {
  configured: boolean;
  mode: string;
  host: string | null;
  port: number;
  secure?: boolean;
  user?: string | null;
  hasPassword?: boolean;
}

interface AiStatus {
  enabled: boolean;
  configured: boolean;
  mode: string;
  provider: string;
  model: string;
  endpoint?: string;
  hasApiKey?: boolean;
}

interface ApiStatus {
  configured: boolean;
  activeClients: number;
  basePath: string;
}

export interface ConnectorStatusPayload {
  email: EmailStatus;
  smtp: SmtpStatus;
  ai: AiStatus;
  api: ApiStatus;
}

function statusBadge(
  ok: boolean,
  labels: { ok: string; warn: string }
): { variant: "safe" | "warning"; label: string } {
  return ok
    ? { variant: "safe", label: labels.ok }
    : { variant: "warning", label: labels.warn };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-7 w-full rounded-md border border-input bg-background px-2 text-xs";

export function ConnectorCards({
  canManage,
  status,
  onRefresh,
  onToggleApiDocs,
  apiDocsOpen,
}: {
  canManage: boolean;
  status: ConnectorStatusPayload | null;
  onRefresh: () => Promise<void>;
  onToggleApiDocs?: () => void;
  apiDocsOpen?: boolean;
}) {
  const [editing, setEditing] = useState<"email" | "smtp" | "ai" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    target: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const [emailForm, setEmailForm] = useState({
    enabled: true,
    from: "",
    supervisorEmail: "",
    opsEmail: "",
    nocFallbackEmail: "",
  });
  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: "587",
    secure: false,
    user: "",
    pass: "",
  });
  const [aiForm, setAiForm] = useState({
    enabled: true,
    provider: "heuristic",
    apiKey: "",
    model: "gpt-4o-mini",
    customModel: "",
    endpoint: "",
  });

  useEffect(() => {
    if (!status) return;
    setEmailForm({
      enabled: status.email.enabled,
      from: status.email.from ?? "",
      supervisorEmail: status.email.supervisorEmail ?? "",
      opsEmail: status.email.opsEmail ?? "",
      nocFallbackEmail: status.email.nocFallbackEmail ?? "",
    });
    setSmtpForm({
      host: status.smtp.host ?? "",
      port: String(status.smtp.port ?? 587),
      secure: Boolean(status.smtp.secure),
      user: status.smtp.user ?? "",
      pass: "",
    });
    const preset = (AI_MODEL_PRESETS as readonly string[]).includes(status.ai.model);
    setAiForm({
      enabled: status.ai.enabled,
      provider: status.ai.provider,
      apiKey: "",
      model: preset ? status.ai.model : "custom",
      customModel: preset ? "" : status.ai.model,
      endpoint: status.ai.endpoint ?? "",
    });
  }, [status]);

  const runTest = useCallback(
    async (target: "email" | "smtp" | "ai" | "api") => {
      setBusy(`test-${target}`);
      setFeedback(null);
      try {
        const res = await fetch("/api/integrations/connectors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Test gagal");
        setFeedback({
          target,
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? "OK" : "Gagal"),
        });
        await onRefresh();
      } catch (e) {
        setFeedback({
          target,
          ok: false,
          message: e instanceof Error ? e.message : "Error",
        });
      } finally {
        setBusy(null);
      }
    },
    [onRefresh]
  );

  async function saveEmail() {
    setBusy("save-email");
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/connectors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connector: "email", email: emailForm }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal simpan Email");
      setFeedback({ target: "email", ok: true, message: "Email settings disimpan." });
      setEditing(null);
      await onRefresh();
    } catch (e) {
      setFeedback({
        target: "email",
        ok: false,
        message: e instanceof Error ? e.message : "Error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function saveSmtp() {
    setBusy("save-smtp");
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/connectors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector: "smtp",
          smtp: {
            host: smtpForm.host,
            port: Number(smtpForm.port) || 587,
            secure: smtpForm.secure,
            user: smtpForm.user,
            ...(smtpForm.pass ? { pass: smtpForm.pass } : {}),
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal simpan SMTP");
      setFeedback({ target: "smtp", ok: true, message: "SMTP settings disimpan." });
      setEditing(null);
      await onRefresh();
    } catch (e) {
      setFeedback({
        target: "smtp",
        ok: false,
        message: e instanceof Error ? e.message : "Error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function saveAi() {
    setBusy("save-ai");
    setFeedback(null);
    const model =
      aiForm.model === "custom" ? aiForm.customModel.trim() : aiForm.model;
    try {
      const res = await fetch("/api/integrations/connectors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector: "ai",
          ai: {
            enabled: aiForm.enabled,
            provider: aiForm.provider,
            model,
            endpoint: aiForm.endpoint,
            ...(aiForm.apiKey ? { apiKey: aiForm.apiKey } : {}),
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal simpan AI");
      setFeedback({ target: "ai", ok: true, message: `AI model → ${model}` });
      setEditing(null);
      await onRefresh();
    } catch (e) {
      setFeedback({
        target: "ai",
        ok: false,
        message: e instanceof Error ? e.message : "Error",
      });
    } finally {
      setBusy(null);
    }
  }

  const emailBadge = status
    ? status.email.enabled
      ? statusBadge(status.email.configured, { ok: "Active", warn: "Incomplete" })
      : { variant: "secondary" as const, label: "Disabled" }
    : { variant: "secondary" as const, label: "…" };

  const smtpBadge = statusBadge(Boolean(status?.smtp.configured), {
    ok: "SMTP Live",
    warn: "Simulated",
  });
  const aiBadge = status
    ? status.ai.enabled
      ? statusBadge(status.ai.configured, { ok: "LLM Active", warn: "Heuristic" })
      : { variant: "secondary" as const, label: "Disabled" }
    : { variant: "secondary" as const, label: "…" };
  const apiBadge = statusBadge(Boolean(status?.api.configured), {
    ok: "Ready",
    warn: "Offline",
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ConnectorCardShell
        icon={Mail}
        title="Email"
        subtitle="Notifikasi assign & eskalasi SLA — pengirim & penerima default"
        badge={emailBadge}
        meta={[
          { label: "Mode", value: status?.email.mode ?? "…" },
          { label: "From", value: status?.email.from ?? "…" },
          { label: "Ops", value: status?.email.opsEmail ?? "…" },
        ]}
        feedback={feedback?.target === "email" ? feedback : null}
        actions={
          canManage ? (
            <>
              <Button
                type="button"
                size="xs"
                variant={editing === "email" ? "default" : "outline"}
                onClick={() => setEditing(editing === "email" ? null : "email")}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy === "test-email"}
                onClick={() => void runTest("email")}
              >
                <FlaskConical className="h-3 w-3" />
                {busy === "test-email" ? "Testing…" : "Test kirim"}
              </Button>
              <Button asChild size="xs" variant="ghost">
                <Link href="/notifications">Logs</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="xs" variant="outline">
              <Link href="/notifications">Buka Notifications</Link>
            </Button>
          )
        }
      >
        {editing === "email" && canManage && (
          <div className="mt-2 grid gap-2 border-t border-border pt-2">
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={emailForm.enabled}
                onChange={(e) =>
                  setEmailForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              Email notifications enabled
            </label>
            <Field label="From">
              <input
                className={inputClass}
                value={emailForm.from}
                onChange={(e) => setEmailForm((f) => ({ ...f, from: e.target.value }))}
              />
            </Field>
            <Field label="Supervisor email">
              <input
                className={inputClass}
                value={emailForm.supervisorEmail}
                onChange={(e) =>
                  setEmailForm((f) => ({ ...f, supervisorEmail: e.target.value }))
                }
              />
            </Field>
            <Field label="Ops email">
              <input
                className={inputClass}
                value={emailForm.opsEmail}
                onChange={(e) => setEmailForm((f) => ({ ...f, opsEmail: e.target.value }))}
              />
            </Field>
            <Field label="NOC fallback">
              <input
                className={inputClass}
                value={emailForm.nocFallbackEmail}
                onChange={(e) =>
                  setEmailForm((f) => ({ ...f, nocFallbackEmail: e.target.value }))
                }
              />
            </Field>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="xs"
                disabled={busy === "save-email"}
                onClick={() => void saveEmail()}
              >
                {busy === "save-email" ? "Saving…" : "Simpan Email"}
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={() => setEditing(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </ConnectorCardShell>

      <ConnectorCardShell
        icon={Server}
        title="SMTP"
        subtitle="Transport server email (host, port, kredensial)"
        badge={smtpBadge}
        meta={[
          { label: "Mode", value: status?.smtp.mode ?? "…" },
          {
            label: "Host",
            value: status?.smtp.host
              ? `${status.smtp.host}:${status.smtp.port}`
              : "belum di-set",
          },
          { label: "User", value: status?.smtp.user || "—" },
        ]}
        feedback={feedback?.target === "smtp" ? feedback : null}
        actions={
          canManage ? (
            <>
              <Button
                type="button"
                size="xs"
                variant={editing === "smtp" ? "default" : "outline"}
                onClick={() => setEditing(editing === "smtp" ? null : "smtp")}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy === "test-smtp"}
                onClick={() => void runTest("smtp")}
              >
                <FlaskConical className="h-3 w-3" />
                {busy === "test-smtp" ? "Testing…" : "Test koneksi"}
              </Button>
            </>
          ) : null
        }
      >
        {editing === "smtp" && canManage && (
          <div className="mt-2 grid gap-2 border-t border-border pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Host">
                <input
                  className={inputClass}
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="smtp.example.com"
                />
              </Field>
              <Field label="Port">
                <input
                  className={inputClass}
                  value={smtpForm.port}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, port: e.target.value }))}
                />
              </Field>
              <Field label="User">
                <input
                  className={inputClass}
                  value={smtpForm.user}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, user: e.target.value }))}
                />
              </Field>
              <Field label="Password">
                <input
                  className={inputClass}
                  type="password"
                  value={smtpForm.pass}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, pass: e.target.value }))}
                  placeholder={status?.smtp.hasPassword ? "(tetap / ganti)" : ""}
                />
              </Field>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={smtpForm.secure}
                onChange={(e) =>
                  setSmtpForm((f) => ({ ...f, secure: e.target.checked }))
                }
              />
              TLS/SSL (secure)
            </label>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="xs"
                disabled={busy === "save-smtp"}
                onClick={() => void saveSmtp()}
              >
                {busy === "save-smtp" ? "Saving…" : "Simpan SMTP"}
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={() => setEditing(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </ConnectorCardShell>

      <ConnectorCardShell
        icon={Bot}
        title="AI Insight"
        subtitle="Risk score, shift briefing, rekomendasi eskalasi NOC"
        badge={aiBadge}
        meta={[
          { label: "Mode", value: status?.ai.mode ?? "…" },
          { label: "Provider", value: status?.ai.provider ?? "…" },
          { label: "Model", value: status?.ai.model ?? "…" },
        ]}
        feedback={feedback?.target === "ai" ? feedback : null}
        actions={
          canManage ? (
            <>
              <Button
                type="button"
                size="xs"
                variant={editing === "ai" ? "default" : "outline"}
                onClick={() => setEditing(editing === "ai" ? null : "ai")}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy === "test-ai"}
                onClick={() => void runTest("ai")}
              >
                <FlaskConical className="h-3 w-3" />
                {busy === "test-ai" ? "Testing…" : "Test"}
              </Button>
              <Button asChild size="xs" variant="ghost">
                <Link href="/">Briefing</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="xs" variant="outline">
              <Link href="/">Dashboard Briefing</Link>
            </Button>
          )
        }
      >
        {editing === "ai" && canManage && (
          <div className="mt-2 grid gap-2 border-t border-border pt-2">
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={aiForm.enabled}
                onChange={(e) =>
                  setAiForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              AI Insight enabled
            </label>
            <Field label="Model">
              <select
                className={inputClass}
                value={aiForm.model}
                onChange={(e) => setAiForm((f) => ({ ...f, model: e.target.value }))}
              >
                {AI_MODEL_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </Field>
            {aiForm.model === "custom" && (
              <Field label="Custom model id">
                <input
                  className={inputClass}
                  value={aiForm.customModel}
                  onChange={(e) =>
                    setAiForm((f) => ({ ...f, customModel: e.target.value }))
                  }
                  placeholder="my-model-id"
                />
              </Field>
            )}
            <Field label="Provider">
              <select
                className={inputClass}
                value={aiForm.provider}
                onChange={(e) =>
                  setAiForm((f) => ({ ...f, provider: e.target.value }))
                }
              >
                <option value="heuristic">heuristic</option>
                <option value="openai">openai</option>
                <option value="azure">azure</option>
                <option value="custom">custom</option>
              </select>
            </Field>
            <Field label="API key">
              <input
                className={inputClass}
                type="password"
                value={aiForm.apiKey}
                onChange={(e) => setAiForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={status?.ai.hasApiKey ? "(tetap / ganti)" : "sk-…"}
              />
            </Field>
            <Field label="Endpoint">
              <input
                className={inputClass}
                value={aiForm.endpoint}
                onChange={(e) =>
                  setAiForm((f) => ({ ...f, endpoint: e.target.value }))
                }
              />
            </Field>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="xs"
                disabled={busy === "save-ai"}
                onClick={() => void saveAi()}
              >
                {busy === "save-ai" ? "Saving…" : "Simpan AI"}
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={() => setEditing(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </ConnectorCardShell>

      <ConnectorCardShell
        icon={Cable}
        title="REST API v1"
        subtitle="Sinkron ticketing / ITSM eksternal via API key"
        badge={apiBadge}
        meta={[
          { label: "Base", value: status?.api.basePath ?? "/api/v1" },
          {
            label: "Clients",
            value: status ? String(status.api.activeClients) : "…",
          },
          { label: "Auth", value: "Bearer / X-Api-Key" },
        ]}
        feedback={feedback?.target === "api" ? feedback : null}
        actions={
          <>
            {canManage && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy === "test-api"}
                onClick={() => void runTest("api")}
              >
                <FlaskConical className="h-3 w-3" />
                {busy === "test-api" ? "Testing…" : "Test"}
              </Button>
            )}
            <Button
              type="button"
              size="xs"
              variant={apiDocsOpen ? "default" : "outline"}
              onClick={onToggleApiDocs}
            >
              {apiDocsOpen ? "Sembunyikan docs" : "Lihat API docs"}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ConnectorCardShell({
  icon: Icon,
  title,
  subtitle,
  badge,
  meta,
  actions,
  feedback,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge: { variant: "safe" | "warning" | "secondary"; label: string };
  meta: Array<{ label: string; value: string }>;
  actions?: React.ReactNode;
  feedback?: { ok: boolean; message: string } | null;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-foreground">{title}</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col gap-2">
        <dl className="grid gap-1 text-[11px]">
          {meta.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate font-mono text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
        {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
        {feedback && (
          <p className={`text-[11px] ${feedback.ok ? "text-sla-safe" : "text-sla-breached"}`}>
            {feedback.message}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
