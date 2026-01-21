import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient, TEST_MERCHANT, type CreatePaymentParams } from '../helpers/sdk';
import { getToken, getTokenForChain } from '../fixtures/token';
import { getMerchant } from '../fixtures/merchant';
import {
  getWallet,
  getContract,
  approveToken,
  mintTokens,
  parseUnits,
  getTokenBalance,
  PaymentGatewayABI,
  ERC2771ForwarderABI,
} from '../helpers/blockchain';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import {
  signForwardRequest,
  encodePayFunctionData,
  getDeadline,
  type ForwardRequest,
} from '../helpers/signature';

/**
 * SDK 통합 테스트
 *
 * 전체 스택 테스트를 위해서는 다음이 필요합니다:
 * pnpm --filter @globalmsq/integration-tests test:setup
 *
 * 이 테스트는 pay-server, simple-relayer, hardhat node가 Docker로 실행 중일 때 동작합니다.
 *
 * Note: 머천트는 특정 체인에 바인딩됨
 * - Demo Merchant (chain_id=1) → Localhost (31337) → TEST 토큰
 * - MetaStar Merchant (chain_id=3) → Amoy (80002) → SUT 토큰
 */

const PAY_SERVER_URL = process.env.PAY_SERVER_URL || 'http://localhost:3011';

