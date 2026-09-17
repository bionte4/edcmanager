/**
 * Runtime connector settings (Email notifications, SMTP transport, AI).
 * Seeded from env; Admin can override via Integrations UI (in-memory until restart).
 */

export interface EmailSettings {
  enabled: boolean;
  from: string;
  supervisorEmail: string;
  opsEmail: string;
  nocFallbackEmail: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface AiSettings {
  enabled: boolean;
  provider: string;
  apiKey: string;
  model: string;
  endpoint: string;
}

const emailDefaults: EmailSettings = {
  enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED !== "false",
  from: process.env.SMTP_FROM ?? "EDC Manager <noreply@edc.local>",
  supervisorEmail: process.env.NOTIFY_SUPERVISOR_EMAIL ?? "dewi.supervisor@edc.local",
  opsEmail: process.env.NOTIFY_OPS_EMAIL ?? "rudi.ops@edc.local",
  nocFallbackEmail: process.env.NOTIFY_NOC_EMAIL ?? "andi.noc@edc.local",
};

const smtpDefaults: SmtpSettings = {
  host: process.env.SMTP_HOST ?? "",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER ?? "",
  pass: process.env.SMTP_PASS ?? "",
};

const aiDefaults: AiSettings = {
  enabled: process.env.AI_INSIGHTS_ENABLED !== "false",
  provider: process.env.AI_PROVIDER ?? "heuristic",
  apiKey: process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  model: process.env.AI_MODEL ?? "gpt-4o-mini",
  endpoint:
    process.env.AI_ENDPOINT ?? "https://api.openai.com/v1/chat/completions",
};

let emailSettings: EmailSettings = { ...emailDefaults };
let smtpSettings: SmtpSettings = { ...smtpDefaults };
let aiSettings: AiSettings = { ...aiDefaults };

export function getEmailSettings(): EmailSettings {
  return { ...emailSettings };
}

export function updateEmailSettings(patch: Partial<EmailSettings>): EmailSettings {
  emailSettings = {
    ...emailSettings,
    enabled: patch.enabled ?? emailSettings.enabled,
    from: patch.from !== undefined ? patch.from.trim() : emailSettings.from,
    supervisorEmail:
      patch.supervisorEmail !== undefined
        ? patch.supervisorEmail.trim()
        : emailSettings.supervisorEmail,
    opsEmail:
      patch.opsEmail !== undefined ? patch.opsEmail.trim() : emailSettings.opsEmail,
    nocFallbackEmail:
      patch.nocFallbackEmail !== undefined
        ? patch.nocFallbackEmail.trim()
        : emailSettings.nocFallbackEmail,
  };
  return getEmailSettings();
}

export function getSmtpSettings(): SmtpSettings {
  return { ...smtpSettings };
}

export function isSmtpConfigured(): boolean {
  return Boolean(smtpSettings.host && smtpSettings.user && smtpSettings.pass);
}

export function updateSmtpSettings(patch: Partial<SmtpSettings>): SmtpSettings {
  smtpSettings = {
    ...smtpSettings,
    host: patch.host !== undefined ? patch.host.trim() : smtpSettings.host,
    port:
      patch.port !== undefined
        ? Number(patch.port) || smtpSettings.port
        : smtpSettings.port,
    secure: patch.secure ?? smtpSettings.secure,
    user: patch.user !== undefined ? patch.user.trim() : smtpSettings.user,
    pass: patch.pass !== undefined ? patch.pass : smtpSettings.pass,
  };
  return getSmtpSettings();
}

export function getAiSettings(): AiSettings {
  return { ...aiSettings };
}

export function isLlmConfigured(): boolean {
  return Boolean(aiSettings.apiKey.trim());
}

export function updateAiSettings(patch: Partial<AiSettings>): AiSettings {
  const nextProvider =
    patch.provider !== undefined ? patch.provider.trim() : aiSettings.provider;
  aiSettings = {
    ...aiSettings,
    enabled: patch.enabled ?? aiSettings.enabled,
    provider: nextProvider || "heuristic",
    apiKey: patch.apiKey !== undefined ? patch.apiKey.trim() : aiSettings.apiKey,
    model: patch.model !== undefined ? patch.model.trim() || aiSettings.model : aiSettings.model,
    endpoint:
      patch.endpoint !== undefined
        ? patch.endpoint.trim() || aiSettings.endpoint
        : aiSettings.endpoint,
  };
  if (aiSettings.apiKey && aiSettings.provider === "heuristic") {
    aiSettings.provider = "openai";
  }
  if (!aiSettings.apiKey && (aiSettings.provider === "openai" || !aiSettings.provider)) {
    aiSettings.provider = "heuristic";
  }
  return getAiSettings();
}

export function publicEmailView() {
  const e = getEmailSettings();
  return {
    enabled: e.enabled,
    configured: Boolean(e.from && e.opsEmail),
    mode: e.enabled ? "active" : "disabled",
    from: e.from,
    supervisorEmail: e.supervisorEmail,
    opsEmail: e.opsEmail,
    nocFallbackEmail: e.nocFallbackEmail,
    smtpReady: isSmtpConfigured(),
  };
}

export function publicSmtpView() {
  const s = getSmtpSettings();
  const configured = isSmtpConfigured();
  return {
    configured,
    mode: configured ? "live" : "simulated",
    host: s.host || null,
    port: s.port,
    secure: s.secure,
    user: s.user || null,
    hasPassword: Boolean(s.pass),
  };
}

export function publicAiView() {
  const a = getAiSettings();
  const configured = isLlmConfigured();
  return {
    enabled: a.enabled,
    configured,
    mode: configured ? "llm" : "heuristic",
    provider: a.provider,
    model: a.model,
    endpoint: a.endpoint,
    hasApiKey: configured,
  };
}
