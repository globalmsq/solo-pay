import { TypedDataDomain, Hex, Address, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount, PrivateKeyAccount } from 'viem/accounts';

/**
 * EIP-712 PaymentRequest type for server signing
 */
interface PaymentRequest {
  paymentId: Hex;
  tokenAddress: Address;
  amount: bigint;
  recipientAddress: Address;
  merchantId: Hex;
  feeBps: number;
}

/**
 * Server signing service for generating EIP-712 payment signatures
 *
 * This service signs payment requests with the server's private key.
 * The signatures are verified by the PaymentGateway smart contract.
 */
export class ServerSigningService {
  private account: PrivateKeyAccount;
  private chainId: number;
  private gatewayAddress: Address;
  private name = 'MSQPayGateway';
  private version = '1';

  constructor(privateKey: Hex, chainId: number, gatewayAddress: Address) {
    if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }
    if (!chainId || chainId <= 0) {
      throw new Error('Invalid chain ID');
    }
    if (!gatewayAddress || !gatewayAddress.startsWith('0x') || gatewayAddress.length !== 42) {
      throw new Error('Invalid gateway address');
    }

    this.account = privateKeyToAccount(privateKey);
    this.chainId = chainId;
    this.gatewayAddress = gatewayAddress;
  }

  /**
   * Get EIP-712 domain
   */
  getDomain(): TypedDataDomain {
    return {
      name: this.name,
      version: this.version,
      chainId: this.chainId,
      verifyingContract: this.gatewayAddress,
    };
  }

  /**
   * Get PaymentRequest type definition
   */
  getPaymentRequestTypes() {
    return {
      PaymentRequest: [
        { name: 'paymentId', type: 'bytes32' },
        { name: 'tokenAddress', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'recipientAddress', type: 'address' },
        { name: 'merchantId', type: 'bytes32' },
        { name: 'feeBps', type: 'uint16' },
      ],
    } as const;
  }

  /**
   * Sign a payment request
   *
   * @param paymentId - Unique payment identifier (bytes32)
   * @param tokenAddress - ERC20 token address
   * @param amount - Payment amount in wei
   * @param recipientAddress - Recipient address (merchant's wallet)
   * @param merchantId - Merchant identifier (bytes32)
   * @param feeBps - Fee in basis points (0-10000)
   * @returns EIP-712 signature
   */
  async signPaymentRequest(
    paymentId: Hex,
    tokenAddress: Address,
    amount: bigint,
    recipientAddress: Address,
    merchantId: Hex,
    feeBps: number
  ): Promise<Hex> {
    const message: PaymentRequest = {
      paymentId,
      tokenAddress,
      amount,
      recipientAddress,
      merchantId,
      feeBps,
    };

    const signature = await this.account.signTypedData({
      domain: this.getDomain(),
      types: this.getPaymentRequestTypes(),
      primaryType: 'PaymentRequest',
      message,
    });

    return signature;
  }

  /**
   * Get the signer address
   */
  getSignerAddress(): Address {
    return this.account.address;
  }

  /**
   * Convert merchant key to bytes32 merchantId
   *
   * @param merchantKey - Merchant's unique key string
   * @returns bytes32 merchant ID
   */
  static merchantKeyToId(merchantKey: string): Hex {
    return keccak256(encodePacked(['string'], [merchantKey]));
  }
}
