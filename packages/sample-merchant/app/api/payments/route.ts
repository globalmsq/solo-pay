import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

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

    const payment = await prisma.payment.create({
      data: {
        product_id: Number(productId),
        amount: price,
        token_symbol: tokenSymbol,
      },
    });

    return NextResponse.json({ paymentId: payment.id });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
