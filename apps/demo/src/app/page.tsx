"use client";

import { useState, useRef, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { ProductCard } from "@/components/ProductCard";
import { PaymentHistory, PaymentHistoryRef } from "@/components/PaymentHistory";
import { Toast } from "@/components/Toast";
import { PAYMENT_HISTORY_REFRESH_DELAY } from "@/lib/constants";
import { PRODUCTS } from "@/lib/products";

export default function Home() {
  const { isConnected } = useAccount();

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // PaymentHistory ref for refresh
  const paymentHistoryRef = useRef<PaymentHistoryRef>(null);

  // Handle payment success
  const handlePaymentSuccess = useCallback((txHash: string) => {
    setToast({ message: "Payment successful!", type: "success" });
    // Refresh payment history after a short delay to allow blockchain to update
    setTimeout(() => {
      paymentHistoryRef.current?.refresh();
    }, PAYMENT_HISTORY_REFRESH_DELAY);
  }, []);

  return (
    <main className="min-h-screen p-8">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold text-primary-600">MSQ Pay Demo</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Blockchain Payment Gateway
          </p>
        </div>
        <ConnectButton />
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto">
        {/* Info banner */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h2 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            How it works
          </h2>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>
              • <strong>Direct Payment:</strong> You pay gas fees
            </li>
            <li>
              • <strong>Gasless Payment:</strong> Service covers gas - just sign!
            </li>
            <li>
              • <strong>Token:</strong> Payment token configured by merchant
            </li>
          </ul>
        </div>

        {/* Main content: Products and Payment History side by side on large screens */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Products grid */}
          <section className={`${isConnected ? 'lg:w-2/3' : 'w-full'}`}>
            <h2 className="text-2xl font-semibold mb-6">Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PRODUCTS.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  disabled={!isConnected}
                  onPaymentSuccess={handlePaymentSuccess}
                />
              ))}
            </div>
          </section>

          {/* Payment history */}
          {isConnected && (
            <section className="lg:w-1/3">
              <h2 className="text-2xl font-semibold mb-6">Your Payment History</h2>
              <PaymentHistory ref={paymentHistoryRef} />
            </section>
          )}
        </div>

        {/* Not connected message */}
        {!isConnected && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Connect your wallet to start making payments
            </p>
            <ConnectButton />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>MSQ Pay Demo</p>
      </footer>
    </main>
  );
}
