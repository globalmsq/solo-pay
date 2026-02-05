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

    const apiUrl = process.env.SOLO_PAY_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/payments/history?chainId=${chainId}&payer=${payer}`);
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
