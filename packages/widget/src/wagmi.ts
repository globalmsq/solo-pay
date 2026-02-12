import { http, fallback, createConfig } from 'wagmi';
import { injected, metaMask } from 'wagmi/connectors';
import { arbitrum, base, mainnet, optimism, polygon, polygonAmoy, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
  testnet: true,
});

const chains = [
  mainnet,
  polygon,
  polygonAmoy,
  optimism,
  arbitrum,
  base,
  sepolia,
  hardhat,
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
    // Polygon Amoy - use fallback RPCs for reliability
    [polygonAmoy.id]: fallback([
      http('https://polygon-amoy.drpc.org'),
      http('https://polygon-amoy-bor-rpc.publicnode.com'),
      http('https://rpc-amoy.polygon.technology'),
    ]),
    [optimism.id]: http('https://optimism-rpc.publicnode.com'),
    [arbitrum.id]: http('https://arbitrum-one-rpc.publicnode.com'),
    [base.id]: http('https://base-rpc.publicnode.com'),
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
});
