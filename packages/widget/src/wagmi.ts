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
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
