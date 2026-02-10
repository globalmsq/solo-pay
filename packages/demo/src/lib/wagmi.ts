import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { fallback, http, type Config } from 'wagmi';
import { polygon, polygonAmoy, hardhat, type Chain } from 'wagmi/chains';
import type { ChainConfig } from '@/app/api/config/route';

// WalletConnect Project ID - Get one at https://cloud.walletconnect.com/
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Polygon Amoy 백업 RPC 목록 (공용 RPC 불안정 대비)
const AMOY_BACKUP_RPCS = [
  'https://polygon-amoy.drpc.org',
  'https://polygon-amoy-bor-rpc.publicnode.com',
];

const POLYGON_BACKUP_RPCS = [
  'https://polygon.drpc.org',
  'https://polygon-bor-rpc.publicnode.com',
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
  const CHAIN_MAP: Record<number, Chain> = {
    137: polygon,
    80002: polygonAmoy,
    31337: hardhat,
  };
  const chain: Chain = CHAIN_MAP[chainConfig.chainId] || hardhat;

  // 커스텀 RPC URL로 체인 오버라이드 (default와 public 모두 설정)
  const customChain: Chain = {
    ...chain,
    name: chainConfig.chainName,
    rpcUrls: {
      default: { http: [chainConfig.rpcUrl] },
      public: { http: [chainConfig.rpcUrl] },
    },
  };

  // 체인별 백업 RPC 매핑
  const BACKUP_RPCS: Record<number, string[]> = {
    137: POLYGON_BACKUP_RPCS,
    80002: AMOY_BACKUP_RPCS,
  };
  const backupRpcs = BACKUP_RPCS[chainConfig.chainId] || [];
  const httpTransports = [
    http(chainConfig.rpcUrl),
    ...backupRpcs.map((url) => http(url)),
  ];

  return getDefaultConfig({
    appName: 'Solo Pay Demo',
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
  // [polygonAmoy.id]: "https://api.studio.thegraph.com/query/.../solo-pay-amoy/v0.0.1",
  // [137]: "https://api.studio.thegraph.com/query/.../solo-pay-polygon/v0.0.1",
};

// Helper to get subgraph URL for a chain
export function getSubgraphUrl(chainId: number): string | undefined {
  return SUBGRAPH_URLS[chainId];
}
