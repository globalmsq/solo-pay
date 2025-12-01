import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { relayRequestId: string } }
) {
  try {
    const client = getMSQPayClient();

    const result = await client.getRelayStatus(params.relayRequestId);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
