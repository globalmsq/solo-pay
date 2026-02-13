'use client';

import { useState } from 'react';
import Image from 'next/image';
import PaymentModal from './PaymentModal';

interface Product {
  id: number;
  name: string;
  roast: string;
  weight: string;
  price: number;
  description: string;
  image_url: string | null;
}

const roastBgMap: Record<string, string> = {
  'Light Roast': 'bg-roast-light',
  'Light-Medium Roast': 'bg-roast-light-medium',
  'Medium Roast': 'bg-roast-medium',
  'Medium-Dark Roast': 'bg-roast-medium-dark',
  'Dark Roast': 'bg-roast-dark',
};

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);

  const handleClickPayNow = async () => {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product.id,
        price: product.price,
      }),
    });

    const data = await response.json();

    setPaymentId(data.paymentId);
    setTokenAddress(data.tokenAddress);
    setIsWidgetOpen(true);
  };

  const roastBg = roastBgMap[product.roast] || 'bg-roast-medium';

  return (
    <>
      <div
        className="animate-fade-in-up rounded-2xl bg-surface-card overflow-hidden shadow-card hover:-translate-y-1.5 hover:shadow-card-hover transition-all duration-400 cursor-pointer flex flex-col"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {/* Illustration Zone */}
        <div className={`aspect-4/3 w-full ${roastBg} flex items-center justify-center p-6`}>
          {product.image_url && (
            <div className="relative w-full h-full">
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-contain transition-transform duration-500 hover:-translate-y-1"
              />
            </div>
          )}
        </div>

        {/* Content Zone */}
        <div className="p-6 flex-1 flex flex-col">
          {/* Roast Badge */}
          <span className="inline-block self-start px-3 py-1 rounded-full text-[11px] font-medium tracking-widest uppercase text-accent-gold bg-roast-light mb-3">
            {product.roast}
          </span>

          {/* Product Name */}
          <h2 className="font-playfair text-xl font-semibold text-text-primary mb-2">
            {product.name}
          </h2>

          {/* Description */}
          <p className="text-text-secondary text-sm leading-relaxed mb-5 flex-1">
            {product.description}
          </p>

          {/* Price + Button Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-text-primary text-lg font-semibold">${product.price}</span>
              <span className="text-text-muted text-xs">{product.weight}</span>
            </div>
            <button
              type="button"
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              onClick={handleClickPayNow}
            >
              Order
            </button>
          </div>
        </div>
      </div>

      {isWidgetOpen && paymentId && tokenAddress && (
        <PaymentModal
          product={product}
          paymentId={paymentId}
          tokenAddress={tokenAddress}
          onClose={() => setIsWidgetOpen(false)}
        />
      )}
    </>
  );
}
