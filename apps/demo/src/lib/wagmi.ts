import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { fallback, http, type Config } from 'wagmi';
import { polygonAmoy, hardhat, type Chain } from 'wagmi/chains';
import type { ChainConfig } from '@/app/api/config/route';

// WalletConnect Project ID - Get one at https://cloud.walletconnect.com/
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Polygon Amoy 백업 RPC 목록 (공용 RPC 불안정 대비)
const AMOY_BACKUP_RPCS = [
  'https://polygon-amoy.drpc.org',
  'https://polygon-amoy-bor-rpc.publicnode.com',
];

// Singleton cache for wagmi config (prevents disconnect on re-render/StrictMode)
let cachedWagmiConfig: Config | null = null;
let cachedChainId: number | null = null;

/**
 * 체인 설정에 따라 wagmi config 생성 (싱글톤)
 * /api/config에서 받은 설정으로 단일 체인 구성
 * 같은 chainId면 캐시된 config 반환, 다르면 새로 생성
 */
export function getOrCreateWagmiConfig(chainConfig: ChainConfig): Config {
  // 같은 chainId면 캐시된 config 반환 (리렌더/StrictMode 대응)
  if (cachedWagmiConfig && cachedChainId === chainConfig.chainId) {
    return cachedWagmiConfig;
  }

  // chainId가 바뀌면 새로 생성
  cachedChainId = chainConfig.chainId;
  cachedWagmiConfig = createWagmiConfig(chainConfig);
  return cachedWagmiConfig;
}

/**
 * 내부 함수: wagmi config 생성
 */
function createWagmiConfig(chainConfig: ChainConfig): Config {
  // 체인 ID에 따라 체인 객체 선택
  const chain: Chain = chainConfig.chainId === 80002 ? polygonAmoy : hardhat;

  // 커스텀 RPC URL로 체인 오버라이드 (default와 public 모두 설정)
  const customChain: Chain = {
    ...chain,
    name: chainConfig.chainName,
    rpcUrls: {
      default: { http: [chainConfig.rpcUrl] },
      public: { http: [chainConfig.rpcUrl] },
    },
  };

  // Amoy인 경우 백업 RPC 추가, 그 외는 단일 RPC
  const httpTransports =
    chainConfig.chainId === 80002
      ? [http(chainConfig.rpcUrl), ...AMOY_BACKUP_RPCS.map((url) => http(url))]
      : [http(chainConfig.rpcUrl)];

  return getDefaultConfig({
    appName: 'MSQ Pay Demo',
    projectId,
    chains: [customChain],
    ssr: true,
    transports: {
      [customChain.id]: fallback(httpTransports),
    },
  });
}

/**
 * 체인 설정 fetch
 */
export async function fetchChainConfig(): Promise<ChainConfig> {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Failed to fetch chain config');
  }
  return response.json();
}

// Subgraph URLs per chain (update after deployment)
export const SUBGRAPH_URLS: Record<number, string> = {
  // [polygonAmoy.id]: "https://api.studio.thegraph.com/query/.../msq-pay-amoy/v0.0.1",
  // [137]: "https://api.studio.thegraph.com/query/.../msq-pay-polygon/v0.0.1",
};

// Helper to get subgraph URL for a chain
export function getSubgraphUrl(chainId: number): string | undefined {
  return SUBGRAPH_URLS[chainId];
}
