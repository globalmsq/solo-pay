import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, trustWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (typeof window !== 'undefined' && !projectId) {
  console.warn(
    '[Solo Pay] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Mobile wallet connections will not work. Get a free ID at https://cloud.walletconnect.com'
  );
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, trustWallet],
    },
  ],
  {
    appName: 'Solo Pay',
    projectId: projectId || 'PLACEHOLDER',
  }
);

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
  connectors,
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
