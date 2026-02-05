import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../db/__mocks__/client';

// Mock the client module
vi.mock('../../db/client', () => ({
  getPrismaClient: vi.fn(() => mockPrisma),
  disconnectPrisma: vi.fn(),
}));

import { PaymentMethodService } from '../payment-method.service';

describe('PaymentMethodService', () => {
  let paymentMethodService: PaymentMethodService;
  const merchantId = 1;
  // chainId reserved for future test cases
  let tokenCounter = 0;

  beforeEach(() => {
    resetPrismaMocks();
    paymentMethodService = new PaymentMethodService(mockPrisma);
    tokenCounter = 0;
  });

  const createMockTokenId = () => {
    tokenCounter++;
    return tokenCounter;
  };

  it('should create a new payment method', async () => {
    const tokenId = createMockTokenId();
    const methodData = {
      merchant_id: merchantId,
      token_id: tokenId,
    };

    const mockResult = {
      id: 1,
      ...methodData,
      is_enabled: true,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    mockPrisma.merchantPaymentMethod.create.mockResolvedValue(mockResult);

    const result = await paymentMethodService.create(methodData);

    expect(result).toBeDefined();
    expect(result.merchant_id).toBe(merchantId);
    expect(result.token_id).toBe(tokenId);
    expect(result.is_enabled).toBe(true);
    expect(result.is_deleted).toBe(false);
    expect(mockPrisma.merchantPaymentMethod.create).toHaveBeenCalledOnce();
  });

  it('should find payment method by ID', async () => {
    const tokenId = createMockTokenId();
    const mockMethod = {
      id: 2,
      merchant_id: merchantId,
      token_id: tokenId,
      is_enabled: true,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    mockPrisma.merchantPaymentMethod.findFirst.mockResolvedValue(mockMethod);

    const result = await paymentMethodService.findById(2);

    expect(result).toBeDefined();
    expect(result?.id).toBe(2);
    expect(mockPrisma.merchantPaymentMethod.findFirst).toHaveBeenCalledOnce();
  });

  it('should find payment method by merchant and token', async () => {
    const tokenId = createMockTokenId();
    const mockMethod = {
      id: 3,
      merchant_id: merchantId,
      token_id: tokenId,
      is_enabled: true,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    mockPrisma.merchantPaymentMethod.findFirst.mockResolvedValue(mockMethod);

    const result = await paymentMethodService.findByMerchantAndToken(merchantId, tokenId);

    expect(result).toBeDefined();
    expect(result?.merchant_id).toBe(merchantId);
    expect(result?.token_id).toBe(tokenId);
    expect(mockPrisma.merchantPaymentMethod.findFirst).toHaveBeenCalledOnce();
  });

  it('should find all payment methods for merchant', async () => {
    const tokenId1 = createMockTokenId();
    const mockMethods = [
      {
        id: 4,
        merchant_id: merchantId,
        token_id: tokenId1,
        is_enabled: true,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ];

    mockPrisma.merchantPaymentMethod.findMany.mockResolvedValue(mockMethods);

    const result = await paymentMethodService.findAllForMerchant(merchantId);

    expect(result.length).toBe(1);
    expect(result[0].merchant_id).toBe(merchantId);
    expect(mockPrisma.merchantPaymentMethod.findMany).toHaveBeenCalledOnce();
  });

  it('should update payment method', async () => {
    const tokenId = createMockTokenId();
    const mockUpdated = {
      id: 5,
      merchant_id: merchantId,
      token_id: tokenId,
      is_enabled: false,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    mockPrisma.merchantPaymentMethod.update.mockResolvedValue(mockUpdated);

    const updated = await paymentMethodService.update(5, {
      is_enabled: false,
    });

    expect(updated.is_enabled).toBe(false);
    expect(mockPrisma.merchantPaymentMethod.update).toHaveBeenCalledOnce();
  });

  it('should soft delete payment method', async () => {
    const tokenId = createMockTokenId();
    const mockDeleted = {
      id: 6,
      merchant_id: merchantId,
      token_id: tokenId,
      is_enabled: true,
      is_deleted: true,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: new Date(),
    };

    mockPrisma.merchantPaymentMethod.update.mockResolvedValue(mockDeleted);

    const deleted = await paymentMethodService.softDelete(6);

    expect(deleted.is_deleted).toBe(true);
    expect(deleted.deleted_at).toBeDefined();
    expect(mockPrisma.merchantPaymentMethod.update).toHaveBeenCalledOnce();
  });

  it('should return null for non-existent payment method', async () => {
    mockPrisma.merchantPaymentMethod.findFirst.mockResolvedValue(null);

    const result = await paymentMethodService.findById(999999);
    expect(result).toBeNull();
  });

  it('should exclude deleted payment methods from findAll', async () => {
    const tokenId1 = createMockTokenId();
    const mockMethods = [
      {
        id: 7,
        merchant_id: merchantId,
        token_id: tokenId1,
        is_enabled: true,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ];

    // Only non-deleted methods should be returned
    mockPrisma.merchantPaymentMethod.findMany.mockResolvedValue(mockMethods);

    const result = await paymentMethodService.findAllForMerchant(merchantId);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(7);
    expect(mockPrisma.merchantPaymentMethod.findMany).toHaveBeenCalledOnce();
  });

  it('should find payment method by merchant and token including deleted', async () => {
    const tokenId = createMockTokenId();
    const mockMethod = {
      id: 8,
      merchant_id: merchantId,
      token_id: tokenId,
      is_enabled: false,
      is_deleted: true,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: new Date(),
    };

    mockPrisma.merchantPaymentMethod.findFirst.mockResolvedValue(mockMethod);

    const result = await paymentMethodService.findByMerchantAndTokenIncludingDeleted(
      merchantId,
      tokenId
    );

    expect(result).toBeDefined();
    expect(result?.id).toBe(8);
    expect(result?.is_deleted).toBe(true);
    expect(mockPrisma.merchantPaymentMethod.findFirst).toHaveBeenCalledOnce();
  });

  it('should restore a soft-deleted payment method', async () => {
    const tokenId = createMockTokenId();
    const mockRestored = {
      id: 9,
      merchant_id: merchantId,
      token_id: tokenId,
      is_enabled: true,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    mockPrisma.merchantPaymentMethod.update.mockResolvedValue(mockRestored);

    const result = await paymentMethodService.restore(9, {
      is_enabled: true,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(9);
    expect(result.is_deleted).toBe(false);
    expect(result.deleted_at).toBeNull();
    expect(mockPrisma.merchantPaymentMethod.update).toHaveBeenCalledOnce();
  });

  describe('enrichPaymentMethods', () => {
    it('should return empty array for empty input', async () => {
      const mockTokenService = {
        findByIds: vi.fn().mockResolvedValue([]),
      };
      const mockChainService = {
        findByIds: vi.fn().mockResolvedValue([]),
      };

      const result = await paymentMethodService.enrichPaymentMethods(
        [],
        mockTokenService as unknown as import('../token.service').TokenService,
        mockChainService as unknown as import('../chain.service').ChainService
      );

      expect(result).toEqual([]);
      expect(mockTokenService.findByIds).not.toHaveBeenCalled();
    });

    it('should enrich payment methods with token and chain data', async () => {
      const tokenId = createMockTokenId();
      const chainId = 1;
      const mockPaymentMethods = [
        {
          id: 10,
          merchant_id: merchantId,
          token_id: tokenId,
          is_enabled: true,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];

      const mockTokens = [
        {
          id: tokenId,
          chain_id: chainId,
          address: '0xTokenAddress',
          symbol: 'USDC',
          decimals: 6,
          is_enabled: true,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];

      const mockChains = [
        {
          id: chainId,
          network_id: 31337,
          name: 'Hardhat',
          is_testnet: true,
          is_enabled: true,
          is_deleted: false,
          rpc_url: 'http://localhost:8545',
          gateway_address: '0xGateway',
          forwarder_address: '0xForwarder',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];

      const mockTokenService = {
        findByIds: vi.fn().mockResolvedValue(mockTokens),
      };
      const mockChainService = {
        findByIds: vi.fn().mockResolvedValue(mockChains),
      };

      const result = await paymentMethodService.enrichPaymentMethods(
        mockPaymentMethods,
        mockTokenService as unknown as import('../token.service').TokenService,
        mockChainService as unknown as import('../chain.service').ChainService
      );

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(10);
      expect(result[0].token.symbol).toBe('USDC');
      expect(result[0].token.decimals).toBe(6);
      expect(result[0].chain.network_id).toBe(31337);
      expect(result[0].chain.name).toBe('Hardhat');
    });

    it('should skip payment methods with missing token', async () => {
      const tokenId = createMockTokenId();
      const mockPaymentMethods = [
        {
          id: 11,
          merchant_id: merchantId,
          token_id: tokenId,
          is_enabled: true,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];

      const mockTokenService = {
        findByIds: vi.fn().mockResolvedValue([]), // No tokens found
      };
      const mockChainService = {
        findByIds: vi.fn().mockResolvedValue([]),
      };

      const result = await paymentMethodService.enrichPaymentMethods(
        mockPaymentMethods,
        mockTokenService as unknown as import('../token.service').TokenService,
        mockChainService as unknown as import('../chain.service').ChainService
      );

      expect(result.length).toBe(0);
    });

    it('should skip payment methods with missing chain', async () => {
      const tokenId = createMockTokenId();
      const chainId = 999;
      const mockPaymentMethods = [
        {
          id: 12,
          merchant_id: merchantId,
          token_id: tokenId,
          is_enabled: true,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];

      const mockTokens = [
        {
          id: tokenId,
          chain_id: chainId,
          address: '0xTokenAddress',
          symbol: 'USDC',
          decimals: 6,
          is_enabled: true,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];

      const mockTokenService = {
        findByIds: vi.fn().mockResolvedValue(mockTokens),
      };
      const mockChainService = {
        findByIds: vi.fn().mockResolvedValue([]), // No chains found
      };

      const result = await paymentMethodService.enrichPaymentMethods(
        mockPaymentMethods,
        mockTokenService as unknown as import('../token.service').TokenService,
        mockChainService as unknown as import('../chain.service').ChainService
      );

      expect(result.length).toBe(0);
    });
  });
});
