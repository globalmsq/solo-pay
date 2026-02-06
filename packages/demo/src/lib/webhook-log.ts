/**
 * In-memory store for demo: last N webhook payloads received.
 * Used only to verify webhook delivery in demo; not for production.
 */

const MAX_ENTRIES = 50;

export interface WebhookLogEntry {
  receivedAt: string;
  body: Record<string, unknown>;
}

const log: WebhookLogEntry[] = [];

export function appendWebhook(body: Record<string, unknown>): void {
  log.unshift({
    receivedAt: new Date().toISOString(),
    body,
  });
  if (log.length > MAX_ENTRIES) {
    log.pop();
  }
}

export function getWebhookLog(): WebhookLogEntry[] {
  return [...log];
}
