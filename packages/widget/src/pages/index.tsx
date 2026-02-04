import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Solo Pay</title>
        <meta content="Solo Pay - Mobile Payment" name="description" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Solo Pay</h1>
          <p className="mt-2 text-sm text-gray-500">
            Connect your wallet to continue
          </p>
        </div>

        {/* TODO: Fetch payment details from server using token */}

        <div className="w-full max-w-sm">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const connected = mounted && account && chain;

              return (
                <div
                  {...(!mounted && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none' as const,
                      userSelect: 'none' as const,
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700 transition-colors"
                        >
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-semibold text-white"
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm"
                        >
                          {chain.name}
                        </button>
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>

        <p className="mt-12 text-xs text-gray-400">Powered by Solo Pay</p>
      </main>
    </>
  );
};

export default Home;