describe('SDK Integration', () => {
  // Demo Merchant uses Localhost chain and TEST token
  const merchant = getMerchant('default');
  const token = getTokenForChain(merchant.chainId); // Get matching token for merchant's chain
  if (!token) {
    throw new Error(`Token not found for chain ${merchant.chainId}`);
  }
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;

  // Check if pay-server is running
  async function isPayServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${PAY_SERVER_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  beforeAll(async () => {
    const serverRunning = await isPayServerRunning();
    if (!serverRunning) {
      console.warn(
        '\n⚠️  pay-server is not running. SDK integration tests will be skipped.\n' +
          '   Run: pnpm --filter @globalmsq/integration-tests test:setup\n'
      );
    }

    // Ensure payer has tokens for tests
    const balance = await getTokenBalance(token.address, payerAddress);
    if (balance < parseUnits('1000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }
  });

  describe('Client Configuration', () => {
    it('should create SDK client with custom environment', async () => {
      const client = createTestClient(TEST_MERCHANT);
      expect(client.getApiUrl()).toBe(PAY_SERVER_URL);
    });

    it('should handle API key in headers', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      // Invalid API key should fail
      const invalidClient = createTestClient({
        merchantId: TEST_MERCHANT.merchantId,
        apiKey: 'invalid_key',
      });

      const params: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 100,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      await expect(invalidClient.createPayment(params)).rejects.toThrow();
    });
  });

  describe('Payment Creation via SDK', () => {
    it('should create payment through SDK', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const params: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 100,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      const response = await client.createPayment(params);

      expect(response.success).toBe(true);
      expect(response.paymentId).toBeDefined();
      expect(response.paymentId.startsWith('0x')).toBe(true);
      expect(response.chainId).toBe(token.networkId);
      expect(response.tokenAddress.toLowerCase()).toBe(token.address.toLowerCase());
      expect(response.status).toBe('created');
    });

    it('should return payment hash and gateway address', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const params: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 50,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      const response = await client.createPayment(params);

      expect(response.gatewayAddress).toBeDefined();
      expect(response.gatewayAddress.toLowerCase()).toBe(
        CONTRACT_ADDRESSES.paymentGateway.toLowerCase()
      );
      expect(response.forwarderAddress).toBeDefined();
      expect(response.forwarderAddress.toLowerCase()).toBe(
        CONTRACT_ADDRESSES.forwarder.toLowerCase()
      );
    });
  });

  describe('Payment Status via SDK', () => {
    it('should get payment status through SDK', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      // First create a payment
      const createParams: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 25,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      const createResponse = await client.createPayment(createParams);
      const paymentId = createResponse.paymentId;

      // Then get status
      const statusResponse = await client.getPaymentStatus(paymentId);

      expect(statusResponse.success).toBe(true);
      expect(statusResponse.data).toBeDefined();
      expect(statusResponse.data.paymentId).toBe(paymentId);
    });
  });

  describe('Direct Payment Flow via SDK', () => {
    it('should complete direct payment flow: create -> approve -> pay -> status', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const amount = parseUnits('10', token.decimals);

      // 1. Create payment via SDK
      const createResponse = await client.createPayment({
        merchantId: merchant.merchantId,
        amount: 10,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      });

      expect(createResponse.success).toBe(true);
      const paymentId = createResponse.paymentId;

      // 2. Approve tokens
      await approveToken(token.address, createResponse.gatewayAddress, amount, payerPrivateKey);

      // 3. Execute payment on-chain
      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(createResponse.gatewayAddress, PaymentGatewayABI, wallet);

      const tx = await gateway.pay(paymentId, token.address, amount, merchant.recipientAddress);
      await tx.wait();

      // 4. Verify on-chain
      const isProcessed = await gateway.isPaymentProcessed(paymentId);
      expect(isProcessed).toBe(true);
    });
  });

  describe('Gasless Payment via SDK', () => {
    it('should submit gasless payment through SDK', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const amount = parseUnits('5', token.decimals);

      // 1. Create payment via SDK
      const createResponse = await client.createPayment({
        merchantId: merchant.merchantId,
        amount: 5,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      });

      const paymentId = createResponse.paymentId;

      // 2. Approve tokens
      await approveToken(token.address, createResponse.gatewayAddress, amount, payerPrivateKey);

      // 3. Build and sign ForwardRequest
      const forwarder = getContract(createResponse.forwarderAddress, ERC2771ForwarderABI);
      const nonce = await forwarder.nonces(payerAddress);
      const deadline = getDeadline(1);
      const data = encodePayFunctionData(
        paymentId,
        token.address,
        amount,
        merchant.recipientAddress
      );

      const request: ForwardRequest = {
        from: payerAddress,
        to: createResponse.gatewayAddress,
        value: 0n,
        gas: 500000n,
        nonce,
        deadline,
        data,
      };

      const signature = await signForwardRequest(request, payerPrivateKey);

      // 4. Submit gasless via SDK
      const gaslessResponse = await client.submitGasless({
        paymentId,
        forwarderAddress: createResponse.forwarderAddress,
        forwardRequest: {
          from: request.from,
          to: request.to,
          value: request.value.toString(),
          gas: request.gas.toString(),
          nonce: request.nonce.toString(),
          deadline: request.deadline.toString(),
          data: request.data,
          signature,
        },
      });

      expect(gaslessResponse.success).toBe(true);
      expect(gaslessResponse.relayRequestId).toBeDefined();
    });

    it('should track relay status', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const amount = parseUnits('3', token.decimals);

      // Create and submit gasless payment
      const createResponse = await client.createPayment({
        merchantId: merchant.merchantId,
        amount: 3,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      });

      await approveToken(token.address, createResponse.gatewayAddress, amount, payerPrivateKey);

      const forwarder = getContract(createResponse.forwarderAddress, ERC2771ForwarderABI);
      const nonce = await forwarder.nonces(payerAddress);
      const deadline = getDeadline(1);
      const data = encodePayFunctionData(
        createResponse.paymentId,
        token.address,
        amount,
        merchant.recipientAddress
      );

      const request: ForwardRequest = {
        from: payerAddress,
        to: createResponse.gatewayAddress,
        value: 0n,
        gas: 500000n,
        nonce,
        deadline,
        data,
      };

      const signature = await signForwardRequest(request, payerPrivateKey);

      const gaslessResponse = await client.submitGasless({
        paymentId: createResponse.paymentId,
        forwarderAddress: createResponse.forwarderAddress,
        forwardRequest: {
          from: request.from,
          to: request.to,
          value: request.value.toString(),
          gas: request.gas.toString(),
          nonce: request.nonce.toString(),
          deadline: request.deadline.toString(),
          data: request.data,
          signature,
        },
      });

      // Track relay status
      const relayStatus = await client.getRelayStatus(gaslessResponse.relayRequestId);

      expect(relayStatus.success).toBe(true);
      expect(relayStatus.relayRequestId).toBe(gaslessResponse.relayRequestId);
      expect(['submitted', 'pending', 'mined', 'confirmed', 'failed']).toContain(
        relayStatus.status
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid merchant ID', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const params: CreatePaymentParams = {
        merchantId: 'invalid_merchant_id',
        amount: 100,
        chainId: token.networkId,
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      await expect(client.createPayment(params)).rejects.toThrow();
    });

    it('should handle invalid chain ID', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const params: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 100,
        chainId: 99999, // Invalid chain
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      await expect(client.createPayment(params)).rejects.toThrow();
    });

    it('should handle non-existent payment ID', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const fakePaymentId = '0x' + '00'.repeat(32);

      await expect(client.getPaymentStatus(fakePaymentId)).rejects.toThrow();
    });

    it('should reject payment with mismatched chain (merchant chain != request chain)', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      // Demo merchant is bound to chain_id=1 (Localhost/31337)
      // Try to create payment with different chain (Amoy/80002)
      const params: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 100,
        chainId: 80002, // Amoy - different from merchant's chain
        recipientAddress: merchant.recipientAddress,
        tokenAddress: token.address,
      };

      // Should fail because merchant is not configured for this chain
      await expect(client.createPayment(params)).rejects.toThrow();
    });

    it('should reject payment with token from different chain', async () => {
      const serverRunning = await isPayServerRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const sutAmoyToken = getToken('sutAmoy'); // Token on Amoy chain

      // Demo merchant uses Localhost chain, but we're trying to use Amoy token
      const params: CreatePaymentParams = {
        merchantId: merchant.merchantId,
        amount: 100,
        chainId: token.networkId, // Correct chain for merchant
        recipientAddress: merchant.recipientAddress,
        tokenAddress: sutAmoyToken.address, // Wrong token (from different chain)
      };

      // Should fail because token is not on merchant's chain
      await expect(client.createPayment(params)).rejects.toThrow();
    });
  });

  describe('Merchant-Chain Binding', () => {
    it('should verify merchant is bound to specific chain', () => {
      // Demo merchant should be on Localhost (chain_id=1, network_id=31337)
      expect(merchant.chainId).toBe(1);
      expect(merchant.networkId).toBe(31337);

      // Token should match merchant's chain
      expect(token.dbChainId).toBe(merchant.chainId);
      expect(token.networkId).toBe(merchant.networkId);
    });

    it('should have correct token for merchant chain', () => {
      const matchingToken = getTokenForChain(merchant.chainId);

      expect(matchingToken).toBeDefined();
      expect(matchingToken?.symbol).toBe('TEST');
      expect(matchingToken?.networkId).toBe(31337);
    });

    it('should verify MetaStar merchant is bound to Amoy chain', () => {
      const metastarMerchant = getMerchant('metastar');
      const metastarToken = getTokenForChain(metastarMerchant.chainId);

      // MetaStar should be on Amoy (chain_id=3, network_id=80002)
      expect(metastarMerchant.chainId).toBe(3);
      expect(metastarMerchant.networkId).toBe(80002);

      // Token should be SUT on Amoy
      expect(metastarToken).toBeDefined();
      expect(metastarToken?.symbol).toBe('SUT');
      expect(metastarToken?.networkId).toBe(80002);
    });
  });
});
