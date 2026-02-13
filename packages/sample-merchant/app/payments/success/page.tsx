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
      <header className="w-full border-b border-border px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-text-primary text-lg font-semibold tracking-[0.2em] uppercase"
          >
            Solo Roasters
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
          </div>

          <h1 className="text-text-primary text-xl font-semibold text-center mb-2">
            Payment Complete
          </h1>
          <p className="text-text-muted text-sm text-center mb-8">
            Your order has been successfully processed.
          </p>

          {/* Receipt Card */}
          <div className="rounded-2xl border border-border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">Order</span>
              <span className="text-text-primary text-sm font-medium">#{payment.id}</span>
            </div>

            {product && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">Product</span>
                <span className="text-text-primary text-sm font-medium">{product.name}</span>
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
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
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
                <span className="text-text-muted text-xs block mb-1">Transaction Hash</span>
                <span className="text-text-primary text-xs font-mono break-all">
                  {payment.tx_hash}
                </span>
              </div>
            )}
          </div>

          {/* Back Button */}
          <Link
            href="/"
            className="block mt-6 w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold text-center transition-colors"
          >
            Back to Store
          </Link>
        </div>
      </main>
    </div>
  );
}
