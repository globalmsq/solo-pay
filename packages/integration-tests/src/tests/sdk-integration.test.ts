import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient, TEST_MERCHANT, makeCreatePaymentParams } from '../helpers/sdk';
import { getTokenForChain } from '../fixtures/token';
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
 * 이 테스트는 gateway, simple-relayer, hardhat node가 Docker로 실행 중일 때 동작합니다.
 *
 * Note: 머천트는 특정 체인에 바인딩됨
 * - Demo Merchant (chain_id=1) → Localhost (31337) → TEST 토큰
 * - MetaStar Merchant (chain_id=3) → Amoy (80002) → SUT 토큰
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

describe('SDK Integration', () => {
  // Demo Merchant uses Localhost chain and TEST token
  const merchant = getMerchant('default');
  const token = getTokenForChain(merchant.chainId); // Get matching token for merchant's chain
  if (!token) {
    throw new Error(`Token not found for chain ${merchant.chainId}`);
  }
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;

  // Check if gateway is running
  async function isGatewayRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${GATEWAY_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  beforeAll(async () => {
    const serverRunning = await isGatewayRunning();
    if (!serverRunning) {
      console.warn(
        '\n⚠️  gateway is not running. SDK integration tests will be skipped.\n' +
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
      expect(client.getApiUrl()).toBe(`${GATEWAY_URL}/api/v1`);
    });

    it('should handle API key in headers', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      // Client without publicKey/origin cannot call createPayment
      const invalidClient = createTestClient({
        merchantId: TEST_MERCHANT.merchantId,
        apiKey: TEST_MERCHANT.apiKey,
        // no publicKey, no origin
      });

      const params = makeCreatePaymentParams(100);

      await expect(invalidClient.createPayment(params)).rejects.toThrow();
    });
  });

  describe('Payment Creation via SDK', () => {
    it('should create payment through SDK', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const params = makeCreatePaymentParams(100);

      const response = await client.createPayment(params);

      expect(response.paymentId).toBeDefined();
      expect(response.paymentId.startsWith('0x')).toBe(true);
      expect(response.chainId).toBe(token.networkId);
      expect(response.tokenAddress.toLowerCase()).toBe(token.address.toLowerCase());
      expect(response.serverSignature).toBeDefined();
      expect(response.recipientAddress).toBeDefined();
      expect(response.merchantId).toBeDefined();
      expect(response.feeBps).toBeDefined();
    });

    it('should return payment hash and gateway address', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const params = makeCreatePaymentParams(50);

      const response = await client.createPayment(params);

      expect(response.gatewayAddress).toBeDefined();
      expect(response.gatewayAddress.toLowerCase()).toBe(
        CONTRACT_ADDRESSES.paymentGateway.toLowerCase()
      );
      const forwarderAddress = response.forwarderAddress;
      expect(forwarderAddress).toBeDefined();
      if (!forwarderAddress) return;
      expect(forwarderAddress.toLowerCase()).toBe(CONTRACT_ADDRESSES.forwarder.toLowerCase());
    });
  });

  describe('Payment Status via SDK', () => {
    it('should get payment status through SDK', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);

      const createParams = makeCreatePaymentParams(25);
      const createResponse = await client.createPayment(createParams);
      const paymentId = createResponse.paymentId;

      const statusResponse = await client.getPaymentStatus(paymentId);

      expect(statusResponse.success).toBe(true);
      expect(statusResponse.data).toBeDefined();
      expect(statusResponse.data.paymentId).toBe(paymentId);
    });
  });

  describe('Direct Payment Flow via SDK', () => {
    it('should complete direct payment flow: create -> approve -> pay -> status', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const amount = parseUnits('10', token.decimals);

      const createResponse = await client.createPayment(makeCreatePaymentParams(10));
      const paymentId = createResponse.paymentId;

      await approveToken(token.address, createResponse.gatewayAddress, amount, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(createResponse.gatewayAddress, PaymentGatewayABI, wallet);

      const tx = await gateway.pay(
        paymentId,
        token.address,
        amount,
        createResponse.recipientAddress,
        createResponse.merchantId,
        createResponse.feeBps,
        createResponse.serverSignature
      );
      await tx.wait();

      // 4. Verify on-chain
      const isProcessed = await gateway.isPaymentProcessed(paymentId);
      expect(isProcessed).toBe(true);
    });
  });

  describe('Gasless Payment via SDK', () => {
    it('should submit gasless payment through SDK', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const amount = parseUnits('5', token.decimals);

      const createResponse = await client.createPayment(makeCreatePaymentParams(5));
      const paymentId = createResponse.paymentId;

      const {
        recipientAddress,
        merchantId: respMerchantId,
        feeBps,
        serverSignature,
      } = createResponse;
      if (!recipientAddress || !respMerchantId || feeBps === undefined || !serverSignature) {
        throw new Error('Server signature fields missing from response');
      }
      const forwarderAddress = createResponse.forwarderAddress;
      if (!forwarderAddress) {
        throw new Error('forwarderAddress missing from create response');
      }

      await approveToken(token.address, createResponse.gatewayAddress, amount, payerPrivateKey);

      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI);
      const nonce = await forwarder.nonces(payerAddress);
      const deadline = getDeadline(1);
      const data = encodePayFunctionData(
        paymentId,
        token.address,
        amount,
        recipientAddress,
        respMerchantId,
        feeBps,
        serverSignature
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
        forwarderAddress,
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
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const amount = parseUnits('3', token.decimals);

      const createResponse = await client.createPayment(makeCreatePaymentParams(3));

      await approveToken(token.address, createResponse.gatewayAddress, amount, payerPrivateKey);

      const {
        recipientAddress,
        merchantId: respMerchantId,
        feeBps,
        serverSignature,
      } = createResponse;
      if (!recipientAddress || !respMerchantId || feeBps === undefined || !serverSignature) {
        throw new Error('Server signature fields missing from response');
      }
      const forwarderAddress = createResponse.forwarderAddress;
      if (!forwarderAddress) {
        throw new Error('forwarderAddress missing from create response');
      }

      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI);
      const nonce = await forwarder.nonces(payerAddress);
      const deadline = getDeadline(1);
      const data = encodePayFunctionData(
        createResponse.paymentId,
        token.address,
        amount,
        recipientAddress,
        respMerchantId,
        feeBps,
        serverSignature
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

      await client.submitGasless({
        paymentId: createResponse.paymentId,
        forwarderAddress,
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

      // Gateway no longer exposes GET /payments/relay/:id/status; poll payment status instead
      const paymentId = createResponse.paymentId;
      const statusResponse = await client.getPaymentStatus(paymentId);
      expect(statusResponse.success).toBe(true);
      expect(statusResponse.data?.paymentId).toBe(paymentId);
      expect(['CREATED', 'PENDING', 'CONFIRMED', 'FAILED']).toContain(statusResponse.data?.status);
    });
  });

  describe('Error Handling', () => {
    it('should reject createPayment when public key is invalid', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient({
        ...TEST_MERCHANT,
        publicKey: 'pk_invalid',
        origin: 'http://localhost:3000',
      });

      await expect(client.createPayment(makeCreatePaymentParams(100))).rejects.toThrow();
    });

    it('should handle non-existent payment ID', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient(TEST_MERCHANT);
      const fakePaymentId = '0x' + '00'.repeat(32);

      await expect(client.getPaymentStatus(fakePaymentId)).rejects.toThrow();
    });

    it('should reject createPayment when origin is not in allowed_domains', async () => {
      const serverRunning = await isGatewayRunning();
      if (!serverRunning) {
        return;
      }

      const client = createTestClient({
        ...TEST_MERCHANT,
        publicKey: 'pk_test_demo',
        origin: 'https://not-allowed.example.com',
      });

      await expect(client.createPayment(makeCreatePaymentParams(100))).rejects.toThrow();
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
