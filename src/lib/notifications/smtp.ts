import nodemailer from "nodemailer";
import {
  getEmailSettings,
  getSmtpSettings,
  isSmtpConfigured,
} from "@/data/connector-settings-store";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  mode: "sent" | "simulated" | "failed";
  messageId?: string;
  error?: string;
}

/**
 * Send email via SMTP when configured; otherwise simulate (log-only) for demo.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const email = getEmailSettings();
  if (!email.enabled) {
    return { mode: "failed", error: "Email notifications disabled" };
  }

  if (!isSmtpConfigured()) {
    console.info("[smtp:simulated]", {
      to: input.to,
      subject: input.subject,
      preview: input.text.slice(0, 120),
    });
    return { mode: "simulated", messageId: `sim-${Date.now()}` };
  }

  const cfg = getSmtpSettings();

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });

    const info = await transporter.sendMail({
      from: email.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<pre style="font-family:sans-serif">${escapeHtml(input.text)}</pre>`,
    });

    return { mode: "sent", messageId: info.messageId };
  } catch (e) {
    const error = e instanceof Error ? e.message : "SMTP send failed";
    console.error("[smtp:failed]", error);
    return { mode: "failed", error };
  }
}

/** Verify SMTP credentials / reachability without sending mail when possible. */
export async function testSmtpConnection(): Promise<{
  ok: boolean;
  mode: "live" | "simulated";
  message: string;
}> {
  if (!isSmtpConfigured()) {
    return {
      ok: true,
      mode: "simulated",
      message: "SMTP belum diisi — mode simulated OK (isi host/user/pass untuk live test).",
    };
  }

  const cfg = getSmtpSettings();
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
    });
    await transporter.verify();
    return {
      ok: true,
      mode: "live",
      message: `SMTP verify OK · ${cfg.host}:${cfg.port}`,
    };
  } catch (e) {
    return {
      ok: false,
      mode: "live",
      message: e instanceof Error ? e.message : "SMTP verify gagal",
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
