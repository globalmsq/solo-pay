import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const client = getMSQPayClient();
    const { paymentId } = await params;
    const body = await request.json();

    const result = await client.executeRelay({
      paymentId,
      transactionData: body.transactionData,
      gasEstimate: body.gasEstimate
    });

    return NextResponse.json(result);
  } catch (error) {
    const err = error as { message?: string; statusCode?: number };
    return NextResponse.json(
      { success: false, message: err.message || 'Unknown error' },
      { status: err.statusCode || 500 }
    );
  }
}
