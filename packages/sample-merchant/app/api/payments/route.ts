import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_BASE = (process.env.GATEWAY_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const GATEWAY_API_URL = `${GATEWAY_BASE}/api/v1`;
const API_KEY = process.env.SOLO_PAY_API_KEY || '';

/** Convert human-readable token amount to wei string (e.g. 25.0 → "25000000000000000000") */
function toWei(amount: number, decimals: number): string {
  const [intPart, decPart = ''] = amount.toString().split('.');
  const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(intPart + paddedDec).toString();
}

/** Fetch the first enabled payment method from gateway */
async function getFirstPaymentMethod(): Promise<{
  address: string;
  symbol: string;
  decimals: number;
} | null> {
  const response = await fetch(`${GATEWAY_API_URL}/merchant/payment-method`, {
    method: 'GET',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const enabled = data.payment_methods?.find(
    (pm: { is_enabled: boolean }) => pm.is_enabled
  );
  if (!enabled?.token) return null;

  return {
    address: enabled.token.address,
    symbol: enabled.token.symbol,
    decimals: enabled.token.decimals,
  };
}

// Create a payment record in sample-merchant DB before opening the widget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, price } = body;

    if (!productId || !price) {
      return NextResponse.json(
        { error: 'productId and price are required' },
        { status: 400 }
      );
    }

    const token = await getFirstPaymentMethod();
    if (!token) {
      return NextResponse.json(
        { error: 'No enabled payment method found' },
        { status: 502 }
      );
    }

    const amountWei = toWei(Number(price), token.decimals);

    const payment = await prisma.payment.create({
      data: {
        product_id: Number(productId),
        amount: amountWei,
        token_symbol: token.symbol,
      },
    });

    return NextResponse.json({
      paymentId: payment.id,
      tokenAddress: token.address,
    });
  } catch (error) {
    console.error('[payments] Failed to create payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
