import type { PaymentConfirmedBody } from './types';

/** Retry delays in ms: 10s, 30s, 90s (3 retries after first attempt). */
const RETRY_DELAYS_MS = [10_000, 30_000, 90_000];

/**
 * POST body to url. Retries up to 3 times on non-2xx or network error.
 * Delays: 10s, 30s, 90s between retries.
 */
export async function sendWebhook(
  url: string,
  body: PaymentConfirmedBody,
  options?: { signal?: AbortSignal }
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  let lastError: string | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      lastStatus = res.status;

      if (res.ok) {
        return { ok: true, statusCode: res.status };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  return { ok: false, statusCode: lastStatus, error: lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
