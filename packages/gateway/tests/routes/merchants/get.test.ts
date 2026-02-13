import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { getMerchantRoute } from '../../../src/routes/merchants/get';
import { MerchantService } from '../../../src/services/merchant.service';
import { PaymentMethodService } from '../../../src/services/payment-method.service';
import { TokenService } from '../../../src/services/token.service';
import { ChainService } from '../../../src/services/chain.service';
import { API_V1_BASE_PATH } from '../../../src/constants';

const TEST_API_KEY = 'test-api-key-123';

const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_demo_001',
  name: 'Demo Store',
  chain_id: 1,
  api_key_hash: 'hashed',
  public_key: 'pk_test_demo',
  public_key_hash: null,
  allowed_domains: ['http://localhost:3000'],
  webhook_url: 'http://demo:3000/api/webhook',
  fee_bps: 0,
  recipient_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockChain = {
  id: 1,
  network_id: 80002,
  name: 'Polygon Amoy',
  rpc_url: 'https://rpc-amoy.polygon.technology',
  gateway_address: '0x0000000000000000000000000000000000000000',
  forwarder_address: '0x0000000000000000000000000000000000000000',
  is_testnet: true,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockChain2 = {
  id: 2,
  network_id: 31337,
  name: 'Hardhat',
  rpc_url: 'http://127.0.0.1:8545',
  gateway_address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  forwarder_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  is_testnet: true,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockToken = {
  id: 1,
  chain_id: 1,
  address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  symbol: 'SUT',
  decimals: 18,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockToken2 = {
  id: 2,
  chain_id: 2,
  address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  symbol: 'TEST',
  decimals: 18,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

describe('GET /merchants/me', () => {
  let app: FastifyInstance;
  let merchantService: Partial<MerchantService>;
  let paymentMethodService: Partial<PaymentMethodService>;
  let tokenService: Partial<TokenService>;
  let chainService: Partial<ChainService>;

  beforeEach(async () => {
    app = Fastify({
      logger: false,
      ajv: {
        customOptions: {
          keywords: ['example'],
        },
      },
    });
    await app.register(cors);

    merchantService = {
      findByApiKey: vi.fn().mockResolvedValue(mockMerchant),
    };

    chainService = {
      findById: vi.fn().mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockChain);
        if (id === 2) return Promise.resolve(mockChain2);
        return Promise.resolve(null);
      }),
      findAll: vi.fn().mockResolvedValue([mockChain, mockChain2]),
      findByIds: vi.fn().mockImplementation((ids: number[]) => {
        const chains = [mockChain, mockChain2].filter((c) => ids.includes(c.id));
        return Promise.resolve(chains);
      }),
    };

    tokenService = {
      findAllForChains: vi.fn().mockResolvedValue([mockToken, mockToken2]),
      findByIds: vi.fn().mockImplementation((ids: number[]) => {
        const tokens = [mockToken, mockToken2].filter((t) => ids.includes(t.id));
        return Promise.resolve(tokens);
      }),
    };

    paymentMethodService = {
      findAllForMerchant: vi.fn().mockResolvedValue([]),
      enrichPaymentMethods: vi.fn().mockResolvedValue([]),
    };

    await app.register(
      async (scope) => {
        await getMerchantRoute(
          scope,
          merchantService as MerchantService,
          paymentMethodService as PaymentMethodService,
          tokenService as TokenService,
          chainService as ChainService
        );
      },
      { prefix: API_V1_BASE_PATH }
    );
  });

  it('returns 200 with merchant and chainTokens', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API_V1_BASE_PATH}/merchants/me`,
      headers: { 'x-api-key': TEST_API_KEY },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.merchant).toBeDefined();
    expect(body.merchant.id).toBe(1);
    expect(body.merchant.merchant_key).toBe('merchant_demo_001');
    expect(body.chainTokens).toBeDefined();
    expect(Array.isArray(body.chainTokens)).toBe(true);
  });

  it('returns chainTokens with correct format (id, network_id, name, is_testnet, tokens)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API_V1_BASE_PATH}/merchants/me`,
      headers: { 'x-api-key': TEST_API_KEY },
    });

    const body = JSON.parse(response.body);
    expect(body.chainTokens.length).toBeGreaterThanOrEqual(1);

    for (const chain of body.chainTokens) {
      expect(chain).toHaveProperty('id');
      expect(chain).toHaveProperty('network_id');
      expect(chain).toHaveProperty('name');
      expect(chain).toHaveProperty('is_testnet');
      expect(chain).toHaveProperty('tokens');
      expect(Array.isArray(chain.tokens)).toBe(true);
      for (const token of chain.tokens) {
        expect(token).toHaveProperty('id');
        expect(token).toHaveProperty('address');
        expect(token).toHaveProperty('symbol');
        expect(token).toHaveProperty('decimals');
      }
    }
  });

  it('returns 401 when x-api-key is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API_V1_BASE_PATH}/merchants/me`,
    });
    expect(response.statusCode).toBe(401);
  });
});
