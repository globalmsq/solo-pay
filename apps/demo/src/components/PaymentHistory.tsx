"use client";

import { useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { SUBGRAPH_URL } from "@/lib/wagmi";

interface Payment {
  id: string;
  payer: string;
  merchant: string;
  token: string;
  amount: string;
  timestamp: string;
  transactionHash: string;
  gasMode: string;
}

export function PaymentHistory() {
  const { address } = useAccount();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    if (!address || !SUBGRAPH_URL) {
      setError("Subgraph not configured yet");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = `
        query GetUserPayments($payer: Bytes!) {
          payments(
            where: { payer: $payer }
            orderBy: timestamp
            orderDirection: desc
            first: 20
          ) {
            id
            payer
            merchant
            token
            amount
            timestamp
            transactionHash
            gasMode
          }
        }
      `;

      const response = await fetch(SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { payer: address.toLowerCase() },
        }),
      });

      const result = await response.json();
      setPayments(result.data?.payments || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold">Recent Payments</h3>
        <button
          onClick={fetchPayments}
          disabled={loading || !SUBGRAPH_URL}
          className="px-3 py-1 text-sm bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-lg hover:bg-primary-200 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="p-4">
        {!SUBGRAPH_URL && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            Subgraph not deployed yet. Payment history will be available after deployment.
          </p>
        )}

        {error && (
          <div className="text-center text-red-500 py-4">{error}</div>
        )}

        {SUBGRAPH_URL && payments.length === 0 && !loading && !error && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No payments found. Click refresh to load.
          </p>
        )}

        {payments.length > 0 && (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold">
                      {formatUnits(BigInt(payment.amount), 18)} SUT
                    </span>
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        payment.gasMode === "Direct"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      }`}
                    >
                      {payment.gasMode}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(payment.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>To: {truncateAddress(payment.merchant)}</div>
                </div>
                <a
                  href={`https://amoy.polygonscan.com/tx/${payment.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:underline"
                >
                  View Transaction →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
