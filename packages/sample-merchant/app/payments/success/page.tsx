import { prisma } from '@/app/lib/prisma';
import { products } from '@/app/data/products';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  const { paymentId } = await searchParams;

  if (!paymentId) return notFound();

  const payment = await prisma.payment.findUnique({
    where: { id: Number(paymentId) },
  });

  if (!payment) return notFound();

  // Match product from mock data by product_id
  const product = products.find((p) => p.id === payment.product_id);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-5 md:px-12">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="font-playfair text-text-primary text-lg font-semibold tracking-[0.15em] uppercase"
          >
            Solo Roasters
          </Link>
        </div>
        <div className="max-w-5xl mx-auto mt-3 h-px bg-accent-gold/30" />
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Animated Success Icon */}
          <div className="flex justify-center mb-8 animate-fade-in">
            <div className="w-18 h-18 rounded-full bg-success-light flex items-center justify-center">
              <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#4A7C59"
                  strokeWidth="2"
                  strokeDasharray="126"
                  strokeDashoffset="126"
                  style={{ animation: 'drawCircle 0.5s ease forwards' }}
                />
                <path
                  d="M15 24l6 6 12-12"
                  stroke="#4A7C59"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="30"
                  strokeDashoffset="30"
                  style={{ animation: 'drawCheck 0.3s ease 0.5s forwards' }}
                />
              </svg>
            </div>
          </div>

          <h1
            className="font-playfair text-text-primary text-2xl font-semibold text-center mb-2 animate-fade-in"
            style={{ animationDelay: '0.6s' }}
          >
            Payment Successful
          </h1>
          <p
            className="text-text-secondary text-sm text-center mb-10 animate-fade-in"
            style={{ animationDelay: '0.7s' }}
          >
            Thank you for your order. Your beans will be roasted fresh.
          </p>

          {/* Receipt Card */}
          <div
            className="rounded-2xl bg-surface-card shadow-card overflow-hidden animate-fade-in-up"
            style={{ animationDelay: '0.8s' }}
          >
            {/* Receipt Header */}
            <div className="px-6 py-4 border-b border-border">
              <span className="text-accent-gold text-[11px] font-medium tracking-[0.15em] uppercase">
                Order Receipt
              </span>
            </div>

            {/* Receipt Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">Order</span>
                <span className="text-text-primary text-sm font-medium">#{payment.id}</span>
              </div>

              {product && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">Product</span>
                  <span className="font-playfair text-text-primary text-sm font-medium">
                    {product.name}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">Amount</span>
                <span className="text-text-primary text-sm font-semibold">
                  {payment.amount.toString()} {payment.token_symbol}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">Status</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-success-light text-success">
                  {payment.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">Date</span>
                <span className="text-text-primary text-sm">
                  {payment.created_at.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {payment.tx_hash && (
                <div className="border-t border-border pt-4">
                  <span className="text-text-muted text-xs block mb-1.5">Transaction Hash</span>
                  <span className="text-text-primary text-xs font-mono break-all bg-surface rounded-lg px-3 py-2 block">
                    {payment.tx_hash}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Back Button */}
          <Link
            href="/"
            className="animate-fade-in-up block mt-6 w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium text-center transition-all duration-200 hover:-translate-y-0.5"
            style={{ animationDelay: '1s' }}
          >
            Back to Store
          </Link>
        </div>
      </main>
    </div>
  );
}
