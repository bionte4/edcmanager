import nodemailer from "nodemailer";
import { SMTP_CONFIG, isSmtpConfigured } from "@/config/smtp.config";

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
  if (!isSmtpConfigured()) {
    console.info("[smtp:simulated]", {
      to: input.to,
      subject: input.subject,
      preview: input.text.slice(0, 120),
    });
    return { mode: "simulated", messageId: `sim-${Date.now()}` };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.secure,
      auth: {
        user: SMTP_CONFIG.user,
        pass: SMTP_CONFIG.pass,
      },
    });

    const info = await transporter.sendMail({
      from: SMTP_CONFIG.from,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
