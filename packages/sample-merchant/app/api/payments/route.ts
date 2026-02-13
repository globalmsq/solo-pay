import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// TEST token decimals (hardcoded for sample merchant)
const TOKEN_DECIMALS = 18;

/** Convert human-readable token amount to wei string (e.g. 25.0 → "25000000000000000000") */
function toWei(amount: number, decimals: number): string {
  const [intPart, decPart = ''] = amount.toString().split('.');
  const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(intPart + paddedDec).toString();
}

// Create a payment record in sample-merchant DB before opening the widget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, price, tokenSymbol } = body;

    if (!productId || !price || !tokenSymbol) {
      return NextResponse.json(
        { error: 'productId, price, and tokenSymbol are required' },
        { status: 400 }
      );
    }

    const amountWei = toWei(Number(price), TOKEN_DECIMALS);

    const payment = await prisma.payment.create({
      data: {
        product_id: Number(productId),
        amount: amountWei,
        token_symbol: tokenSymbol,
      },
    });

    return NextResponse.json({ paymentId: payment.id });
  } catch (error) {
    console.error('[payments] Failed to create payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
