import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../db/__mocks__/client';
import { Decimal } from '@prisma/client/runtime/library';
import { RefundStatus } from '@prisma/client';

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

import { RefundService } from '../refund.service';

describe('RefundService', () => {
  let refundService: RefundService;
  const merchantId = 1;
  const paymentId = 1;

  beforeEach(() => {
    resetPrismaMocks();
    refundService = new RefundService(mockPrisma);
  });

  describe('create', () => {
    it('should create a new refund', async () => {
      const refundHash = '0x' + 'a'.repeat(64);
      const createInput = {
        refund_hash: refundHash,
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        reason: 'Customer requested refund',
      };

      const mockResult = {
        id: 1,
        ...createInput,
        status: RefundStatus.PENDING,
        tx_hash: null,
        error_message: null,
        submitted_at: null,
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrisma.refund.create.mockResolvedValue(mockResult);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 1,
        payment_id: paymentId,
        event_type: 'REFUND_REQUESTED',
        old_status: null,
        new_status: null,
        metadata: { refund_hash: refundHash, amount: '1000000000000000000' },
        created_at: new Date(),
      });

      const result = await refundService.create(createInput);

      expect(result).toBeDefined();
      expect(result.refund_hash).toBe(refundHash);
      expect(result.status).toBe('PENDING');
      expect(result.reason).toBe('Customer requested refund');
      expect(mockPrisma.refund.create).toHaveBeenCalledOnce();
      expect(mockPrisma.paymentEvent.create).toHaveBeenCalledOnce();
    });

    it('should create refund without reason', async () => {
      const refundHash = '0x' + 'b'.repeat(64);
      const createInput = {
        refund_hash: refundHash,
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('2000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const mockResult = {
        id: 2,
        ...createInput,
        reason: null,
        status: RefundStatus.PENDING,
        tx_hash: null,
        error_message: null,
        submitted_at: null,
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrisma.refund.create.mockResolvedValue(mockResult);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 2,
        payment_id: paymentId,
        event_type: 'REFUND_REQUESTED',
        old_status: null,
        new_status: null,
        metadata: { refund_hash: refundHash, amount: '2000000000000000000' },
        created_at: new Date(),
      });

      const result = await refundService.create(createInput);

      expect(result.reason).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find refund by id', async () => {
      const mockRefund = {
        id: 1,
        refund_hash: '0x' + 'c'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.PENDING,
        reason: null,
        tx_hash: null,
        error_message: null,
        submitted_at: null,
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrisma.refund.findUnique.mockResolvedValue(mockRefund);

      const result = await refundService.findById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(mockPrisma.refund.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null when refund not found', async () => {
      mockPrisma.refund.findUnique.mockResolvedValue(null);

      const result = await refundService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByHash', () => {
    it('should find refund by hash', async () => {
      const refundHash = '0x' + 'd'.repeat(64);
      const mockRefund = {
        id: 2,
        refund_hash: refundHash,
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.CONFIRMED,
        reason: null,
        tx_hash: '0x' + 'e'.repeat(64),
        error_message: null,
        submitted_at: new Date(),
        confirmed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrisma.refund.findUnique.mockResolvedValue(mockRefund);

      const result = await refundService.findByHash(refundHash);

      expect(result).toBeDefined();
      expect(result?.refund_hash).toBe(refundHash);
      expect(mockPrisma.refund.findUnique).toHaveBeenCalledWith({
        where: { refund_hash: refundHash },
      });
    });
  });

  describe('findByPaymentId', () => {
    it('should find all refunds for a payment', async () => {
      const mockRefunds = [
        {
          id: 1,
          refund_hash: '0x' + 'f'.repeat(64),
          payment_id: paymentId,
          merchant_id: merchantId,
          amount: new Decimal('500000000000000000'),
          token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          status: RefundStatus.FAILED,
          reason: 'First attempt',
          tx_hash: null,
          error_message: 'Network error',
          submitted_at: null,
          confirmed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          refund_hash: '0x' + 'g'.repeat(64),
          payment_id: paymentId,
          merchant_id: merchantId,
          amount: new Decimal('500000000000000000'),
          token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          status: RefundStatus.CONFIRMED,
          reason: 'Second attempt',
          tx_hash: '0x' + 'h'.repeat(64),
          error_message: null,
          submitted_at: new Date(),
          confirmed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrisma.refund.findMany.mockResolvedValue(mockRefunds);

      const result = await refundService.findByPaymentId(paymentId);

      expect(result.length).toBe(2);
      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith({
        where: { payment_id: paymentId },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update refund to SUBMITTED status', async () => {
      const mockExisting = {
        id: 1,
        refund_hash: '0x' + 'i'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.PENDING,
        reason: null,
        tx_hash: null,
        error_message: null,
        submitted_at: null,
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const txHash = '0x' + 'j'.repeat(64);
      const mockUpdated = {
        ...mockExisting,
        status: RefundStatus.SUBMITTED,
        tx_hash: txHash,
        submitted_at: new Date(),
      };

      mockPrisma.refund.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.refund.update.mockResolvedValue(mockUpdated);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 3,
        payment_id: paymentId,
        event_type: 'REFUND_SUBMITTED',
        old_status: null,
        new_status: null,
        metadata: { refund_hash: mockExisting.refund_hash, tx_hash: txHash },
        created_at: new Date(),
      });

      const result = await refundService.updateStatus(1, 'SUBMITTED', { tx_hash: txHash });

      expect(result.status).toBe('SUBMITTED');
      expect(result.tx_hash).toBe(txHash);
      expect(result.submitted_at).toBeDefined();
      expect(mockPrisma.paymentEvent.create).toHaveBeenCalledOnce();
    });

    it('should update refund to CONFIRMED status', async () => {
      const txHash = '0x' + 'k'.repeat(64);
      const mockExisting = {
        id: 2,
        refund_hash: '0x' + 'l'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.SUBMITTED,
        reason: null,
        tx_hash: txHash,
        error_message: null,
        submitted_at: new Date(),
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdated = {
        ...mockExisting,
        status: RefundStatus.CONFIRMED,
        confirmed_at: new Date(),
      };

      mockPrisma.refund.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.refund.update.mockResolvedValue(mockUpdated);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 4,
        payment_id: paymentId,
        event_type: 'REFUND_CONFIRMED',
        old_status: null,
        new_status: null,
        metadata: { refund_hash: mockExisting.refund_hash },
        created_at: new Date(),
      });

      const result = await refundService.updateStatus(2, 'CONFIRMED');

      expect(result.status).toBe('CONFIRMED');
      expect(result.confirmed_at).toBeDefined();
    });

    it('should update refund to FAILED status with error message', async () => {
      const mockExisting = {
        id: 3,
        refund_hash: '0x' + 'm'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.SUBMITTED,
        reason: null,
        tx_hash: '0x' + 'n'.repeat(64),
        error_message: null,
        submitted_at: new Date(),
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const errorMessage = 'Transaction reverted: insufficient balance';
      const mockUpdated = {
        ...mockExisting,
        status: RefundStatus.FAILED,
        error_message: errorMessage,
      };

      mockPrisma.refund.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.refund.update.mockResolvedValue(mockUpdated);
      mockPrisma.paymentEvent.create.mockResolvedValue({
        id: 5,
        payment_id: paymentId,
        event_type: 'REFUND_FAILED',
        old_status: null,
        new_status: null,
        metadata: { refund_hash: mockExisting.refund_hash, error_message: errorMessage },
        created_at: new Date(),
      });

      const result = await refundService.updateStatus(3, 'FAILED', {
        error_message: errorMessage,
      });

      expect(result.status).toBe('FAILED');
      expect(result.error_message).toBe(errorMessage);
    });

    it('should throw error when refund not found', async () => {
      mockPrisma.refund.findUnique.mockResolvedValue(null);

      await expect(refundService.updateStatus(999, 'CONFIRMED')).rejects.toThrow(
        'Refund not found'
      );
    });
  });

  describe('hasActiveRefund', () => {
    it('should return true when PENDING refund exists', async () => {
      mockPrisma.refund.findFirst.mockResolvedValue({
        id: 1,
        refund_hash: '0x' + 'o'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.PENDING,
        reason: null,
        tx_hash: null,
        error_message: null,
        submitted_at: null,
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await refundService.hasActiveRefund(paymentId);

      expect(result).toBe(true);
      expect(mockPrisma.refund.findFirst).toHaveBeenCalledWith({
        where: {
          payment_id: paymentId,
          status: { in: ['PENDING', 'SUBMITTED'] },
        },
      });
    });

    it('should return true when SUBMITTED refund exists', async () => {
      mockPrisma.refund.findFirst.mockResolvedValue({
        id: 2,
        refund_hash: '0x' + 'p'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.SUBMITTED,
        reason: null,
        tx_hash: '0x' + 'q'.repeat(64),
        error_message: null,
        submitted_at: new Date(),
        confirmed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await refundService.hasActiveRefund(paymentId);

      expect(result).toBe(true);
    });

    it('should return false when no active refund exists', async () => {
      mockPrisma.refund.findFirst.mockResolvedValue(null);

      const result = await refundService.hasActiveRefund(paymentId);

      expect(result).toBe(false);
    });
  });

  describe('hasCompletedRefund', () => {
    it('should return true when CONFIRMED refund exists', async () => {
      mockPrisma.refund.findFirst.mockResolvedValue({
        id: 1,
        refund_hash: '0x' + 'r'.repeat(64),
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: new Decimal('1000000000000000000'),
        token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: RefundStatus.CONFIRMED,
        reason: null,
        tx_hash: '0x' + 's'.repeat(64),
        error_message: null,
        submitted_at: new Date(),
        confirmed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await refundService.hasCompletedRefund(paymentId);

      expect(result).toBe(true);
      expect(mockPrisma.refund.findFirst).toHaveBeenCalledWith({
        where: {
          payment_id: paymentId,
          status: 'CONFIRMED',
        },
      });
    });

    it('should return false when no confirmed refund exists', async () => {
      mockPrisma.refund.findFirst.mockResolvedValue(null);

      const result = await refundService.hasCompletedRefund(paymentId);

      expect(result).toBe(false);
    });
  });

  describe('findByMerchant', () => {
    it('should return paginated refunds for merchant', async () => {
      const mockRefunds = [
        {
          id: 1,
          refund_hash: '0x' + 't'.repeat(64),
          payment_id: 1,
          merchant_id: merchantId,
          amount: new Decimal('1000000000000000000'),
          token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          payer_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          status: RefundStatus.CONFIRMED,
          reason: null,
          tx_hash: '0x' + 'u'.repeat(64),
          error_message: null,
          submitted_at: new Date(),
          confirmed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          refund_hash: '0x' + 'v'.repeat(64),
          payment_id: 2,
          merchant_id: merchantId,
          amount: new Decimal('2000000000000000000'),
          token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          payer_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          status: RefundStatus.PENDING,
          reason: 'Duplicate payment',
          tx_hash: null,
          error_message: null,
          submitted_at: null,
          confirmed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrisma.refund.findMany.mockResolvedValue(mockRefunds);
      mockPrisma.refund.count.mockResolvedValue(2);

      const result = await refundService.findByMerchant(merchantId, {
        page: 1,
        limit: 20,
      });

      expect(result.items.length).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.refund.findMany.mockResolvedValue([]);
      mockPrisma.refund.count.mockResolvedValue(0);

      await refundService.findByMerchant(merchantId, {
        page: 1,
        limit: 20,
        status: 'CONFIRMED',
      });

      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchant_id: merchantId,
            status: 'CONFIRMED',
          }),
        })
      );
    });

    it('should filter by paymentId', async () => {
      const paymentHash = '0x' + 'w'.repeat(64);

      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 5,
        payment_hash: paymentHash,
        merchant_id: merchantId,
        payment_method_id: 1,
        amount: new Decimal('1000000000000000000'),
        token_decimals: 18,
        token_symbol: 'TEST',
        network_id: 31337,
        status: 'CONFIRMED',
        tx_hash: null,
        expires_at: new Date(),
        confirmed_at: new Date(),
        order_id: null,
        success_url: null,
        fail_url: null,
        webhook_url: null,
        origin: null,
        payer_address: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockPrisma.refund.findMany.mockResolvedValue([]);
      mockPrisma.refund.count.mockResolvedValue(0);

      await refundService.findByMerchant(merchantId, {
        page: 1,
        limit: 20,
        paymentId: paymentHash,
      });

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { payment_hash: paymentHash },
        select: { id: true },
      });
      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchant_id: merchantId,
            payment_id: 5,
          }),
        })
      );
    });

    it('should return empty result when payment not found for paymentId filter', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const result = await refundService.findByMerchant(merchantId, {
        page: 1,
        limit: 20,
        paymentId: '0x' + 'x'.repeat(64),
      });

      expect(result.items.length).toBe(0);
      expect(result.pagination.total).toBe(0);
      expect(mockPrisma.refund.findMany).not.toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.refund.findMany.mockResolvedValue([]);
      mockPrisma.refund.count.mockResolvedValue(100);

      const result = await refundService.findByMerchant(merchantId, {
        page: 3,
        limit: 20,
      });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.totalPages).toBe(5);
      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        })
      );
    });
  });
});
