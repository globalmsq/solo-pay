import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PaymentMethodService } from '../payment-method.service';
import { ChainService } from '../chain.service';
import { TokenService } from '../token.service';
import { MerchantService } from '../merchant.service';
import { getPrismaClient, disconnectPrisma } from '../../db/client';

describe('PaymentMethodService', () => {
  let paymentMethodService: PaymentMethodService;
  let merchantService: MerchantService;
  let tokenService: TokenService;
  let chainService: ChainService;
  let prisma: ReturnType<typeof getPrismaClient>;
  let merchantId: string;
  let tokenId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    paymentMethodService = new PaymentMethodService(prisma);
    merchantService = new MerchantService(prisma);
    tokenService = new TokenService(prisma);
    chainService = new ChainService(prisma);

    // Clean up before tests
    await prisma.merchantPaymentMethod.deleteMany({});
    await prisma.token.deleteMany({});
    await prisma.merchant.deleteMany({});
    await prisma.chain.deleteMany({});

    // Create test merchant
    const merchant = await merchantService.create({
      merchant_key: 'test_merchant',
      name: 'Test Merchant',
      api_key: 'test_api_key',
    });
    merchantId = merchant.id;

    // Create test chain
    const chain = await chainService.create({
      network_id: 31337,
      name: 'Hardhat',
      rpc_url: 'http://localhost:8545',
      is_testnet: true,
    });

    // Create test token
    const token = await tokenService.create({
      chain_id: chain.id,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    });
    tokenId = token.id;
  });

  afterAll(async () => {
    // Clean up after tests
    await prisma.merchantPaymentMethod.deleteMany({});
    await prisma.token.deleteMany({});
    await prisma.merchant.deleteMany({});
    await prisma.chain.deleteMany({});
    await disconnectPrisma();
  });

  it('should create a new payment method', async () => {
    const methodData = {
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x742d35Cc6634C0532925a3b844Bc029e4b2A69e2',
    };

    const result = await paymentMethodService.create(methodData);

    expect(result).toBeDefined();
    expect(result.merchant_id).toBe(merchantId);
    expect(result.token_id).toBe(tokenId);
    expect(result.recipient_address).toBe('0x742d35Cc6634C0532925a3b844Bc029e4b2A69e2');
    expect(result.is_enabled).toBe(true);
    expect(result.is_deleted).toBe(false);
  });

  it('should find payment method by ID', async () => {
    const methodData = {
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    };

    const created = await paymentMethodService.create(methodData);
    const result = await paymentMethodService.findById(created.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(created.id);
  });

  it('should find payment method by merchant and token', async () => {
    const methodData = {
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x1234567890123456789012345678901234567890',
    };

    await paymentMethodService.create(methodData);

    const result = await paymentMethodService.findByMerchantAndToken(merchantId, tokenId);

    expect(result).toBeDefined();
    expect(result?.merchant_id).toBe(merchantId);
    expect(result?.token_id).toBe(tokenId);
  });

  it('should find all payment methods for merchant', async () => {
    await prisma.merchantPaymentMethod.deleteMany({});

    // Create a second merchant for comparison
    const merchant2 = await merchantService.create({
      merchant_key: 'test_merchant_2',
      name: 'Test Merchant 2',
      api_key: 'test_api_key_2',
    });

    await paymentMethodService.create({
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x111111111111111111111111111111111111',
    });

    await paymentMethodService.create({
      merchant_id: merchant2.id,
      token_id: tokenId,
      recipient_address: '0x222222222222222222222222222222222222',
    });

    const result = await paymentMethodService.findAllForMerchant(merchantId);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const methodIds = result.map((m) => m.merchant_id);
    expect(methodIds).toContain(merchantId);
    expect(methodIds).not.toContain(merchant2.id);
  });

  it('should update payment method', async () => {
    const methodData = {
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x333333333333333333333333333333333333',
    };

    const created = await paymentMethodService.create(methodData);

    const updated = await paymentMethodService.update(created.id, {
      recipient_address: '0x444444444444444444444444444444444444',
    });

    expect(updated.recipient_address).toBe('0x444444444444444444444444444444444444');
  });

  it('should soft delete payment method', async () => {
    const methodData = {
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x555555555555555555555555555555555555',
    };

    const created = await paymentMethodService.create(methodData);

    const deleted = await paymentMethodService.softDelete(created.id);

    expect(deleted.is_deleted).toBe(true);
    expect(deleted.deleted_at).toBeDefined();
  });

  it('should return null for non-existent payment method', async () => {
    const result = await paymentMethodService.findById('non_existent_id');
    expect(result).toBeNull();
  });

  it('should exclude deleted payment methods from findAll', async () => {
    await prisma.merchantPaymentMethod.deleteMany({});

    const method1 = await paymentMethodService.create({
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x666666666666666666666666666666666666',
    });

    const method2 = await paymentMethodService.create({
      merchant_id: merchantId,
      token_id: tokenId,
      recipient_address: '0x777777777777777777777777777777777777',
    });

    await paymentMethodService.softDelete(method2.id);

    const result = await paymentMethodService.findAllForMerchant(merchantId);

    const methodIds = result.map((m) => m.id);
    expect(methodIds).toContain(method1.id);
    expect(methodIds).not.toContain(method2.id);
  });
});
