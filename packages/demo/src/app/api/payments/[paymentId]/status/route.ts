import { NextRequest, NextResponse } from 'next/server';
import { getSoloPayClient } from '@/lib/solo-pay-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const client = getSoloPayClient();
    const { paymentId } = await params;
    const result = await client.getPaymentStatus(paymentId);
    return NextResponse.json(result);
  } catch (error) {
    const err = error as { message?: string; statusCode?: number };
    return NextResponse.json(
      { success: false, message: err.message || 'Unknown error' },
      { status: err.statusCode || 500 }
    );
  }
}
