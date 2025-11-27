import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
  type Hash,
} from "viem";
import type {
  MSQPayConfig,
  PaymentParams,
  PaymentTxData,
  MetaTxSignRequest,
  SignedForwardRequest,
  Payment,
  PaymentCallback,
  Unsubscribe,
  ForwardRequest,
} from "./types";
import { PaymentError, PaymentErrorCode } from "./types";
import {
  PAYMENT_GATEWAY_ABI,
  FORWARDER_ABI,
  ERC20_ABI,
} from "./constants";
import {
  paymentIdToBytes32,
  createForwardRequest,
  createMetaTxSignRequest,
  isDeadlineExpired,
} from "./eip712";

/**
 * MSQ Pay SDK Client
 *
 * Main entry point for interacting with the MSQ Pay payment gateway.
 * Supports both direct payments (user pays gas) and meta-transactions (gasless).
 *
 * @example
 * ```typescript
 * import { MSQPayClient } from '@msq/pay-sdk';
 *
 * const client = new MSQPayClient({
 *   chainId: 80002,
 *   rpcUrl: 'https://rpc-amoy.polygon.technology',
 *   gatewayAddress: '0x...',
 *   forwarderAddress: '0x...',
 * });
 *
 * // Direct payment
 * const txData = client.getPaymentTxData({
 *   paymentId: 'ORDER_123',
 *   token: '0x...',
 *   amount: 1000000000000000000n,
 *   merchant: '0x...',
 * });
 *
 * // Meta-transaction
 * const signRequest = await client.getMetaTxSignRequest(params, userAddress);
 * // User signs... then submit
 * const txHash = await client.submitMetaTx(signedRequest);
 * ```
 */
export class MSQPayClient {
  private readonly config: MSQPayConfig;
  private readonly publicClient: PublicClient;

  constructor(config: MSQPayConfig) {
    this.config = config;
    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  // ============ Direct Payment ============

  /**
   * Get transaction data for direct payment
   * User will sign and submit this transaction themselves (paying gas)
   *
   * @param params Payment parameters
   * @returns Transaction data to be signed by the user
   */
  getPaymentTxData(params: PaymentParams): PaymentTxData {
    this.validatePaymentParams(params);

    const paymentIdBytes32 = paymentIdToBytes32(params.paymentId);

    const data = encodeFunctionData({
      abi: PAYMENT_GATEWAY_ABI,
      functionName: "pay",
      args: [paymentIdBytes32, params.token, params.amount, params.merchant],
    });

    return {
      to: this.config.gatewayAddress,
      data,
      value: 0n,
    };
  }

  // ============ Meta Transaction ============

  /**
   * Get EIP-712 signature request for meta-transaction
   * User signs this data, then the service submits it on their behalf
   *
   * @param params Payment parameters
   * @param payer Address of the user who will sign
   * @returns EIP-712 typed data for signing
   */
  async getMetaTxSignRequest(
    params: PaymentParams,
    payer: Address
  ): Promise<MetaTxSignRequest> {
    this.validatePaymentParams(params);

    const paymentIdBytes32 = paymentIdToBytes32(params.paymentId);

    // Get current nonce for the payer
    const nonce = await this.getForwarderNonce(payer);

    // Encode the pay function call
    const data = encodeFunctionData({
      abi: PAYMENT_GATEWAY_ABI,
      functionName: "pay",
      args: [paymentIdBytes32, params.token, params.amount, params.merchant],
    });

    // Create the forward request
    const request = createForwardRequest({
      from: payer,
      to: this.config.gatewayAddress,
      data,
      nonce,
    });

    // Create the EIP-712 sign request
    return createMetaTxSignRequest(
      this.config.chainId,
      this.config.forwarderAddress,
      request
    );
  }

  /**
   * Submit a signed meta-transaction to the relay
   *
   * @param signedRequest The signed forward request
   * @returns Transaction hash
   */
  async submitMetaTx(signedRequest: SignedForwardRequest): Promise<Hash> {
    if (!this.config.defenderRelayUrl) {
      throw new PaymentError(
        PaymentErrorCode.RELAY_ERROR,
        "Defender relay URL not configured"
      );
    }

    // Check deadline
    if (isDeadlineExpired(signedRequest.request.deadline)) {
      throw new PaymentError(
        PaymentErrorCode.SIGNATURE_EXPIRED,
        "Meta-transaction signature has expired"
      );
    }

    try {
      const response = await fetch(this.config.defenderRelayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request: {
            from: signedRequest.request.from,
            to: signedRequest.request.to,
            value: signedRequest.request.value.toString(),
            gas: signedRequest.request.gas.toString(),
            nonce: signedRequest.request.nonce.toString(),
            deadline: signedRequest.request.deadline.toString(),
            data: signedRequest.request.data,
          },
          signature: signedRequest.signature,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new PaymentError(
          PaymentErrorCode.RELAY_ERROR,
          `Relay submission failed: ${error}`
        );
      }

      const result = await response.json();
      return result.txHash as Hash;
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw new PaymentError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to submit meta-transaction",
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============ Queries ============

  /**
   * Check if a payment has been processed
   *
   * @param paymentId The payment ID to check
   * @returns True if the payment has been processed
   */
  async isPaymentProcessed(paymentId: string): Promise<boolean> {
    const paymentIdBytes32 = paymentIdToBytes32(paymentId);

    const result = await this.publicClient.readContract({
      address: this.config.gatewayAddress,
      abi: PAYMENT_GATEWAY_ABI,
      functionName: "isPaymentProcessed",
      args: [paymentIdBytes32],
    });

    return result as boolean;
  }

  /**
   * Get payment details from subgraph
   *
   * @param paymentId The payment ID
   * @returns Payment details or null if not found
   */
  async getPayment(paymentId: string): Promise<Payment | null> {
    if (!this.config.subgraphUrl) {
      throw new PaymentError(
        PaymentErrorCode.NETWORK_ERROR,
        "Subgraph URL not configured"
      );
    }

    const paymentIdBytes32 = paymentIdToBytes32(paymentId);

    const query = `
      query GetPayment($id: ID!) {
        payment(id: $id) {
          id
          payer
          merchant
          token
          amount
          timestamp
          transactionHash
          blockNumber
          gasMode
        }
      }
    `;

    const result = await this.querySubgraph<{
      payment: Payment | null;
    }>(query, { id: paymentIdBytes32 });

    return result.payment;
  }

  /**
   * Get payments for a merchant
   *
   * @param merchant Merchant address
   * @param options Query options
   * @returns Array of payments
   */
  async getPaymentsByMerchant(
    merchant: Address,
    options: { first?: number; skip?: number } = {}
  ): Promise<Payment[]> {
    if (!this.config.subgraphUrl) {
      throw new PaymentError(
        PaymentErrorCode.NETWORK_ERROR,
        "Subgraph URL not configured"
      );
    }

    const query = `
      query GetMerchantPayments($merchant: Bytes!, $first: Int, $skip: Int) {
        payments(
          where: { merchant: $merchant }
          orderBy: timestamp
          orderDirection: desc
          first: $first
          skip: $skip
        ) {
          id
          payer
          merchant
          token
          amount
          timestamp
          transactionHash
          blockNumber
          gasMode
        }
      }
    `;

    const result = await this.querySubgraph<{
      payments: Payment[];
    }>(query, {
      merchant: merchant.toLowerCase(),
      first: options.first ?? 100,
      skip: options.skip ?? 0,
    });

    return result.payments;
  }

  // ============ Token Helpers ============

  /**
   * Check token allowance for the payment gateway
   *
   * @param token Token address
   * @param owner Owner address
   * @returns Current allowance
   */
  async getTokenAllowance(token: Address, owner: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, this.config.gatewayAddress],
    });

    return result as bigint;
  }

