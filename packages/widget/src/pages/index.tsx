import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { validateWidgetUrlParams } from '../lib/validation';
import type { UrlParamsValidationResult } from '../types';
import PaymentStep from '../components/payment/PaymentStep';

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  );
}

/**
 * Payment content component
 */
function PaymentContent() {
  const router = useRouter();
  const [validationResult, setValidationResult] = useState<UrlParamsValidationResult | null>(null);

  // Validate URL parameters after mount (client-side only) to avoid hydration mismatch
  useEffect(() => {
    if (!router.isReady) return;

    const searchParams = {
      get: (key: string) => {
        const value = router.query[key];
        return typeof value === 'string' ? value : null;
      },
    };
    setValidationResult(validateWidgetUrlParams(searchParams));
  }, [router.isReady, router.query]);

  // Still loading - show spinner (same on server and client during hydration)
  if (validationResult === null) {
    return <LoadingSpinner />;
  }

  if (!validationResult.isValid) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <svg
            className="w-12 h-12 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="font-medium">Invalid Parameters</p>
        </div>
        <ul className="text-sm text-gray-600 space-y-1">
          {validationResult.errors?.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <PaymentStep urlParams={validationResult.params} />;
}

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Solo Pay</title>
        <meta content="Solo Pay - Mobile Payment" name="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className="flex items-center justify-center min-h-screen p-2 sm:p-4 bg-transparent">
        <div className="w-full max-w-lg rounded-none sm:rounded-2xl shadow-none sm:shadow-xl border-0 sm:border border-gray-200 bg-white p-4 sm:p-6">
          {/* Header */}
          <div className="pb-4 mb-4 border-b border-gray-200">
            <h1 className="text-base sm:text-lg font-bold text-gray-900">Solo Pay</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Secure Blockchain Payment</p>
          </div>

          {/* Payment content */}
          <PaymentContent />

          {/* Footer */}
          <p className="text-center text-xs mt-4 sm:mt-6 text-gray-400">Powered by Solo Pay</p>
        </div>
      </main>
    </>
  );
};

export default Home;
