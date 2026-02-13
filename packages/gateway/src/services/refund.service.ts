import { PrismaClient, Refund, RefundStatus } from '@solo-pay/database';
import { Decimal } from '@solo-pay/database';

export interface CreateRefundInput {
  refund_hash: string;
  payment_id: number;
  merchant_id: number;
  amount: Decimal;
  token_address: string;
  payer_address: string;
  reason?: string;
}

export interface RefundListOptions {
  page: number;
  limit: number;
  status?: RefundStatus;
  paymentId?: string;
}

export interface RefundListResult {
  items: Refund[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class RefundService {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateRefundInput): Promise<Refund> {
    const refund = await this.prisma.refund.create({
      data: {
        refund_hash: input.refund_hash,
        payment_id: input.payment_id,
        merchant_id: input.merchant_id,
        amount: input.amount,
        token_address: input.token_address,
        payer_address: input.payer_address,
        status: 'PENDING' as RefundStatus,
        reason: input.reason,
      },
    });

    // Create REFUND_REQUESTED event
    await this.prisma.paymentEvent.create({
      data: {
        payment_id: input.payment_id,
        event_type: 'REFUND_REQUESTED',
        metadata: {
          refund_hash: input.refund_hash,
          amount: input.amount.toString(),
        },
      },
    });

    return refund;
  }

  async findById(id: number): Promise<Refund | null> {
    return this.prisma.refund.findUnique({
      where: { id },
    });
  }

  async findByHash(refundHash: string): Promise<Refund | null> {
    return this.prisma.refund.findUnique({
      where: { refund_hash: refundHash },
    });
  }

  async findByPaymentId(paymentId: number): Promise<Refund[]> {
    return this.prisma.refund.findMany({
      where: { payment_id: paymentId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findByMerchant(merchantId: number, options: RefundListOptions): Promise<RefundListResult> {
    const { page, limit, status, paymentId } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      merchant_id: merchantId,
    };

    if (status) {
      where.status = status;
    }

    if (paymentId) {
      // Find payment by hash to get the payment_id
      const payment = await this.prisma.payment.findUnique({
        where: { payment_hash: paymentId },
        select: { id: true },
      });
      if (payment) {
        where.payment_id = payment.id;
      } else {
        // No matching payment, return empty result
        return {
          items: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(
    id: number,
    newStatus: RefundStatus,
    data?: { tx_hash?: string; error_message?: string }
  ): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
    });

    if (!refund) {
      throw new Error('Refund not found');
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (data?.tx_hash) {
      updateData.tx_hash = data.tx_hash;
    }

    if (data?.error_message) {
      updateData.error_message = data.error_message;
    }

    if (newStatus === 'SUBMITTED') {
      updateData.submitted_at = new Date();
    }

    if (newStatus === 'CONFIRMED') {
      updateData.confirmed_at = new Date();
    }

    const updatedRefund = await this.prisma.refund.update({
      where: { id },
      data: updateData,
    });

    // Create event based on status
    let eventType: 'REFUND_SUBMITTED' | 'REFUND_CONFIRMED' | 'REFUND_FAILED';
    switch (newStatus) {
      case 'SUBMITTED':
        eventType = 'REFUND_SUBMITTED';
        break;
      case 'CONFIRMED':
        eventType = 'REFUND_CONFIRMED';
        break;
      case 'FAILED':
        eventType = 'REFUND_FAILED';
        break;
      default:
        return updatedRefund;
    }

    await this.prisma.paymentEvent.create({
      data: {
        payment_id: refund.payment_id,
        event_type: eventType,
        metadata: {
          refund_hash: refund.refund_hash,
          tx_hash: data?.tx_hash,
          error_message: data?.error_message,
        },
      },
    });

    return updatedRefund;
  }

  async hasActiveRefund(paymentId: number): Promise<boolean> {
    const activeRefund = await this.prisma.refund.findFirst({
      where: {
        payment_id: paymentId,
        status: {
          in: ['PENDING', 'SUBMITTED'],
        },
      },
    });
    return !!activeRefund;
  }

  async hasCompletedRefund(paymentId: number): Promise<boolean> {
    const completedRefund = await this.prisma.refund.findFirst({
      where: {
        payment_id: paymentId,
        status: 'CONFIRMED',
      },
    });
    return !!completedRefund;
  }
}
