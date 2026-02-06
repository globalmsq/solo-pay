'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WebhookLogEntry {
  receivedAt: string;
  body: Record<string, unknown>;
}

export default function WebhookLogPage() {
  const [log, setLog] = useState<WebhookLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = async () => {
    try {
      const res = await fetch('/api/webhook/log');
      if (res.ok) {
        const data = await res.json();
        setLog(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
    const interval = setInterval(fetchLog, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <Link href="/" className="text-primary-600 hover:underline text-sm mb-2 inline-block">
          ← Back to Demo
        </Link>
        <h1 className="text-2xl font-bold text-primary-600">Webhook Log</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Data (payment.confirmed) sent to this app by the gateway when a payment is confirmed. List
          refreshes every 3 seconds.
        </p>
      </header>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : log.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-gray-600 dark:text-gray-400">
            No webhooks received yet. Complete a payment and call GET /payments/:id/status (or GET
            /payments?orderId=...) so the gateway syncs status and sends a webhook here.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Demo merchant webhook_url should point to this app (e.g. http://demo:3000/api/webhook in
            Docker, or http://localhost:3000/api/webhook when running locally).
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {log.map((entry, i) => (
            <li
              key={`${entry.receivedAt}-${i}`}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {new Date(entry.receivedAt).toLocaleString()}
              </p>
              <pre className="text-sm overflow-x-auto bg-gray-50 dark:bg-gray-900 p-3 rounded">
                {JSON.stringify(entry.body, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
