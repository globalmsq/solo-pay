import { API_URLS, DEFAULT_HEADERS } from './constants';
import { SoloPayError } from './errors';
import type {
  SoloPayConfig,
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
  RelayParams,
  RelayResponse,
  RelayStatusResponse,
  GetPaymentHistoryParams,
  PaymentHistoryResponse,
  ErrorResponse,
} from './types';

export class SoloPayClient {
  private apiUrl: string;
  private apiKey: string;
  private publicKey?: string;
  private origin?: string;

  constructor(config: SoloPayConfig) {
    this.apiKey = config.apiKey;
    this.publicKey = config.publicKey;
    this.origin = config.origin;

    if (config.environment === 'custom') {
      if (!config.apiUrl) {
        throw new Error('apiUrl is required when environment is "custom"');
      }
      this.apiUrl = config.apiUrl;
    } else {
      this.apiUrl = API_URLS[config.environment];
    }
  }

  setApiUrl(url: string): void {
    this.apiUrl = url;
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
    return this.requestWithPublicKey<CreatePaymentResponse>('POST', '/payments/create', params);
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    return this.request<PaymentStatusResponse>('GET', `/payments/${paymentId}/status`);
  }

  async submitGasless(params: GaslessParams): Promise<GaslessResponse> {
    const path = `/payments/${params.paymentId}/gasless`;
    return this.request<GaslessResponse>('POST', path, params);
  }

  async executeRelay(params: RelayParams): Promise<RelayResponse> {
    const path = `/payments/${params.paymentId}/relay`;
    return this.request<RelayResponse>('POST', path, params);
  }

  async getRelayStatus(relayRequestId: string): Promise<RelayStatusResponse> {
    return this.request<RelayStatusResponse>('GET', `/payments/relay/${relayRequestId}/status`);
  }

  async getPaymentHistory(params: GetPaymentHistoryParams): Promise<PaymentHistoryResponse> {
    const queryParams = new URLSearchParams({
      chainId: params.chainId.toString(),
      payer: params.payer,
    });
    if (params.limit !== undefined) {
      queryParams.set('limit', params.limit.toString());
    }
    return this.request<PaymentHistoryResponse>('GET', `/payments/history?${queryParams}`);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: GaslessParams | RelayParams
  ): Promise<T> {
    const headers = {
      ...DEFAULT_HEADERS,
      'x-api-key': this.apiKey,
    };

    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const data = (await response.json()) as T | ErrorResponse;

    if (!response.ok) {
      const error = data as ErrorResponse;
      const statusCode = response.status;
      throw new SoloPayError(error.code, error.message, statusCode, error.details);
    }

    return data as T;
  }

  private async requestWithPublicKey<T>(
    method: string,
    path: string,
    body?: CreatePaymentParams
  ): Promise<T> {
    if (!this.publicKey || !this.origin) {
      throw new Error(
        'requestWithPublicKey requires publicKey and origin in SoloPayConfig (for POST /payments/create auth)'
      );
    }
    const headers = {
      ...DEFAULT_HEADERS,
      'x-public-key': this.publicKey,
      Origin: this.origin,
    };

    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const data = (await response.json()) as T | ErrorResponse;

    if (!response.ok) {
      const error = data as ErrorResponse;
      throw new SoloPayError(error.code, error.message, response.status, error.details);
    }

    return data as T;
  }
}
