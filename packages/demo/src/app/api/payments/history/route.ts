import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const payer = request.nextUrl.searchParams.get('payer');
    const chainId = request.nextUrl.searchParams.get('chainId');

    if (!payer) {
      return NextResponse.json(
        { success: false, message: 'payer parameter required' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { success: false, message: 'chainId parameter required' },
        { status: 400 }
      );
    }

    const baseUrl = (process.env.SOLO_PAY_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/v1`;
    const apiKey = process.env.SOLO_PAY_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'SOLO_PAY_API_KEY not configured' },
        { status: 500 }
      );
    }
    const response = await fetch(`${apiUrl}/payments/history?chainId=${chainId}&payer=${payer}`, {
      headers: { 'x-api-key': apiKey },
    });

    // Gateway no longer exposes GET /payments/history (endpoint removed)
    if (response.status === 404) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Payment history endpoint has been removed',
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, message: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
