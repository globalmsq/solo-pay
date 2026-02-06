import { http, createConfig } from 'wagmi';
import { injected, metaMask } from 'wagmi/connectors';
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from 'wagmi/chains';

const enableTestnets = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

const chains = [
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  ...(enableTestnets ? ([sepolia] as const) : []),
] as const;

export const config = createConfig({
  connectors: [
    // Injected connector for wallet browsers (Trust Wallet, MetaMask mobile, etc.)
    injected(),
    // MetaMask SDK for desktop extension + mobile deeplink
    metaMask(),
  ],
  chains,
  transports: {
    // Use publicnode RPCs - they have proper CORS headers
    [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
    [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
    [optimism.id]: http('https://optimism-rpc.publicnode.com'),
    [arbitrum.id]: http('https://arbitrum-one-rpc.publicnode.com'),
    [base.id]: http('https://base-rpc.publicnode.com'),
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
  ssr: true,
});
