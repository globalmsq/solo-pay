import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';

const PcWidget: NextPage = () => {
  return (
    <>
      <Head>
        <title>Solo Pay</title>
        <meta content="Solo Pay Payment Widget" name="description" />
      </Head>

      <div className="flex items-center justify-center min-h-screen p-4 bg-transparent">
        <div className="w-full max-w-[400px] rounded-2xl shadow-xl border border-gray-200 bg-white p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-gray-900">Solo Pay</h1>
          </div>

          {/* TODO: Fetch payment details from server using token */}

          {/* Wallet connection */}
          <div className="flex justify-center">
            <ConnectButton />
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6 text-gray-400">
            Powered by Solo Pay
          </p>
        </div>
      </div>
    </>
  );
};

export default PcWidget;
