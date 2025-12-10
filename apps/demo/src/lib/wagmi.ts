import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, unstable_connector, http } from "wagmi";
import { polygonAmoy, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// WalletConnect Project ID - Get one at https://cloud.walletconnect.com/
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

// All supported chains included at build time
// Runtime chain selection is handled by serverConfig.chainId from checkout API
// This ensures wagmi can query any chain regardless of NEXT_PUBLIC_CHAIN_ID build-time value
export const config = getDefaultConfig({
  appName: "MSQ Pay Demo",
  projectId,
  chains: [polygonAmoy, hardhat],
  ssr: true,
  transports: {
    // Fallback transport: try MetaMask first, then direct RPC
    // This ensures balance queries work even if MetaMask provider fails
    [polygonAmoy.id]: fallback([
      unstable_connector(injected),
      http(),
    ]),
    [hardhat.id]: fallback([
      unstable_connector(injected),
      http("http://localhost:8545"),
    ]),
  },
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

