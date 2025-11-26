import { keccak256, encodePacked, toHex, type Address, type Hex } from "viem";
import type { ForwardRequest, MetaTxSignRequest } from "./types";
import { DEFAULT_META_TX_GAS, DEFAULT_META_TX_DEADLINE_SECONDS } from "./constants";

/**
 * EIP-712 type definitions for ForwardRequest
 */
export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

/**
 * Create EIP-712 domain for the forwarder
 */
export function createForwarderDomain(
  chainId: number,
  forwarderAddress: Address
) {
  return {
    name: "ERC2771Forwarder",
    version: "1",
    chainId,
    verifyingContract: forwarderAddress,
  };
}

/**
 * Create a forward request for meta-transaction
 */
export function createForwardRequest(params: {
  from: Address;
  to: Address;
  data: Hex;
  nonce: bigint;
  gas?: bigint;
  deadline?: bigint;
  value?: bigint;
}): ForwardRequest {
  const now = Math.floor(Date.now() / 1000);

  return {
    from: params.from,
    to: params.to,
    value: params.value ?? 0n,
    gas: params.gas ?? DEFAULT_META_TX_GAS,
    nonce: params.nonce,
    deadline: params.deadline ?? BigInt(now + DEFAULT_META_TX_DEADLINE_SECONDS),
    data: params.data,
  };
}

/**
 * Create a complete EIP-712 sign request for meta-transaction
 */
export function createMetaTxSignRequest(
  chainId: number,
  forwarderAddress: Address,
  request: ForwardRequest
): MetaTxSignRequest {
  return {
    domain: createForwarderDomain(chainId, forwarderAddress),
    types: FORWARD_REQUEST_TYPES,
    primaryType: "ForwardRequest",
    message: request,
  };
}

/**
 * Convert a payment ID string to bytes32
 * Uses keccak256 hash of the string
 */
export function paymentIdToBytes32(paymentId: string): Hex {
  return keccak256(encodePacked(["string"], [paymentId]));
}

/**
 * Check if a deadline has expired
 */
export function isDeadlineExpired(deadline: bigint): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return deadline <= now;
}

/**
 * Get remaining time until deadline (in seconds)
 * Returns 0 if already expired
 */
export function getDeadlineRemainingSeconds(deadline: bigint): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) return 0;
  return Number(deadline - now);
}
