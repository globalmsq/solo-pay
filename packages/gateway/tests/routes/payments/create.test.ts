import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createPaymentRoute } from '../../../src/routes/payments/create';
import { BlockchainService } from '../../../src/services/blockchain.service';
import { MerchantService } from '../../../src/services/merchant.service';
import { ChainService, ChainWithTokens } from '../../../src/services/chain.service';
import { TokenService } from '../../../src/services/token.service';
import { PaymentMethodService } from '../../../src/services/payment-method.service';
import { PaymentService } from '../../../src/services/payment.service';

const TEST_PUBLIC_KEY = 'pk_test_demo';
const TEST_ORIGIN = 'http://localhost:3011';

// Mock ChainWithTokens data (format yang diharapkan BlockchainService)
const mockChainsWithTokens: ChainWithTokens[] = [
  {
    id: 1,
    network_id: 80002,
    name: 'Polygon Amoy',
    rpc_url: 'https://rpc-amoy.polygon.technology',
    gateway_address: '0x0000000000000000000000000000000000000000',
    forwarder_address: '0x0000000000000000000000000000000000000000',
    is_testnet: true,
    is_enabled: true,
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    tokens: [
      {
        id: 1,
        chain_id: 1,
        address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        symbol: 'SUT',
        decimals: 18,
        is_enabled: true,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ],
  },
  {
    id: 2,
    network_id: 31337,
    name: 'Hardhat',
    rpc_url: 'http://127.0.0.1:8545',
    gateway_address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    forwarder_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    is_testnet: true,
    is_enabled: true,
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    tokens: [
      {
        id: 2,
        chain_id: 2,
        address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        symbol: 'TEST',
        decimals: 18,
        is_enabled: true,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ],
  },
];

const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_001',
  chain_id: 1,
  is_enabled: true,
  recipient_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  fee_bps: 0,
  allowed_domains: [TEST_ORIGIN],
};

const mockChain = {
  id: 1,
  network_id: 80002,
  gateway_address: '0x0000000000000000000000000000000000000000',
  forwarder_address: '0x0000000000000000000000000000000000000000',
};

const mockChain31337 = {
  id: 2,
  network_id: 31337,
  gateway_address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  forwarder_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
};

const mockToken = {
  id: 1,
  chain_id: 1,
  address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  symbol: 'SUT',
  decimals: 18,
};

const mockToken31337 = {
  id: 2,
  chain_id: 2,
  address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  symbol: 'TEST',
  decimals: 18,
};

const mockPaymentMethod = {
  id: 1,
  token_id: 1,
  is_enabled: true,
};

const mockPayment = {
  id: 1,
  payment_hash: '0x123',
  status: 'CREATED',
  expires_at: new Date(Date.now() + 30 * 60 * 1000),
};

describe('POST /payments/create', () => {
  let app: FastifyInstance;
  let blockchainService: BlockchainService;
  let merchantService: Partial<MerchantService>;
  let chainService: Partial<ChainService>;
  let tokenService: Partial<TokenService>;
  let paymentMethodService: Partial<PaymentMethodService>;
  let paymentService: Partial<PaymentService>;

  beforeEach(async () => {
    app = Fastify({
      logger: false,
      ajv: {
        customOptions: {
          keywords: ['example'],
        },
      },
    });
    await app.register(cors);

    // 실제 BlockchainService 인스턴스 생성
    blockchainService = new BlockchainService(mockChainsWithTokens);

    // Mock getDecimals and getTokenSymbolOnChain to return on-chain values
    blockchainService.getDecimals = vi.fn().mockResolvedValue(18);
    blockchainService.getTokenSymbolOnChain = vi
      .fn()
      .mockImplementation((_chainId: number, tokenAddress: string) => {
        if (
          tokenAddress.toLowerCase() === '0xE4C687167705Abf55d709395f92e254bdF5825a2'.toLowerCase()
        ) {
          return Promise.resolve('SUT');
        }
        if (
          tokenAddress.toLowerCase() === '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'.toLowerCase()
        ) {
          return Promise.resolve('TEST');
        }
        return Promise.resolve('UNKNOWN');
      });

    merchantService = {
      findByPublicKey: vi.fn().mockResolvedValue({ ...mockMerchant, merchant_key: 'merchant_001' }),
      findByMerchantKey: vi.fn().mockImplementation((key: string) => {
        if (key.startsWith('merchant_')) {
          return Promise.resolve({ ...mockMerchant, merchant_key: key });
        }
        return Promise.resolve(null);
      }),
    };

    chainService = {
      findById: vi.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockChain);
        if (id === 2) return Promise.resolve(mockChain31337);
        return Promise.resolve(null);
      }),
      findByNetworkId: vi.fn().mockImplementation((networkId: number) => {
        if (networkId === 80002) return Promise.resolve(mockChain);
        if (networkId === 31337) return Promise.resolve(mockChain31337);
        return Promise.resolve(null);
      }),
    };

    tokenService = {
      findById: vi.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockToken);
        if (id === 2) return Promise.resolve(mockToken31337);
        return Promise.resolve(null);
      }),
      findByAddress: vi.fn().mockImplementation((_chainId: number, address: string) => {
        if (address?.toLowerCase() === '0xE4C687167705Abf55d709395f92e254bdF5825a2'.toLowerCase())
          return Promise.resolve(mockToken);
        if (address?.toLowerCase() === '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'.toLowerCase())
          return Promise.resolve(mockToken31337);
        return Promise.resolve(null);
      }),
    };

    paymentMethodService = {
      findAllForMerchant: vi.fn().mockResolvedValue([{ ...mockPaymentMethod }]),
      findByMerchantAndToken: vi.fn().mockResolvedValue(mockPaymentMethod),
    };

    paymentService = {
      create: vi.fn().mockResolvedValue(mockPayment),
    };

    await createPaymentRoute(
      app,
      blockchainService,
      merchantService as MerchantService,
      chainService as ChainService,
      tokenService as TokenService,
      paymentMethodService as PaymentMethodService,
      paymentService as PaymentService
    );
  });

  describe('정상 케이스', () => {
    it('유효한 결제 요청을 받으면 201 상태 코드와 함께 결제 ID를 반환해야 함', async () => {
      const validPayment = {
        orderId: 'order-001',
        amount: 100,
        tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        successUrl: 'https://example.com/success',
        failUrl: 'https://example.com/fail',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: validPayment,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.paymentId).toBeDefined();
      expect(body.orderId).toBe('order-001');
      expect(body.tokenAddress).toBe('0xE4C687167705Abf55d709395f92e254bdF5825a2');
      expect(body.tokenSymbol).toBe('SUT');
      expect(body.tokenDecimals).toBe(18);
      expect(body.gatewayAddress).toBeDefined();
      expect(body.forwarderAddress).toBeDefined();
      expect(body.amount).toBe('100000000000000000000');
      expect(body.expiresAt).toBeDefined();
      expect(body.serverSignature).toBeDefined();
    });

    it('Hardhat 체인 (chainId 31337)으로 최소 필수 정보만으로 결제를 생성할 수 있어야 함', async () => {
      (merchantService as { findByPublicKey: ReturnType<typeof vi.fn> }).findByPublicKey = vi
        .fn()
        .mockResolvedValue({ ...mockMerchant, merchant_key: 'merchant_002', chain_id: 2 });
      (
        paymentMethodService as { findAllForMerchant: ReturnType<typeof vi.fn> }
      ).findAllForMerchant = vi.fn().mockResolvedValue([{ ...mockPaymentMethod, token_id: 2 }]);

      const minimalPayment = {
        orderId: 'order-002',
        amount: 50,
        tokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        successUrl: 'https://example.com/success',
        failUrl: 'https://example.com/fail',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: minimalPayment,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.tokenAddress).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    });
  });

  describe('경계 케이스', () => {
    it('금액이 0일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        orderId: 'order-001',
        amount: 0,
        tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        successUrl: 'https://example.com/success',
        failUrl: 'https://example.com/fail',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('음수 금액일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        orderId: 'order-001',
        amount: -50,
        tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        successUrl: 'https://example.com/success',
        failUrl: 'https://example.com/fail',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('예외 케이스', () => {
    it('필수 필드가 누락되었을 때 400 상태 코드를 반환해야 함', async () => {
      const incompletePayment = {
        orderId: 'order-001',
        amount: 100,
        tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        // successUrl, failUrl 누락
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: incompletePayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code === 'VALIDATION_ERROR' || body.code === 'FST_ERR_VALIDATION').toBe(true);
    });

    it('Origin이 allowed_domains에 없으면 403을 반환해야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: 'https://not-allowed.example.com' },
        payload: {
          orderId: 'order-001',
          amount: 100,
          tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          successUrl: 'https://example.com/success',
          failUrl: 'https://example.com/fail',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('tokenAddress가 whitelist에 없으면 404 TOKEN_NOT_FOUND를 반환해야 함', async () => {
      (tokenService as { findByAddress: ReturnType<typeof vi.fn> }).findByAddress = vi
        .fn()
        .mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: {
          orderId: 'order-001',
          amount: 100,
          tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          successUrl: 'https://example.com/success',
          failUrl: 'https://example.com/fail',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('TOKEN_NOT_FOUND');
    });

    it('token이 merchant payment method에 없거나 disabled면 400 TOKEN_NOT_ENABLED를 반환해야 함', async () => {
      (
        paymentMethodService as { findByMerchantAndToken: ReturnType<typeof vi.fn> }
      ).findByMerchantAndToken = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: {
          orderId: 'order-001',
          amount: 100,
          tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          successUrl: 'https://example.com/success',
          failUrl: 'https://example.com/fail',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('TOKEN_NOT_ENABLED');
    });

    it('decimals 조회 오류 발생 시에도 fallback으로 진행해야 함', async () => {
      blockchainService.getDecimals = vi.fn().mockRejectedValue(new Error('RPC error'));

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN },
        payload: {
          orderId: 'order-001',
          amount: 100,
          tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          successUrl: 'https://example.com/success',
          failUrl: 'https://example.com/fail',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.amount).toBe('100000000000000000000');
    });
  });
});
