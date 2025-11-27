"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useAccount, usePublicClient, useChainId } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { getSubgraphUrl, getContractsForChain, getTokenForChain } from "@/lib/wagmi";

interface Payment {
  id: string;
  paymentId: string;
  payer: string;
  merchant: string;
  token: string;
  amount: string;
  timestamp: string;
  transactionHash: string;
}

// PaymentCompleted event ABI
const PAYMENT_COMPLETED_EVENT = parseAbiItem(
  "event PaymentCompleted(bytes32 indexed paymentId, address indexed payer, address indexed merchant, address token, uint256 amount, uint256 timestamp)"
);

// Ref type for parent component
export interface PaymentHistoryRef {
  refresh: () => Promise<void>;
}

export const PaymentHistory = forwardRef<PaymentHistoryRef>(function PaymentHistory(_, ref) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contracts = getContractsForChain(chainId);
  const token = getTokenForChain(chainId);
  const subgraphUrl = getSubgraphUrl(chainId);

  // Fetch payments from blockchain events (fallback when no subgraph)
  const fetchFromBlockchain = async () => {
    if (!address || !publicClient || !contracts) return;

    try {
      // Only scan recent 100 blocks for performance
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 100n ? currentBlock - 100n : 0n;

      const logs = await publicClient.getLogs({
        address: contracts.gateway,
        event: PAYMENT_COMPLETED_EVENT,
        args: {
          payer: address,
        },
        fromBlock,
        toBlock: "latest",
      });

      const paymentsList: Payment[] = await Promise.all(
        logs.map(async (log) => {
          const block = await publicClient.getBlock({ blockHash: log.blockHash! });
          return {
            id: `${log.transactionHash}-${log.logIndex}`,
            paymentId: log.args.paymentId || "",
            payer: log.args.payer || "",
            merchant: log.args.merchant || "",
            token: log.args.token || "",
            amount: (log.args.amount || 0n).toString(),
            timestamp: block.timestamp.toString(),
            transactionHash: log.transactionHash,
          };
        })
      );

      // Sort by timestamp descending
      paymentsList.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      setPayments(paymentsList);
    } catch (err: any) {
      console.error("Error fetching from blockchain:", err);
      throw err;
    }
  };

  // Fetch payments from Subgraph (for testnets/mainnet)
  const fetchFromSubgraph = async () => {
    const subgraphUrl = getSubgraphUrl(chainId);
    if (!address || !subgraphUrl) {
      throw new Error("Subgraph not configured for this chain");
    }

    const query = `
      query GetUserPayments($payer: Bytes!) {
        payments(
          where: { payer: $payer }
          orderBy: timestamp
          orderDirection: desc
          first: 20
        ) {
          id
          paymentId
          payer
          merchant
          token
          amount
          timestamp
          transactionHash
        }
      }
    `;

    const response = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { payer: address.toLowerCase() },
      }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message || "Subgraph query failed");
    }
    setPayments(result.data?.payments || []);
  };

  const fetchPayments = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      if (subgraphUrl) {
        await fetchFromSubgraph();
      } else {
        await fetchFromBlockchain();
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchPayments,
  }));

  // Auto-fetch on mount and when address changes
  useEffect(() => {
    if (address) {
      fetchPayments();
    }
  }, [address, chainId]);

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const truncatePaymentId = (id: string) => {
    return `${id.slice(0, 10)}...${id.slice(-8)}`;
  };

  const getExplorerUrl = (txHash: string) => {
    if (chainId === 31337) {
      return null; // No explorer for localhost
    }
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Recent Payments</h3>
          <p className="text-xs text-gray-500">
            {subgraphUrl ? "From Subgraph" : "Recent 100 blocks"}
          </p>
        </div>
        <button
          onClick={fetchPayments}
          disabled={loading}
          className="px-3 py-1 text-sm bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-lg hover:bg-primary-200 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="p-4">
        {error && (
          <div className="text-center text-red-500 py-4 text-sm">{error}</div>
        )}

        {payments.length === 0 && !loading && !error && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No payments found yet.
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
                      {formatUnits(BigInt(payment.amount), 18)} {token?.symbol || "TOKEN"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(payment.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>To: {truncateAddress(payment.merchant)}</div>
                  <div className="text-xs">
                    Payment ID: {truncatePaymentId(payment.paymentId)}
                  </div>
                </div>
                {getExplorerUrl(payment.transactionHash) ? (
                  <a
                    href={getExplorerUrl(payment.transactionHash)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline"
                  >
                    View Transaction →
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">
                    Tx: {truncateAddress(payment.transactionHash)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
