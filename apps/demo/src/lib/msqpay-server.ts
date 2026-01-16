import { MSQPayClient } from '@globalmsq/msqpay';

let msqpayClient: MSQPayClient | null = null;

export function getMSQPayClient(): MSQPayClient {
  if (!msqpayClient) {
    const apiUrl = process.env.MSQPAY_API_URL || 'http://localhost:3001';

    msqpayClient = new MSQPayClient({
      environment: 'custom',
      apiUrl: apiUrl,
      apiKey: process.env.MSQPAY_API_KEY || 'demo-api-key',
    });
  }
  return msqpayClient;
}
