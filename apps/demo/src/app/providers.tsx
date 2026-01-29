'use client';

import * as React from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, type Config } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { getOrCreateWagmiConfig, fetchChainConfig } from '@/lib/wagmi';
import type { ChainConfig } from '@/app/api/config/route';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30초간 캐시 유지
      refetchOnWindowFocus: false, // 탭 전환 시 refetch 방지
    },
  },
});

/**
 * MetaMask 초기화 대기 (브라우저 시작 직후 연결 문제 방지)
 * @see https://github.com/MetaMask/metamask-extension/issues/13465
 */
async function waitForMetaMaskInit(timeout = 3000): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  const ethereum = (window as unknown as { ethereum?: { _state?: { initialized?: boolean } } })
    .ethereum;
  if (!ethereum) return true; // MetaMask 없으면 패스

  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (ethereum._state?.initialized) {
      console.log('[Providers] MetaMask initialized');
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.warn('[Providers] MetaMask init timeout, proceeding anyway');
  return false;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const [wagmiConfig, setWagmiConfig] = React.useState<Config | null>(null);
  const [chainConfig, setChainConfig] = React.useState<ChainConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  console.log('[Providers] Render:', { mounted, hasWagmiConfig: !!wagmiConfig, chainConfig });

  React.useEffect(() => {
    console.log('[Providers] useEffect triggered');

    const init = async () => {
      // MetaMask 초기화 대기 (연결 끊김 방지)
      await waitForMetaMaskInit();

      // 체인 설정을 API에서 가져와서 wagmi config 생성 (싱글톤)
      try {
        const config = await fetchChainConfig();
        console.log('[Providers] API returned config:', config);
        setChainConfig(config);
        const wConfig = getOrCreateWagmiConfig(config);
        setWagmiConfig(wConfig);
      } catch (err) {
        console.error('Failed to load chain config:', err);
        setError('Failed to load blockchain configuration');
      }

      setMounted(true);
    };

    init();
  }, []);

  // 로딩 상태
  if (!mounted || !wagmiConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error || 'Loading blockchain configuration...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChainConfigContext.Provider value={chainConfig}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={{
              lightMode: lightTheme(),
              darkMode: darkTheme(),
            }}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ChainConfigContext.Provider>
  );
}

// 현재 체인 설정을 가져오기 위한 Context
export const ChainConfigContext = React.createContext<ChainConfig | null>(null);

export function useChainConfig(): ChainConfig | null {
  return React.useContext(ChainConfigContext);
}
