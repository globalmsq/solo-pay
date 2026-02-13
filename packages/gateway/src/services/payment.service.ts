import { PrismaClient, Payment, PaymentStatus } from '@solo-pay/database';
import { Decimal } from '@solo-pay/database';
import { getCache, setCache, deleteCache } from '../db/redis';

export interface CreatePaymentInput {
  payment_hash: string;
  merchant_id: number;
  payment_method_id: number;
  amount: Decimal;
  token_decimals: number;
  token_symbol: string;
  network_id: number;
  expires_at: Date;
  order_id?: string;
  success_url?: string;
  fail_url?: string;
  webhook_url?: string;
  origin?: string;
}

export class PaymentService {
  constructor(private prisma: PrismaClient) {}

  private getCacheKey(paymentHash: string): string {
    return `payment:${paymentHash}`;
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    const payment = await this.prisma.payment.create({
      data: {
        payment_hash: input.payment_hash,
        merchant_id: input.merchant_id,
        payment_method_id: input.payment_method_id,
        amount: input.amount,
        token_decimals: input.token_decimals,
        token_symbol: input.token_symbol,
        network_id: input.network_id,
        status: 'CREATED' as PaymentStatus,
        expires_at: input.expires_at,
        order_id: input.order_id,
        success_url: input.success_url,
        fail_url: input.fail_url,
        webhook_url: input.webhook_url,
        origin: input.origin,
      },
    });

    // Create CREATED event
    await this.prisma.paymentEvent.create({
      data: {
        payment_id: payment.id,
        event_type: 'CREATED',
      },
    });

    return payment;
  }

  async findById(id: number): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async findByIds(ids: number[]): Promise<Payment[]> {
    if (ids.length === 0) return [];
    return this.prisma.payment.findMany({
      where: { id: { in: ids } },
    });
  }

  async findByHash(paymentHash: string): Promise<Payment | null> {
    const cacheKey = this.getCacheKey(paymentHash);

    // Try to get from cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const payment = await this.prisma.payment.findUnique({
      where: { payment_hash: paymentHash },
    });

    // Cache the result (TTL: 5 minutes)
    if (payment) {
      await setCache(cacheKey, JSON.stringify(payment), 300);
    }

    return payment;
  }

  async findByStatus(status: PaymentStatus, limit: number = 100): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { status },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async updateStatus(id: number, newStatus: PaymentStatus): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const oldStatus = payment.status;

    // Update payment
    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === 'CONFIRMED' && { confirmed_at: new Date() }),
      },
    });

    // Create status change event
    await this.prisma.paymentEvent.create({
      data: {
        payment_id: id,
        event_type: 'STATUS_CHANGED',
        old_status: oldStatus,
        new_status: newStatus,
      },
    });

    // Invalidate cache
    await deleteCache(this.getCacheKey(payment.payment_hash));

    return updatedPayment;
  }

  async updateStatusByHash(
    paymentHash: string,
    newStatus: PaymentStatus,
    txHash?: string
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { payment_hash: paymentHash },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const oldStatus = payment.status;

    // Update payment with status, optional tx_hash, and confirmed_at if CONFIRMED
    const updatedPayment = await this.prisma.payment.update({
      where: { payment_hash: paymentHash },
      data: {
        status: newStatus,
        ...(txHash && { tx_hash: txHash }),
        ...(newStatus === 'CONFIRMED' && { confirmed_at: new Date() }),
      },
    });

    // Create status change event
    await this.prisma.paymentEvent.create({
      data: {
        payment_id: payment.id,
        event_type: 'STATUS_CHANGED',
        old_status: oldStatus,
        new_status: newStatus,
      },
    });

    // Invalidate cache
    await deleteCache(this.getCacheKey(paymentHash));

    return updatedPayment;
  }

  async setTxHash(id: number, txHash: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { tx_hash: txHash },
    });

    // Invalidate cache
    await deleteCache(this.getCacheKey(payment.payment_hash));

    return updated;
  }

  async getPaymentWithChain(paymentHash: string): Promise<{
    payment: Payment;
    network_id: number;
    token_symbol: string;
    token_decimals: number;
  } | null> {
    const payment = await this.findByHash(paymentHash);
    if (!payment) {
      return null;
    }

    return {
      payment,
      network_id: payment.network_id,
      token_symbol: payment.token_symbol,
      token_decimals: payment.token_decimals,
    };
  }

  /**
   * Find payment by order_id and merchant_id (for client-side integration).
   */
  async findByOrderId(orderId: string, merchantId: number): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        order_id: orderId,
        merchant_id: merchantId,
      },
      orderBy: { created_at: 'desc' },
    });
    return payment;
  }

  /**
   * Update payer_address for a payment (by payment_hash).
   */
  async updatePayerAddress(paymentHash: string, payerAddress: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { payment_hash: paymentHash },
    });
    if (!payment) {
      throw new Error('Payment not found');
    }
    const updated = await this.prisma.payment.update({
      where: { payment_hash: paymentHash },
      data: { payer_address: payerAddress },
    });
    await deleteCache(this.getCacheKey(paymentHash));
    return updated;
  }
}
