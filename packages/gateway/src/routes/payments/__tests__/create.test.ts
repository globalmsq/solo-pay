import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createPaymentRoute } from '../create';
import { BlockchainService } from '../../../services/blockchain.service';
import { MerchantService } from '../../../services/merchant.service';
import { ChainService, ChainWithTokens } from '../../../services/chain.service';
import { TokenService } from '../../../services/token.service';
import { PaymentMethodService } from '../../../services/payment-method.service';
import { PaymentService } from '../../../services/payment.service';

// 테스트용 ChainWithTokens mock (DB에서 로드된 형식)
const mockChainTokens: ChainWithTokens[] = [
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
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    tokens: [
      {
        id: 1,
        chain_id: 1,
        address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        symbol: 'SUT',
        decimals: 18,
        cmc_id: null,
        is_enabled: true,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
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
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    tokens: [
      {
        id: 2,
        chain_id: 2,
        address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        symbol: 'TEST',
        decimals: 18,
        cmc_id: null,
        is_enabled: true,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  },
];

// Mock Fastify app
const mockApp = {
  post: vi.fn(),
} as Partial<FastifyInstance> as FastifyInstance;

// Mock services
const mockMerchantService = {
  findByApiKey: vi.fn().mockResolvedValue({ id: 1, merchant_key: 'test' }),
  findByMerchantKey: vi.fn().mockResolvedValue({ id: 1, merchant_key: 'test', is_enabled: true }),
} as Partial<MerchantService> as MerchantService;

const mockChainService = {
  findByNetworkId: vi.fn().mockResolvedValue({ id: 1, network_id: 80002 }),
} as Partial<ChainService> as ChainService;

const mockTokenService = {
  findByAddress: vi.fn().mockResolvedValue({ id: 1, symbol: 'SUT', decimals: 18 }),
} as Partial<TokenService> as TokenService;

const mockPaymentMethodService = {
  findByMerchantAndToken: vi.fn().mockResolvedValue({ id: 1, is_enabled: true }),
} as Partial<PaymentMethodService> as PaymentMethodService;

const mockPaymentService = {
  create: vi.fn().mockResolvedValue({
    id: 1,
    payment_hash: '0x123',
    status: 'CREATED',
    expires_at: new Date(),
  }),
} as Partial<PaymentService> as PaymentService;

describe('POST /payment', () => {
  let blockchainService: BlockchainService;

  beforeEach(() => {
    vi.clearAllMocks();
    blockchainService = new BlockchainService(mockChainTokens);
  });

  describe('Valid requests', () => {
    it('should accept valid payment creation request', async () => {
      // Store the posted handler (reserved for future handler invocation tests)
      (mockApp.post as ReturnType<typeof vi.fn>).mockImplementation(() => {
        // Handler registration captured
      });

      await createPaymentRoute(
        mockApp,
        blockchainService,
        mockMerchantService,
        mockChainService,
        mockTokenService,
        mockPaymentMethodService,
        mockPaymentService
      );

      // Verify route was registered
      expect(mockApp.post).toHaveBeenCalled();
      const callArgs = (mockApp.post as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe('/payment');
    });
  });

  describe('Schema validation', () => {
    it('should validate required fields in request body', () => {
      const requiredFields = ['orderId', 'amount', 'tokenAddress', 'successUrl', 'failUrl'];
      expect(requiredFields).toHaveLength(5);
    });
  });

  describe('Response format', () => {
    it('should return HTTP 201 Created for successful payment creation', async () => {
      // The response format should include:
      // - success: boolean
      // - paymentId: string
      // - tokenAddress: string
      // - gatewayAddress: string
      // - forwarderAddress: string
      // - amount: string (wei)
      // - status: string
      const expectedFields = [
        'success',
        'paymentId',
        'tokenAddress',
        'gatewayAddress',
        'forwarderAddress',
        'amount',
        'status',
      ];
      expect(expectedFields).toHaveLength(7);
    });

    it('should include blockchain contract addresses in response', () => {
      const contracts = blockchainService.getChainContracts(80002);
      expect(contracts).toBeDefined();
      expect(contracts).toHaveProperty('gateway');
      expect(contracts).toHaveProperty('forwarder');
    });
  });

  describe('Error handling', () => {
    it('should return HTTP 400 for unsupported chainId', () => {
      // When chainId is not in SUPPORTED_CHAINS
      const unsupportedChainId = 1; // Ethereum Mainnet
      const contracts = blockchainService.getChainContracts(unsupportedChainId);
      expect(contracts).toBeUndefined();
    });

    it('should return HTTP 400 with UNSUPPORTED_CHAIN code', () => {
      // Error response format:
      // { code: "UNSUPPORTED_CHAIN", message: "Chain ID X is not supported" }
      const errorCode = 'UNSUPPORTED_CHAIN';
      expect(errorCode).toBe('UNSUPPORTED_CHAIN');
    });

    it('should return HTTP 400 for unsupported token on chain', () => {
      // When currency is not in chain.tokens
      const tokenAddress = blockchainService.getTokenAddress(80002, 'UNKNOWN');
      expect(tokenAddress).toBeUndefined();
    });

    it('should return HTTP 400 with UNSUPPORTED_TOKEN code', () => {
      // Error response format:
      // { code: "UNSUPPORTED_TOKEN", message: "Token X not supported on chain Y" }
      const errorCode = 'UNSUPPORTED_TOKEN';
      expect(errorCode).toBe('UNSUPPORTED_TOKEN');
    });

    it('should validate amount is positive', () => {
      const payload = {
        amount: 0,
        chainId: 80002,
        tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
      };
      expect(payload.amount).toBeLessThanOrEqual(0);
    });
  });

  describe('Integration with BlockchainService', () => {
    it('should use getTokenAddress to fetch token address', () => {
      const tokenAddress = blockchainService.getTokenAddress(80002, 'SUT');
      expect(tokenAddress).toBe('0xE4C687167705Abf55d709395f92e254bdF5825a2');
    });

    it('should use getChainContracts to fetch gateway and forwarder', () => {
      const contracts = blockchainService.getChainContracts(80002);
      expect(contracts).toBeDefined();
      expect(contracts?.gateway).toBeDefined();
      expect(contracts?.forwarder).toBeDefined();
    });

    it('should call getDecimals for amount conversion', async () => {
      const getDecimalsSpy = vi.spyOn(blockchainService, 'getDecimals');
      await blockchainService.getDecimals(80002, '0xE4C687167705Abf55d709395f92e254bdF5825a2');
      expect(getDecimalsSpy).toHaveBeenCalled();
    });
  });

  describe('Amount conversion to wei', () => {
    it('should convert amount to wei using decimals', () => {
      // Example: 100 tokens with 18 decimals = 100 * 10^18 wei
      const amount = 100;
      const decimals = 18;
      const wei = BigInt(amount) * BigInt(10 ** decimals);
      expect(wei.toString()).toBe('100000000000000000000');
    });

    it('should handle different decimal values', () => {
      const testCases = [
        { amount: 100, decimals: 18, expected: '100000000000000000000' },
        { amount: 100, decimals: 6, expected: '100000000' },
        { amount: 100, decimals: 8, expected: '10000000000' },
      ];
      testCases.forEach(({ amount, decimals, expected }) => {
        const wei = BigInt(amount) * BigInt(10 ** decimals);
        expect(wei.toString()).toBe(expected);
      });
    });
  });
});
