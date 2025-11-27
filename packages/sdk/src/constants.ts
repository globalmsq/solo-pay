import type { Address } from "viem";
import type { MSQPayConfig, TokenConfig } from "./types";

/**
 * Polygon Amoy Testnet chain configuration
 */
export const POLYGON_AMOY = {
  chainId: 80002,
  name: "Polygon Amoy Testnet",
  rpcUrl: "https://rpc-amoy.polygon.technology",
  blockExplorer: "https://amoy.polygonscan.com",
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
  },
} as const;

/**
 * Localhost (Hardhat) chain configuration (internal use only)
 */
const LOCALHOST = {
  chainId: 31337,
  name: "Localhost",
  rpcUrl: "http://127.0.0.1:8545",
  blockExplorer: "",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
} as const;

/**
 * Token addresses
 */
export const TOKENS: Record<string, Record<string, TokenConfig>> = {
  [POLYGON_AMOY.chainId]: {
    SUT: {
      address: "0xE4C687167705Abf55d709395f92e254bdF5825a2" as Address,
      symbol: "SUT",
      decimals: 18,
    },
  },
  // Localhost - MockERC20 deployed via ignition
  [LOCALHOST.chainId]: {
    TEST: {
      address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address,
      symbol: "TEST",
      decimals: 18,
    },
  },
};

/**
 * Contract addresses (will be populated after deployment)
 */
export const CONTRACTS: Record<
  number,
  {
    gateway: Address;
    forwarder: Address;
  }
> = {
  // Polygon Amoy - TBD after deployment
  [POLYGON_AMOY.chainId]: {
    gateway: "0x0000000000000000000000000000000000000000" as Address,
    forwarder: "0x0000000000000000000000000000000000000000" as Address,
  },
  // Localhost (Hardhat) - deployed via ignition
  [LOCALHOST.chainId]: {
    gateway: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address,
    forwarder: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address,
  },
};

/**
 * Subgraph URLs
 */
export const SUBGRAPH_URLS: Record<number, string> = {
  // Polygon Amoy - TBD after deployment
  [POLYGON_AMOY.chainId]: "",
};

/**
 * Default gas limit for meta-transactions
 */
export const DEFAULT_META_TX_GAS = 500_000n;

/**
 * Default deadline for meta-transactions (1 hour from now)
 */
export const DEFAULT_META_TX_DEADLINE_SECONDS = 3600;

/**
 * Get pre-configured config for a chain
 */
export function getChainConfig(chainId: number): Partial<MSQPayConfig> {
  const contracts = CONTRACTS[chainId];
  const subgraphUrl = SUBGRAPH_URLS[chainId];

  if (!contracts) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  return {
    chainId,
    gatewayAddress: contracts.gateway,
    forwarderAddress: contracts.forwarder,
    subgraphUrl: subgraphUrl || undefined,
  };
}

/**
 * Get token config for a chain
 */
export function getTokenConfig(
  chainId: number,
  symbol: string
): TokenConfig | undefined {
  return TOKENS[chainId]?.[symbol];
}

/**
 * PaymentGateway ABI (minimal for SDK usage)
 */
export const PAYMENT_GATEWAY_ABI = [
  {
    type: "function",
    name: "pay",
    inputs: [
      { name: "paymentId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "merchant", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "processedPayments",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPaymentProcessed",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supportedTokens",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTrustedForwarder",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PaymentCompleted",
    inputs: [
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * ERC2771Forwarder ABI (minimal for SDK usage)
 */
export const FORWARDER_ABI = [
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verify",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "execute",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

/**
 * ERC20 ABI (minimal for SDK usage)
 */
export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;
