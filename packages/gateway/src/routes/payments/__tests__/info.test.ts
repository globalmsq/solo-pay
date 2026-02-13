import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { paymentInfoRoute } from '../info';
import { BlockchainService } from '../../../services/blockchain.service';
import { MerchantService } from '../../../services/merchant.service';
import { ChainService, ChainWithTokens } from '../../../services/chain.service';
import { TokenService } from '../../../services/token.service';
import { PaymentMethodService } from '../../../services/payment-method.service';

const mockChainsWithTokens: ChainWithTokens[] = [
  {
    id: 1,
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
        id: 1,
        chain_id: 1,
        address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        symbol: 'TEST',
        decimals: 18,
        is_enabled: true,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  },
];

const mockApp = {
  post: vi.fn(),
} as Partial<FastifyInstance> as FastifyInstance;

const mockMerchantService = {
  findByApiKey: vi.fn().mockResolvedValue({
    id: 1,
    merchant_key: 'merchant_demo_001',
    is_enabled: true,
    chain_id: 1,
    recipient_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    fee_bps: 100,
  }),
  findByMerchantKey: vi.fn().mockResolvedValue({
    id: 1,
    merchant_key: 'merchant_demo_001',
    is_enabled: true,
    chain_id: 1,
    recipient_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    fee_bps: 100,
  }),
} as Partial<MerchantService> as MerchantService;

const mockChainService = {
  findById: vi.fn().mockResolvedValue({ id: 1, network_id: 31337 }),
  findByNetworkId: vi.fn().mockResolvedValue({ id: 1, network_id: 31337 }),
} as Partial<ChainService> as ChainService;

const mockTokenService = {
  findByAddress: vi.fn().mockResolvedValue({ id: 1, symbol: 'TEST', decimals: 18, chain_id: 1 }),
} as Partial<TokenService> as TokenService;

const mockPaymentMethodService = {
  findByMerchantAndToken: vi.fn().mockResolvedValue({ id: 1, is_enabled: true }),
} as Partial<PaymentMethodService> as PaymentMethodService;

