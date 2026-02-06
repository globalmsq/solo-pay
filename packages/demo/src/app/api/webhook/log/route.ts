import { NextResponse } from 'next/server';
import { getWebhookLog } from '@/lib/webhook-log';

export async function GET() {
  const log = getWebhookLog();
  return NextResponse.json(log);
}
