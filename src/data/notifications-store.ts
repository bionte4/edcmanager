import type { NotificationEventType } from "@/config/smtp.config";

export interface NotificationRecord {
  id: string;
  event: NotificationEventType;
  channel: "EMAIL";
  status: "QUEUED" | "SENT" | "FAILED" | "SIMULATED";
  toAddress: string;
  subject: string;
  body: string;
  ticketId?: string;
  ticketNumber?: string;
  error?: string;
  createdAt: string;
}

let logs: NotificationRecord[] = [];

export function listNotifications(limit = 50): NotificationRecord[] {
  return logs.slice(0, limit).map((l) => ({ ...l }));
}

export function addNotification(record: Omit<NotificationRecord, "id" | "createdAt">): NotificationRecord {
  const entry: NotificationRecord = {
    ...record,
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  logs = [entry, ...logs].slice(0, 200);
  return { ...entry };
}
