import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAiSettings,
  getEmailSettings,
  isLlmConfigured,
  publicAiView,
  publicEmailView,
  publicSmtpView,
  updateAiSettings,
  updateEmailSettings,
  updateSmtpSettings,
} from "@/data/connector-settings-store";
import {
  countActiveIntegrationClients,
  listIntegrationClients,
} from "@/data/integration-clients-store";
import { findUserById } from "@/data/users-store";
import {
  SESSION_COOKIE,
  sessionToAuthUser,
  verifySessionToken,
} from "@/lib/auth/session";
import { assertCan, type AuthUser } from "@/lib/rbac";
import { testSmtpConnection } from "@/lib/notifications/smtp";
import { notifyTest } from "@/lib/notifications/service";

async function requireAdmin(): Promise<AuthUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await verifySessionToken(token);
  if (!session) throw new Error("Unauthorized");
  const stored = await findUserById(session.sub);
  if (!stored || !stored.isActive) throw new Error("Unauthorized");
  const user = sessionToAuthUser(session);
  assertCan(user, "admin:access");
  return user;
}

function statusFor(e: unknown): number {
  const message = e instanceof Error ? e.message : "Error";
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 400;
}

async function allViews() {
  return {
    email: publicEmailView(),
    smtp: publicSmtpView(),
    ai: publicAiView(),
    api: {
      configured: true,
      activeClients: await countActiveIntegrationClients(),
      basePath: "/api/v1",
    },
  };
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await allViews());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: statusFor(e) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      connector?: "email" | "smtp" | "ai";
      email?: {
        enabled?: boolean;
        from?: string;
        supervisorEmail?: string;
        opsEmail?: string;
        nocFallbackEmail?: string;
      };
      smtp?: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
      };
      ai?: {
        enabled?: boolean;
        provider?: string;
        apiKey?: string;
        model?: string;
        endpoint?: string;
      };
    };

    if (body.connector === "email" || body.email) {
      updateEmailSettings(body.email ?? {});
      return NextResponse.json(await allViews());
    }

    if (body.connector === "smtp" || body.smtp) {
      updateSmtpSettings(body.smtp ?? {});
      return NextResponse.json(await allViews());
    }

    if (body.connector === "ai" || body.ai) {
      updateAiSettings(body.ai ?? {});
      return NextResponse.json(await allViews());
    }

    return NextResponse.json(
      { error: "connector wajib (email|smtp|ai)" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal update" },
      { status: statusFor(e) }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      target?: "email" | "smtp" | "ai" | "api";
      to?: string;
    };

    if (body.target === "email") {
      const email = getEmailSettings();
      if (!email.enabled) {
        return NextResponse.json({
          target: "email",
          ok: false,
          mode: "disabled",
          message: "Email notifications dinonaktifkan.",
          status: publicEmailView(),
        });
      }
      const record = await notifyTest(body.to);
      const ok = record.status === "SENT" || record.status === "SIMULATED";
      return NextResponse.json({
        target: "email",
        ok,
        mode: record.status.toLowerCase(),
        message: ok
          ? `Test email ${record.status} → ${record.toAddress}`
          : `Test email gagal: ${record.error ?? "unknown"}`,
        send: { status: record.status, id: record.id },
        status: publicEmailView(),
      });
    }

    if (body.target === "smtp") {
      const verify = await testSmtpConnection();
      return NextResponse.json({
        target: "smtp",
        ok: verify.ok,
        mode: verify.mode,
        message: verify.message,
        status: publicSmtpView(),
      });
    }

    if (body.target === "ai") {
      const cfg = getAiSettings();
      if (!cfg.enabled) {
        return NextResponse.json({
          target: "ai",
          ok: false,
          mode: "disabled",
          message: "AI Insight dinonaktifkan.",
          status: publicAiView(),
        });
      }

      if (!isLlmConfigured()) {
        return NextResponse.json({
          target: "ai",
          ok: true,
          mode: "heuristic",
          message: `Heuristic OK · model preset ${cfg.model} (isi API key untuk test LLM).`,
          status: publicAiView(),
        });
      }

      try {
        const res = await fetch(cfg.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            temperature: 0,
            max_tokens: 16,
            messages: [
              { role: "user", content: 'Reply with exactly: {"ok":true}' },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return NextResponse.json({
            target: "ai",
            ok: false,
            mode: "llm",
            message: `LLM HTTP ${res.status}: ${text.slice(0, 180)}`,
            status: publicAiView(),
          });
        }
        return NextResponse.json({
          target: "ai",
          ok: true,
          mode: "llm",
          message: `LLM OK · ${cfg.model} via ${cfg.provider}`,
          status: publicAiView(),
        });
      } catch (e) {
        return NextResponse.json({
          target: "ai",
          ok: false,
          mode: "llm",
          message: e instanceof Error ? e.message : "LLM test gagal",
          status: publicAiView(),
        });
      }
    }

    if (body.target === "api") {
      const clients = await listIntegrationClients(false);
      const active = clients.filter((c) => c.isActive);
      if (active.length === 0) {
        return NextResponse.json({
          target: "api",
          ok: false,
          mode: "ready",
          message: "Tidak ada API client aktif.",
          status: { activeClients: 0, basePath: "/api/v1" },
        });
      }
      const sample = active[0]!;
      return NextResponse.json({
        target: "api",
        ok: true,
        mode: "ready",
        message: `API ready · ${active.length} client aktif (contoh: ${sample.name} / ${sample.keyId})`,
        status: {
          activeClients: active.length,
          basePath: "/api/v1",
          sampleKeyId: sample.keyId,
        },
      });
    }

    return NextResponse.json(
      { error: "target wajib (email|smtp|ai|api)" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Test gagal" },
      { status: statusFor(e) }
    );
  }
}
