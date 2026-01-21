import { MSQPayClient } from '@globalmsq/msqpay';
import type {
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
} from '@globalmsq/msqpay';

import { getMerchant } from '../fixtures/merchant';

const PAY_SERVER_URL = process.env.PAY_SERVER_URL || 'http://localhost:3011';

export interface TestMerchant {
  merchantId: string;
  apiKey: string;
}

/**
 * 기본 테스트 머천트 (init.sql의 Demo Merchant와 동기화)
 */
export const TEST_MERCHANT: TestMerchant = {
  merchantId: 'merchant_demo_001',
  apiKey: '123',
};

export function createTestClient(merchant: TestMerchant = TEST_MERCHANT): MSQPayClient {
  return new MSQPayClient({
    environment: 'custom',
    apiUrl: PAY_SERVER_URL,
    apiKey: merchant.apiKey,
  });
}

export function createTestClientFromFixture(merchantName: string = 'default'): MSQPayClient {
  const fixture = getMerchant(merchantName);
  return new MSQPayClient({
    environment: 'custom',
    apiUrl: PAY_SERVER_URL,
    apiKey: fixture.apiKey,
  });
}

export async function createPayment(
  client: MSQPayClient,
  params: CreatePaymentParams
): Promise<CreatePaymentResponse> {
  return client.createPayment(params);
}

export async function getPaymentStatus(
  client: MSQPayClient,
  paymentId: string
): Promise<PaymentStatusResponse> {
  return client.getPaymentStatus(paymentId);
}

export async function submitGasless(
  client: MSQPayClient,
  params: GaslessParams
): Promise<GaslessResponse> {
  return client.submitGasless(params);
}

export async function waitForPaymentStatus(
  client: MSQPayClient,
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

export { MSQPayClient };
export type {
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
};
