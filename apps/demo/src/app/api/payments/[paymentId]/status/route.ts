import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    // chainId는 Pay Server에서 paymentId 기반으로 조회
    const result = await client.getPaymentStatus(params.paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
