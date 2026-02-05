import type { NextPage } from 'next';
import Head from 'next/head';
import { ConnectButton } from '../components/ConnectButton';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Solo Pay</title>
        <meta content="Solo Pay - Mobile Payment" name="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Solo Pay</h1>
          <p className="mt-2 text-sm text-gray-500">Connect your wallet to continue</p>
        </div>

        {/* TODO: Fetch payment details from server using token */}

        <ConnectButton className="w-full max-w-sm" />

        <p className="mt-12 text-xs text-gray-400">Powered by Solo Pay</p>
      </main>
    </>
  );
};

export default Home;