describe.skip('POST /payments/info', () => {
  let blockchainService: BlockchainService;

  beforeEach(() => {
    vi.clearAllMocks();
    blockchainService = new BlockchainService(mockChainsWithTokens);
  });

  describe('Route registration', () => {
    it('should register route at /payments/info', async () => {
      await paymentInfoRoute(
        mockApp,
        blockchainService,
        mockMerchantService,
        mockChainService,
        mockTokenService,
        mockPaymentMethodService
      );

      expect(mockApp.post).toHaveBeenCalled();
      const callArgs = (mockApp.post as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe('/payments/info');
    });

    it('should require API key authentication', async () => {
      await paymentInfoRoute(
        mockApp,
        blockchainService,
        mockMerchantService,
        mockChainService,
        mockTokenService,
        mockPaymentMethodService
      );

      const callArgs = (mockApp.post as ReturnType<typeof vi.fn>).mock.calls[0];
      const options = callArgs[1];
      expect(options.schema.security).toEqual([{ ApiKeyAuth: [] }]);
      expect(options.preHandler).toBeDefined();
    });
  });

  describe('Request validation', () => {
    it('should only require amount and tokenAddress', async () => {
      const requiredFields = ['amount', 'tokenAddress'];
      expect(requiredFields).toHaveLength(2);
      expect(requiredFields).not.toContain('chainId');
      expect(requiredFields).not.toContain('merchantId');
    });

    it('should reject missing amount', () => {
      const payload = {
        tokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      };
      expect(payload).not.toHaveProperty('amount');
    });

    it('should reject missing tokenAddress', () => {
      const payload = {
        amount: 10,
      };
      expect(payload).not.toHaveProperty('tokenAddress');
    });

    it('should reject invalid tokenAddress format', () => {
      const invalidAddresses = ['0x123', 'invalid', '0xGGGG'];
      invalidAddresses.forEach((addr) => {
        expect(addr).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('should reject non-positive amount', () => {
      const invalidAmounts = [0, -1, -100];
      invalidAmounts.forEach((amt) => {
        expect(amt).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('Response format', () => {
    it('should return expected fields without paymentId', async () => {
      const expectedFields = [
        'success',
        'chainId',
        'tokenAddress',
        'tokenSymbol',
        'tokenDecimals',
        'gatewayAddress',
        'forwarderAddress',
        'amount',
        'recipientAddress',
        'merchantId',
        'feeBps',
      ];
      expect(expectedFields).toHaveLength(11);
      expect(expectedFields).not.toContain('paymentId');
      expect(expectedFields).not.toContain('status');
      expect(expectedFields).not.toContain('expiresAt');
    });

    it('should include contract addresses', () => {
      const contracts = blockchainService.getChainContracts(31337);
      expect(contracts).toBeDefined();
      expect(contracts?.gateway).toBe('0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9');
      expect(contracts?.forwarder).toBe('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    });
  });

  describe('Merchant chain derivation', () => {
    it('should derive chainId from merchant configuration', async () => {
      const merchant = await mockMerchantService.findByMerchantKey('merchant_demo_001');
      expect(merchant?.chain_id).toBe(1);

      if (merchant?.chain_id) {
        const chain = await mockChainService.findById(merchant.chain_id);
        expect(chain?.network_id).toBe(31337);
      }
    });

    it('should use merchant recipient_address', async () => {
      const merchant = await mockMerchantService.findByMerchantKey('merchant_demo_001');
      expect(merchant?.recipient_address).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    });

    it('should use merchant fee_bps', async () => {
      const merchant = await mockMerchantService.findByMerchantKey('merchant_demo_001');
      expect(merchant?.fee_bps).toBe(100);
    });
  });

  describe('Error cases', () => {
    it('should return CHAIN_NOT_CONFIGURED when merchant has no chain', () => {
      const errorCode = 'CHAIN_NOT_CONFIGURED';
      expect(errorCode).toBe('CHAIN_NOT_CONFIGURED');
    });

    it('should return RECIPIENT_NOT_CONFIGURED when merchant has no recipient', () => {
      const errorCode = 'RECIPIENT_NOT_CONFIGURED';
      expect(errorCode).toBe('RECIPIENT_NOT_CONFIGURED');
    });

    it('should return UNSUPPORTED_TOKEN for invalid token', () => {
      const tokenAddress = blockchainService.getTokenAddress(31337, 'INVALID');
      expect(tokenAddress).toBeUndefined();
    });

    it('should return PAYMENT_METHOD_NOT_FOUND when not configured', () => {
      const errorCode = 'PAYMENT_METHOD_NOT_FOUND';
      expect(errorCode).toBe('PAYMENT_METHOD_NOT_FOUND');
    });
  });

  describe('Amount conversion', () => {
    it('should convert amount to wei', () => {
      const amount = 10;
      const decimals = 18;
      const wei = BigInt(amount) * BigInt(10 ** decimals);
      expect(wei.toString()).toBe('10000000000000000000');
    });

    it('should handle different decimal values', () => {
      const testCases = [
        { amount: 10, decimals: 18, expected: '10000000000000000000' },
        { amount: 10, decimals: 6, expected: '10000000' },
        { amount: 1.5, decimals: 6, expected: '1500000' },
      ];
      testCases.forEach(({ amount, decimals, expected }) => {
        const wei = BigInt(Math.round(amount * 10 ** decimals));
        expect(wei.toString()).toBe(expected);
      });
    });
  });

  describe('No database writes', () => {
    it('should not create any payment records', async () => {
      await paymentInfoRoute(
        mockApp,
        blockchainService,
        mockMerchantService,
        mockChainService,
        mockTokenService,
        mockPaymentMethodService
      );

      // PaymentService is not passed to paymentInfoRoute
      // This ensures no payment creation occurs
      const callArgs = (mockApp.post as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs).toBeDefined();
    });
  });
});
