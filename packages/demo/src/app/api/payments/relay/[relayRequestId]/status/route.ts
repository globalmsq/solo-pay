import { NextRequest, NextResponse } from 'next/server';
import { getSoloPayClient } from '@/lib/solo-pay-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ relayRequestId: string }> }
) {
  try {
    const client = getSoloPayClient();
    const { relayRequestId } = await params;

    const result = await client.getRelayStatus(relayRequestId);

    return NextResponse.json(result);
  } catch (error) {
    const err = error as { message?: string; statusCode?: number };
    return NextResponse.json(
      { success: false, message: err.message || 'Unknown error' },
      { status: err.statusCode || 500 }
    );
  }
}
