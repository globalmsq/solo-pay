import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const body = await request.json();

    const result = await client.executeRelay({
      paymentId: params.paymentId,
      transactionData: body.transactionData,
      gasEstimate: body.gasEstimate
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
