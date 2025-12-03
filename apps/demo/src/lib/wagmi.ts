import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy, hardhat } from "wagmi/chains";

// WalletConnect Project ID - Get one at https://cloud.walletconnect.com/
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

export const config = getDefaultConfig({
  appName: "MSQ Pay Demo",
  projectId,
  chains: [polygonAmoy, hardhat],
  ssr: true,
});

// Subgraph URLs per chain (update after deployment)
// Localhost uses direct blockchain query, other chains use subgraph
export const SUBGRAPH_URLS: Record<number, string> = {
  // [polygonAmoy.id]: "https://api.studio.thegraph.com/query/.../msq-pay-amoy/v0.0.1",
  // [137]: "https://api.studio.thegraph.com/query/.../msq-pay-polygon/v0.0.1", // Polygon Mainnet
  // Future: ETH (1), BSC (56) can be added here
};

// Helper to get subgraph URL for a chain
export function getSubgraphUrl(chainId: number): string | undefined {
  return SUBGRAPH_URLS[chainId];
}