  /**
   * Check token balance
   *
   * @param token Token address
   * @param owner Owner address
   * @returns Token balance
   */
  async getTokenBalance(token: Address, owner: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [owner],
    });

    return result as bigint;
  }

  /**
   * Get transaction data for token approval
   * User needs to approve tokens before making a payment
   *
   * @param token Token address
   * @param amount Amount to approve (use MaxUint256 for unlimited)
   * @returns Transaction data for approval
   */
  getApprovalTxData(token: Address, amount: bigint): PaymentTxData {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [this.config.gatewayAddress, amount],
    });

    return {
      to: token,
      data,
      value: 0n,
    };
  }

  // ============ Event Listening ============

  /**
   * Listen for payment completion events
   *
   * @param callback Function to call when a payment is completed
   * @param filter Optional filter by merchant address
   * @returns Unsubscribe function
   */
  onPaymentComplete(
    callback: PaymentCallback,
    filter?: { merchant?: Address }
  ): Unsubscribe {
    const unwatch = this.publicClient.watchContractEvent({
      address: this.config.gatewayAddress,
      abi: PAYMENT_GATEWAY_ABI,
      eventName: "PaymentCompleted",
      args: filter?.merchant ? { merchant: filter.merchant } : undefined,
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as {
            paymentId: Hex;
            payer: Address;
            merchant: Address;
            token: Address;
            amount: bigint;
            timestamp: bigint;
          };

          const payment: Payment = {
            id: args.paymentId,
            paymentId: args.paymentId as Hash,
            payer: args.payer,
            merchant: args.merchant,
            token: args.token,
            amount: args.amount,
            timestamp: args.timestamp,
            transactionHash: log.transactionHash as Hash,
            blockNumber: log.blockNumber,
            gasMode: "Direct", // Can't determine from event alone
          };

          callback(payment);
        }
      },
    });

    return unwatch;
  }

  // ============ Utilities ============

  /**
   * Get the current nonce for a user from the forwarder
   *
   * @param address User address
   * @returns Current nonce
   */
  async getForwarderNonce(address: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.config.forwarderAddress,
      abi: FORWARDER_ABI,
      functionName: "nonces",
      args: [address],
    });

    return result as bigint;
  }

  /**
   * Get the configuration
   */
  getConfig(): MSQPayConfig {
    return { ...this.config };
  }

  // ============ Private Methods ============

  private validatePaymentParams(params: PaymentParams): void {
    if (!params.paymentId || params.paymentId.trim() === "") {
      throw new PaymentError(
        PaymentErrorCode.INVALID_PAYMENT_ID,
        "Payment ID is required"
      );
    }

    if (params.amount <= 0n) {
      throw new PaymentError(
        PaymentErrorCode.INVALID_AMOUNT,
        "Amount must be greater than 0"
      );
    }

    if (
      !params.merchant ||
      params.merchant === "0x0000000000000000000000000000000000000000"
    ) {
      throw new PaymentError(
        PaymentErrorCode.INVALID_MERCHANT,
        "Valid merchant address is required"
      );
    }

    if (
      !params.token ||
      params.token === "0x0000000000000000000000000000000000000000"
    ) {
      throw new PaymentError(
        PaymentErrorCode.INVALID_TOKEN,
        "Valid token address is required"
      );
    }
  }

  private async querySubgraph<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    if (!this.config.subgraphUrl) {
      throw new PaymentError(
        PaymentErrorCode.NETWORK_ERROR,
        "Subgraph URL not configured"
      );
    }

    try {
      const response = await fetch(this.config.subgraphUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return result.data as T;
    } catch (error) {
      throw new PaymentError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to query subgraph",
        error instanceof Error ? error : undefined
      );
    }
  }
}
