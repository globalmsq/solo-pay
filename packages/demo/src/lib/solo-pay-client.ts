import { SoloPayClient } from '@solo-pay/gateway-sdk';
import { getMerchantConfig } from './merchant';

const API_V1_BASE_PATH = '/api/v1';

let solopayClient: SoloPayClient | null = null;

export function getSoloPayClient(): SoloPayClient {
  if (!solopayClient) {
    const baseUrl = process.env.SOLO_PAY_API_URL || 'http://localhost:3001';
    const apiUrl = `${baseUrl.replace(/\/$/, '')}${API_V1_BASE_PATH}`;
    const merchantConfig = getMerchantConfig();

    solopayClient = new SoloPayClient({
      environment: 'custom',
      apiUrl,
      apiKey: process.env.SOLO_PAY_API_KEY || 'demo-api-key',
      publicKey: merchantConfig.publicKey,
      origin: merchantConfig.origin,
    });
  }
  return solopayClient;
}
