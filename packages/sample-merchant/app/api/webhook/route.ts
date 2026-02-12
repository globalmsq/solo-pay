import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_API_URL = process.env.GATEWAY_API_URL || 'http://localhost:3001';
const API_KEY = process.env.SOLO_PAY_API_KEY || '';

interface GatewayPaymentResponse {
  paymentId: string;
  orderId?: string;
  status: string;
  amount: string; // wei
  tokenSymbol: string;
  tokenDecimals: number;
  txHash?: string;
  confirmedAt?: string;
}

/**
 * Verify payment by calling gateway API directly
 */
async function verifyPaymentWithGateway(orderId: string): Promise<GatewayPaymentResponse | null> {
  try {
    const response = await fetch(
      `${GATEWAY_API_URL}/payments?orderId=${encodeURIComponent(orderId)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    return (await response.json()) as GatewayPaymentResponse;
  } catch (error) {
    console.error('[webhook] Gateway request failed:', error);
    return null;
  }
}

// Receive payment status updates from gateway webhook-manager
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 });
    }

    // 1. Find local payment record
    const localPayment = await prisma.payment.findUnique({
      where: { id: Number(orderId) },
    });

    if (!localPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // 2. Verify with gateway API (source of truth)
    const gatewayPayment = await verifyPaymentWithGateway(orderId);

    if (!gatewayPayment) {
      console.error(`[webhook] Gateway verification failed for orderId=${orderId}`);
      return NextResponse.json({ error: 'Gateway verification failed' }, { status: 502 });
    }

    // 3. Verify status is actually CONFIRMED
    if (gatewayPayment.status !== 'CONFIRMED') {
      console.error(
        `[webhook] Gateway status mismatch: expected CONFIRMED, got ${gatewayPayment.status}`
      );
      return NextResponse.json({ error: 'Payment not confirmed on gateway' }, { status: 400 });
    }

    // 4. Verify amount matches (convert gateway wei → human amount)
    const gatewayAmount =
      Number(BigInt(gatewayPayment.amount)) / 10 ** gatewayPayment.tokenDecimals;
    const localAmount = Number(localPayment.amount);

    if (gatewayAmount !== localAmount) {
      console.error(`[webhook] Amount mismatch: local=${localAmount}, gateway=${gatewayAmount}`);
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // 5. All checks passed — update local DB
    await prisma.payment.update({
      where: { id: Number(orderId) },
      data: {
        status: 'CONFIRMED',
        tx_hash: gatewayPayment.txHash ?? null,
        confirmed_at: gatewayPayment.confirmedAt
          ? new Date(gatewayPayment.confirmedAt)
          : new Date(),
      },
    });

    console.log(`[webhook] Payment #${orderId} verified and confirmed`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
