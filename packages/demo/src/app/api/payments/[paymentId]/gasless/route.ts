import { NextRequest, NextResponse } from 'next/server';
import { getSoloPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const client = getSoloPayClient();
    const { paymentId } = await params;
    const body = await request.json();

    const result = await client.submitGasless({
      paymentId,
      forwarderAddress: body.forwarderAddress,
      forwardRequest: body.forwardRequest,
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
