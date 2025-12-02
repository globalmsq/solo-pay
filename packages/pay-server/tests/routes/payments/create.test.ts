import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createPaymentRoute } from '../../../src/routes/payments/create';
import { BlockchainService } from '../../../src/services/blockchain.service';
import { SUPPORTED_CHAINS } from '../../../src/config/chains';

describe('POST /payments/create', () => {
  let app: FastifyInstance;
  let blockchainService: BlockchainService;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);

    // 실제 BlockchainService 인스턴스 생성
    blockchainService = new BlockchainService(
      'https://polygon-rpc.com',
      SUPPORTED_CHAINS[0].contracts.gateway
    );

    // Mock getDecimals to return 18
    blockchainService.getDecimals = vi.fn().mockResolvedValue(18);

    // 실제 라우트 등록
    await createPaymentRoute(app, blockchainService);
  });

  describe('정상 케이스', () => {
    it('유효한 결제 요청을 받으면 201 상태 코드와 함께 결제 ID를 반환해야 함', async () => {
      const validPayment = {
        amount: 100,
        currency: 'SUT',
        chainId: 80002,
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: validPayment,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.paymentId).toBeDefined();
      expect(body.tokenAddress).toBe('0xE4C687167705Abf55d709395f92e254bdF5825a2');
      expect(body.gatewayAddress).toBeDefined();
      expect(body.forwarderAddress).toBeDefined();
      expect(body.amount).toBe('100000000000000000000'); // 100 * 10^18
      expect(body.status).toBe('pending');
    });

    it('Hardhat 체인 (chainId 31337)으로 최소 필수 정보만으로 결제를 생성할 수 있어야 함', async () => {
      const minimalPayment = {
        amount: 50,
        currency: 'TEST',
        chainId: 31337,
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: minimalPayment,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.tokenAddress).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    });
  });

  describe('경계 케이스', () => {
    it('금액이 0일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        amount: 0,
        currency: 'SUT',
        chainId: 80002,
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('음수 금액일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        amount: -50,
        currency: 'SUT',
        chainId: 80002,
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('유효하지 않은 recipientAddress 형식일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        amount: 100,
        currency: 'SUT',
        chainId: 80002,
        recipientAddress: 'invalid-address',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('예외 케이스', () => {
    it('필수 필드가 누락되었을 때 400 상태 코드를 반환해야 함', async () => {
      const incompletePayment = {
        amount: 100,
        currency: 'SUT',
        // chainId 누락
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: incompletePayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('지원하지 않는 chainId일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        amount: 100,
        currency: 'SUT',
        chainId: 1, // Ethereum Mainnet (지원 안 함)
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('UNSUPPORTED_CHAIN');
      expect(body.message).toContain('Chain ID 1 is not supported');
    });

    it('지원하지 않는 currency일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidPayment = {
        amount: 100,
        currency: 'ETH', // Polygon Amoy에서 지원하지 않는 토큰
        chainId: 80002,
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: invalidPayment,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('UNSUPPORTED_TOKEN');
      expect(body.message).toContain('Token ETH is not supported');
    });

    it('decimals 조회 오류 발생 시에도 fallback으로 진행해야 함', async () => {
      // getDecimals가 실패해도 fallback 18로 처리
      blockchainService.getDecimals = vi.fn().mockResolvedValue(18);

      const validPayment = {
        amount: 100,
        currency: 'SUT',
        chainId: 80002,
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/create',
        payload: validPayment,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.amount).toBe('100000000000000000000'); // 100 * 10^18 (fallback)
    });
  });
});
