import { NextRequest, NextResponse } from 'next/server';
import { MSQPayClient } from '@globalmsq/msqpay';

// Initialize MSQ Pay SDK client
const client = new MSQPayClient({
  environment: 'custom',
  apiKey: process.env.MSQ_PAY_API_KEY || 'demo-key',
  apiUrl: process.env.NEXT_PUBLIC_MSQ_PAY_API_URL || 'http://localhost:3001',
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    const { amount, currency, chainId, recipientAddress } = body;

    if (!amount || !currency || !chainId || !recipientAddress) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: amount, currency, chainId, recipientAddress',
        },
        { status: 400 }
      );
    }

    // Call SDK to create payment
    const payment = await client.createPayment({
      amount: parseFloat(amount),
      currency: String(currency),
      chainId: parseInt(chainId),
      recipientAddress: String(recipientAddress),
    });

    // Return payment response
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as any)?.code || 'INTERNAL_ERROR';

    // Handle known error codes from SDK
    if (errorCode === 'UNSUPPORTED_CHAIN' || errorCode === 'UNSUPPORTED_TOKEN') {
      return NextResponse.json(
        {
          code: errorCode,
          message: errorMessage,
        },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
