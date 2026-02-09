/**
 * Demo webhook receiver: accepts payment.confirmed POST from gateway.
 * Returns 200 so gateway does not retry. Payload is stored in memory for /webhook-log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { appendWebhook } from '@/lib/webhook-log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    appendWebhook(body);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to process webhook payload:', error);
    return NextResponse.json({ received: false, error: 'Invalid payload' }, { status: 200 });
  }
}
