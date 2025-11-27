"use client";

import { useState } from "react";
import { useChainId } from "wagmi";
import { PaymentModal } from "./PaymentModal";
import { DEFAULT_TOKEN_SYMBOL } from "@/lib/wagmi";

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  image?: string;
}

interface ProductCardProps {
  product: Product;
  disabled?: boolean;
  onPaymentSuccess?: (txHash: string) => void;
}

export function ProductCard({ product, disabled, onPaymentSuccess }: ProductCardProps) {
  const [showPayment, setShowPayment] = useState(false);
  const chainId = useChainId();
  const tokenSymbol = DEFAULT_TOKEN_SYMBOL[chainId] || "TOKEN";

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        {/* Product image placeholder */}
        <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
          <span className="text-6xl">
            {product.id === "product-1" && "🎨"}
            {product.id === "product-2" && "⭐"}
            {product.id === "product-3" && "🎮"}
            {product.id === "product-4" && "🖼️"}
          </span>
        </div>

        {/* Product info */}
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            {product.description}
          </p>

          <div className="flex justify-between items-center">
            <div className="text-xl font-bold text-primary-600">
              {product.price} {tokenSymbol}
            </div>
            <button
              onClick={() => setShowPayment(true)}
              disabled={disabled}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          product={product}
          onClose={() => setShowPayment(false)}
          onSuccess={onPaymentSuccess}
        />
      )}
    </>
  );
}
