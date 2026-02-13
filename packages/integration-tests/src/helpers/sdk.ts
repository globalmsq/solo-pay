import { SoloPayClient } from '@solo-pay/gateway-sdk';
import type {
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
} from '@solo-pay/gateway-sdk';

import { getMerchant } from '../fixtures/merchant';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

export interface TestMerchant {
  merchantId: string;
  apiKey: string;
  publicKey?: string;
  origin?: string;
}

/**
 * 기본 테스트 머천트 (init.sql의 Demo Merchant와 동기화)
 */
export const TEST_MERCHANT: TestMerchant = {
  merchantId: 'merchant_demo_001',
  apiKey: '123',
  publicKey: 'pk_test_demo_001',
  origin: 'http://localhost:3000',
};

export function createTestClient(merchant: TestMerchant = TEST_MERCHANT): SoloPayClient {
  return new SoloPayClient({
    environment: 'custom',
    apiUrl: GATEWAY_URL,
    apiKey: merchant.apiKey,
    publicKey: merchant.publicKey,
    origin: merchant.origin,
  });
}

export function createTestClientFromFixture(merchantName: string = 'default'): SoloPayClient {
  const fixture = getMerchant(merchantName);
  return new SoloPayClient({
    environment: 'custom',
    apiUrl: GATEWAY_URL,
    apiKey: fixture.apiKey,
    publicKey: fixture.publicKey,
    origin: fixture.allowedDomains?.[0],
  });
}

export async function createPayment(
  client: SoloPayClient,
  params: CreatePaymentParams
): Promise<CreatePaymentResponse> {
  return client.createPayment(params);
}

export async function getPaymentStatus(
  client: SoloPayClient,
  paymentId: string
): Promise<PaymentStatusResponse> {
  return client.getPaymentStatus(paymentId);
}

export async function submitGasless(
  client: SoloPayClient,
  params: GaslessParams
): Promise<GaslessResponse> {
  return client.submitGasless(params);
}

export async function waitForPaymentStatus(
  client: SoloPayClient,
  paymentId: string,
  expectedStatus: string,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<PaymentStatusResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await client.getPaymentStatus(paymentId);
    if (response.data.status === expectedStatus) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Payment status did not reach ${expectedStatus} within ${timeoutMs}ms`);
}

export { SoloPayClient };
export type {
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
};
