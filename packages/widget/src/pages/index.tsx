import type { NextPage } from 'next';
import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { PaymentInfo } from '../types';
import PaymentStep from '../components/payment/PaymentStep';

const Home: NextPage = () => {
  const searchParams = useSearchParams();

  // Parse payment info from URL params => NOT FIXED (will be changed)
  const paymentInfo = useMemo<PaymentInfo | undefined>(() => {
    const product = searchParams.get('product');
    const amount = searchParams.get('amount');
    const token = searchParams.get('token');
    const network = searchParams.get('network');

    // Return undefined if required params missing (will use defaults)
    if (!product || !amount || !token || !network) {
      return undefined;
    }

    return {
      product,
      amount,
      token,
      network,
    };
  }, [searchParams]);

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

          {/* Payment Flow */}
          <PaymentStep initialPaymentInfo={paymentInfo} />

          {/* Footer */}
          <p className="text-center text-xs mt-4 sm:mt-6 text-gray-400">Powered by Solo Pay</p>
        </div>
      </main>
    </>
  );
};

export default Home;
