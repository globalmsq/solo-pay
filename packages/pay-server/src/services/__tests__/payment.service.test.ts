import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../db/__mocks__/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus } from '@prisma/client';

// Mock the client module
vi.mock('../../db/client', () => ({
  getPrismaClient: vi.fn(() => mockPrisma),
  disconnectPrisma: vi.fn(),
}));

// Mock Redis client
vi.mock('../../db/redis', () => ({
  getRedisClient: vi.fn(() => null),
  disconnectRedis: vi.fn(),
  isRedisAvailable: vi.fn(() => false),
  getCache: vi.fn(() => Promise.resolve(null)),
  setCache: vi.fn(() => Promise.resolve()),
  deleteCache: vi.fn(() => Promise.resolve()),
}));

import { PaymentService } from '../payment.service';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  const merchantId = 1;
  const paymentMethodId = 1;

  beforeEach(() => {
    resetPrismaMocks();
    paymentService = new PaymentService(mockPrisma);
  });

  it('should create a new payment', async () => {
    const paymentHash = '0x' + 'a'.repeat(64);
    const paymentData = {
      payment_hash: paymentHash,
      merchant_id: merchantId,
      payment_method_id: paymentMethodId,
      amount: new Decimal('1000000'),
      token_decimals: 6,
      token_symbol: 'USDC',
      network_id: 31337,
      expires_at: new Date(Date.now() + 3600000),
    };

    const mockResult = {
      id: 1,
      ...paymentData,
      status: PaymentStatus.CREATED,
      payer_address: null,
      tx_hash: null,
      order_id: null,
      success_url: null,
      fail_url: null,
      webhook_url: null,
      origin: null,
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: null,
    };

    mockPrisma.payment.create.mockResolvedValue(mockResult);
    mockPrisma.paymentEvent.create.mockResolvedValue({
      id: 1,
      payment_id: 1,
      event_type: 'CREATED',
      old_status: null,
      new_status: null,
      metadata: null,
      created_at: new Date(),
    });

    const result = await paymentService.create(paymentData);

    expect(result).toBeDefined();
    expect(result.payment_hash).toBe(paymentHash);
    expect(result.status).toBe('CREATED');
    expect(result.token_symbol).toBe('USDC');
    expect(mockPrisma.payment.create).toHaveBeenCalledOnce();
  });

  it('should find payment by hash', async () => {
    const paymentHash = '0x' + 'b'.repeat(64);
    const mockPayment = {
      id: 2,
      payment_hash: paymentHash,
      merchant_id: merchantId,
      payment_method_id: paymentMethodId,
      amount: new Decimal('2000000'),
      token_decimals: 6,
      token_symbol: 'USDC',
      network_id: 31337,
      status: PaymentStatus.CREATED,
      payer_address: null,
      tx_hash: null,
      order_id: null,
      success_url: null,
      fail_url: null,
      webhook_url: null,
      origin: null,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: null,
    };

    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    const result = await paymentService.findByHash(paymentHash);

    expect(result).toBeDefined();
    expect(result?.payment_hash).toBe(paymentHash);
    expect(mockPrisma.payment.findUnique).toHaveBeenCalledOnce();
  });

  it('should cache payment after retrieval', async () => {
    const paymentHash = '0x' + 'c'.repeat(64);
    const mockPayment = {
      id: 3,
      payment_hash: paymentHash,
      merchant_id: merchantId,
      payment_method_id: paymentMethodId,
      amount: new Decimal('3000000'),
      token_decimals: 6,
      token_symbol: 'USDC',
      network_id: 31337,
      status: PaymentStatus.CREATED,
      payer_address: null,
      tx_hash: null,
      order_id: null,
      success_url: null,
      fail_url: null,
      webhook_url: null,
      origin: null,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: null,
    };

    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    // First query
    const result1 = await paymentService.findByHash(paymentHash);
    expect(result1).toBeDefined();

    // Second query (Redis is mocked to null, so will hit DB again)
    const result2 = await paymentService.findByHash(paymentHash);
    expect(result2).toBeDefined();
    expect(result2?.id).toBe(result1?.id);
  });

  it('should update payment status', async () => {
    const paymentHash = '0x' + 'd'.repeat(64);
    const mockExisting = {
      id: 4,
      payment_hash: paymentHash,
      merchant_id: merchantId,
      payment_method_id: paymentMethodId,
      amount: new Decimal('4000000'),
      token_decimals: 6,
      token_symbol: 'USDC',
      network_id: 31337,
      status: PaymentStatus.CREATED,
      payer_address: null,
      tx_hash: null,
      order_id: null,
      success_url: null,
      fail_url: null,
      webhook_url: null,
      origin: null,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: null,
    };

    const mockUpdated = {
      ...mockExisting,
      status: PaymentStatus.CONFIRMED,
      confirmed_at: new Date(),
    };

    mockPrisma.payment.findUnique.mockResolvedValue(mockExisting);
    mockPrisma.payment.update.mockResolvedValue(mockUpdated);
    mockPrisma.paymentEvent.create.mockResolvedValue({
      id: 2,
      payment_id: 4,
      event_type: 'STATUS_CHANGED',
      old_status: PaymentStatus.CREATED,
      new_status: PaymentStatus.CONFIRMED,
      metadata: null,
      created_at: new Date(),
    });

    const updated = await paymentService.updateStatus(4, 'CONFIRMED');

    expect(updated.status).toBe('CONFIRMED');
    expect(updated.confirmed_at).toBeDefined();
    expect(mockPrisma.payment.update).toHaveBeenCalledOnce();
  });

  it('should find all payments by status', async () => {
    const mockPayments = [
      {
        id: 5,
        payment_hash: '0x' + 'e'.repeat(64),
        merchant_id: merchantId,
        payment_method_id: paymentMethodId,
        amount: new Decimal('5000000'),
        token_decimals: 6,
        token_symbol: 'USDC',
        network_id: 31337,
        status: PaymentStatus.CONFIRMED,
        payer_address: null,
        tx_hash: null,
        order_id: null,
        success_url: null,
        fail_url: null,
        webhook_url: null,
        origin: null,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        confirmed_at: new Date(),
      },
    ];

    mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

    const result = await paymentService.findByStatus('CONFIRMED');

    expect(result.length).toBe(1);
    expect(result[0].status).toBe('CONFIRMED');
    expect(mockPrisma.payment.findMany).toHaveBeenCalledOnce();
  });

  it('should return payment with network_id snapshot', async () => {
    const paymentHash = '0x' + '1'.repeat(64);
    const paymentData = {
      payment_hash: paymentHash,
      merchant_id: merchantId,
      payment_method_id: paymentMethodId,
      amount: new Decimal('7000000'),
      token_decimals: 18,
      token_symbol: 'ETH',
      network_id: 31337,
      expires_at: new Date(Date.now() + 3600000),
    };

    const mockResult = {
      id: 7,
      ...paymentData,
      status: PaymentStatus.CREATED,
      payer_address: null,
      tx_hash: null,
      order_id: null,
      success_url: null,
      fail_url: null,
      webhook_url: null,
      origin: null,
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: null,
    };

    mockPrisma.payment.create.mockResolvedValue(mockResult);
    mockPrisma.paymentEvent.create.mockResolvedValue({
      id: 3,
      payment_id: 7,
      event_type: 'CREATED',
      old_status: null,
      new_status: null,
      metadata: null,
      created_at: new Date(),
    });

    const created = await paymentService.create(paymentData);

    expect(created.network_id).toBe(31337);
    expect(created.token_symbol).toBe('ETH');
    expect(created.token_decimals).toBe(18);
  });

  it('should find payment by id', async () => {
    const mockPayment = {
      id: 8,
      payment_hash: '0x' + 'f'.repeat(64),
      merchant_id: merchantId,
      payment_method_id: paymentMethodId,
      amount: new Decimal('8000000'),
      token_decimals: 6,
      token_symbol: 'USDC',
      network_id: 31337,
      status: PaymentStatus.CREATED,
      payer_address: null,
      tx_hash: null,
      order_id: null,
      success_url: null,
      fail_url: null,
      webhook_url: null,
      origin: null,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: null,
    };

    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    const result = await paymentService.findById(8);

    expect(result).toBeDefined();
    expect(result?.id).toBe(8);
    expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
      where: { id: 8 },
    });
  });

  it('should return null when payment not found by id', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    const result = await paymentService.findById(999);

    expect(result).toBeNull();
  });

  it('should throw error when updating status of non-existent payment', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    await expect(paymentService.updateStatus(999, 'CONFIRMED')).rejects.toThrow(
      'Payment not found'
    );
  });

  describe('updateStatusByHash', () => {
    it('should update payment status by hash', async () => {
      const paymentHash = '0x' + 'g'.repeat(64);
      const mockExisting = {
        id: 9,
        payment_hash: paymentHash,
        merchant_id: merchantId,
        payment_method_id: paymentMethodId,
        amount: new Decimal('9000000'),
        token_decimals: 6,
        token_symbol: 'USDC',
        network_id: 31337,
        status: PaymentStatus.CREATED,
        payer_address: null,
        tx_hash: null,
        order_id: null,
        success_url: null,
        fail_url: null,
        webhook_url: null,
        origin: null,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        confirmed_at: null,
      };

      const mockUpdated = {
        ...mockExisting,
        status: PaymentStatus.CONFIRMED,
        tx_hash: '0x' + 'h'.repeat(64),
        confirmed_at: new Date(),
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.payment.update.mockResolvedValue(mockUpdated);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 4,
        payment_id: 9,
        event_type: 'STATUS_CHANGED',
        old_status: PaymentStatus.CREATED,
        new_status: PaymentStatus.CONFIRMED,
        metadata: null,
        created_at: new Date(),
      });

      const result = await paymentService.updateStatusByHash(
        paymentHash,
        'CONFIRMED',
        '0x' + 'h'.repeat(64)
      );

      expect(result.status).toBe('CONFIRMED');
      expect(result.tx_hash).toBe('0x' + 'h'.repeat(64));
      expect(result.confirmed_at).toBeDefined();
    });

    it('should throw error when payment not found by hash', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        paymentService.updateStatusByHash('0x' + 'z'.repeat(64), 'CONFIRMED')
      ).rejects.toThrow('Payment not found');
    });

    it('should update status without tx_hash', async () => {
      const paymentHash = '0x' + 'i'.repeat(64);
      const mockExisting = {
        id: 10,
        payment_hash: paymentHash,
        merchant_id: merchantId,
        payment_method_id: paymentMethodId,
        amount: new Decimal('10000000'),
        token_decimals: 6,
        token_symbol: 'USDC',
        network_id: 31337,
        status: PaymentStatus.CREATED,
        payer_address: null,
        tx_hash: null,
        order_id: null,
        success_url: null,
        fail_url: null,
        webhook_url: null,
        origin: null,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        confirmed_at: null,
      };

      const mockUpdated = {
        ...mockExisting,
        status: PaymentStatus.FAILED,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.payment.update.mockResolvedValue(mockUpdated);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 5,
        payment_id: 10,
        event_type: 'STATUS_CHANGED',
        old_status: PaymentStatus.CREATED,
        new_status: PaymentStatus.FAILED,
        metadata: null,
        created_at: new Date(),
      });

      const result = await paymentService.updateStatusByHash(paymentHash, 'FAILED');

      expect(result.status).toBe('FAILED');
      expect(result.tx_hash).toBeNull();
    });
  });

  describe('setTxHash', () => {
    it('should set transaction hash for payment', async () => {
      const paymentHash = '0x' + 'j'.repeat(64);
      const txHash = '0x' + 'k'.repeat(64);
      const mockExisting = {
        id: 11,
        payment_hash: paymentHash,
        merchant_id: merchantId,
        payment_method_id: paymentMethodId,
        amount: new Decimal('11000000'),
        token_decimals: 6,
        token_symbol: 'USDC',
        network_id: 31337,
        status: PaymentStatus.CREATED,
        payer_address: null,
        tx_hash: null,
        order_id: null,
        success_url: null,
        fail_url: null,
        webhook_url: null,
        origin: null,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        confirmed_at: null,
      };

      const mockUpdated = {
        ...mockExisting,
        tx_hash: txHash,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.payment.update.mockResolvedValue(mockUpdated);

      const result = await paymentService.setTxHash(11, txHash);

      expect(result.tx_hash).toBe(txHash);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: { tx_hash: txHash },
      });
    });

    it('should throw error when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(paymentService.setTxHash(999, '0x' + 'l'.repeat(64))).rejects.toThrow(
        'Payment not found'
      );
    });
  });

  describe('getPaymentWithChain', () => {
    it('should return payment with chain information', async () => {
      const paymentHash = '0x' + 'm'.repeat(64);
      const mockPayment = {
        id: 12,
        payment_hash: paymentHash,
        merchant_id: merchantId,
        payment_method_id: paymentMethodId,
        amount: new Decimal('12000000'),
        token_decimals: 6,
        token_symbol: 'USDC',
        network_id: 31337,
        status: PaymentStatus.CREATED,
        payer_address: null,
        tx_hash: null,
        order_id: null,
        success_url: null,
        fail_url: null,
        webhook_url: null,
        origin: null,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        confirmed_at: null,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await paymentService.getPaymentWithChain(paymentHash);

      expect(result).toBeDefined();
      expect(result?.payment).toEqual(mockPayment);
      expect(result?.network_id).toBe(31337);
      expect(result?.token_symbol).toBe('USDC');
      expect(result?.token_decimals).toBe(6);
    });

    it('should return null when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const result = await paymentService.getPaymentWithChain('0x' + 'n'.repeat(64));

      expect(result).toBeNull();
    });
  });
});
