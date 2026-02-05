import { SoloPayClient } from '@solo-pay/gateway-sdk';

let solopayClient: SoloPayClient | null = null;

export function getSoloPayClient(): SoloPayClient {
  if (!solopayClient) {
    const apiUrl = process.env.SOLO_PAY_API_URL || 'http://localhost:3001';

    solopayClient = new SoloPayClient({
      environment: 'custom',
      apiUrl: apiUrl,
      apiKey: process.env.SOLO_PAY_API_KEY || 'demo-api-key',
    });
  }
  return solopayClient;
}
