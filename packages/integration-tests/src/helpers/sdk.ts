import { SoloPayClient } from '@solo-pay/gateway-sdk';
import type {
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
} from '@solo-pay/gateway-sdk';

import { getMerchant } from '../fixtures/merchant';

/** Gateway host (no path). CI: GATEWAY_URL=http://127.0.0.1:3001 */
const GATEWAY_BASE = process.env.GATEWAY_URL || 'http://localhost:3001';
/** Full gateway API v1 base for SDK (must match gateway mount /api/v1). */
const GATEWAY_URL = `${GATEWAY_BASE.replace(/\/$/, '')}/api/v1`;

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
  publicKey: 'pk_test_demo',
  origin: process.env.PAY_SERVER_ORIGIN || 'http://localhost:3000',
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
    origin: fixture.origin,
  });
}

/**
 * Default token for merchant_demo_001 (init.sql: chain_id=1, token_id=1, address 0xe7f17...)
 */
const DEFAULT_TOKEN_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

/** Build params for createPayment (POST /payments/create uses orderId, amount, tokenAddress, successUrl, failUrl). */
export function makeCreatePaymentParams(
  amount: number,
  orderId?: string,
  tokenAddress: string = DEFAULT_TOKEN_ADDRESS
): CreatePaymentParams {
  const base = process.env.PAY_SERVER_ORIGIN || 'http://localhost:3000';
  const oid = orderId ?? `order-${Date.now()}`;
  return {
    orderId: oid,
    amount,
    tokenAddress,
    successUrl: `${base}/success?orderId=${oid}`,
    failUrl: `${base}/fail?orderId=${oid}`,
  };
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
