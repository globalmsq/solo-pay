import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RelayerService } from '../../src/services/relayer.service';
import { Address } from 'viem';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('relayerService', () => {
  let relayerService: RelayerService;
  const mockApiUrl = 'http://simple-relayer:3001';
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();

    relayerService = new RelayerService(mockApiUrl, mockApiKey);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('유효한 URL로 인스턴스를 생성해야 함', () => {
      const service = new RelayerService(mockApiUrl, mockApiKey);

      expect(service).toBeDefined();
    });

    it('API URL이 없으면 에러를 던져야 함', () => {
      expect(() => {
        new RelayerService('', mockApiKey);
      }).toThrow('Relayer API URL이 필요합니다');
    });

    it('API 키와 시크릿이 없어도 인스턴스가 생성되어야 함 (Local 환경)', () => {
      const service = new RelayerService(mockApiUrl, '');

      expect(service).toBeDefined();
    });
  });

  describe('submitGaslessTransaction', () => {
    it('유효한 거래 데이터로 릴레이 요청 ID를 반환해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          hash: '0x' + 'a'.repeat(64),
          status: 'pending',
        }),
      });

      const result = await relayerService.submitForwardTransaction(
        'payment-123',
        ('0x' + 'a'.repeat(40)) as Address,
        {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: '0x' + 'e'.repeat(130),
        }
      );

      expect(result.relayRequestId).toBe('tx-mock-123');
      expect(result.transactionHash).toBe('0x' + 'a'.repeat(64));
      expect(result.status).toBe('pending');

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/v1/relay/gasless`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': mockApiKey,
          }),
        })
      );
    });

    it('options를 전달할 수 있어야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          hash: '0x' + 'a'.repeat(64),
          status: 'pending',
        }),
      });

      await relayerService.submitForwardTransaction(
        'payment-123',
        ('0x' + 'a'.repeat(40)) as Address,
        {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: '0x' + 'e'.repeat(130),
        }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/v1/relay/gasless`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': mockApiKey,
          }),
          body: JSON.stringify({
            request: {
              from: '0x' + 'c'.repeat(40),
              to: '0x' + 'b'.repeat(40),
              value: '1000000000000000000',
              gas: '500000',
              nonce: '1',
              deadline: '1000000000000000000',
              data: '0x' + 'd'.repeat(128),
            },
            signature: '0x' + 'e'.repeat(130),
          }),
        })
      );
    });

    it('누락된 결제 ID로 요청 시 에러를 던져야 함', async () => {
      await expect(
        relayerService.submitForwardTransaction('', ('0x' + 'a'.repeat(40)) as Address, {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: '0x' + 'e'.repeat(130),
        })
      ).rejects.toThrow('필수 파라미터가 누락되었습니다');
    });

    it('누락된 대상 주소로 요청 시 에러를 던져야 함', async () => {
      await expect(
        relayerService.submitForwardTransaction('payment-123', '' as Address, {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: '0x' + 'e'.repeat(130),
        })
      ).rejects.toThrow('필수 파라미터가 누락되었습니다');
    });

    it('잘못된 형식의 서명으로 요청 시 에러를 던져야 함', async () => {
      await expect(
        relayerService.submitForwardTransaction('payment-123', ('0x' + 'a'.repeat(40)) as Address, {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: 'invalid-signature', // 잘못된 서명 형식
        })
      ).rejects.toThrow('잘못된 서명 형식입니다');
    });

    it('insufficient funds 에러를 적절하게 처리해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'insufficient funds' }),
      });

      await expect(
        relayerService.submitForwardTransaction('payment-123', ('0x' + 'a'.repeat(40)) as Address, {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: '0x' + 'e'.repeat(130),
        })
      ).rejects.toThrow('릴레이어 잔액이 부족합니다');
    });

    it('인증 에러를 적절하게 처리해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: '401 unauthorized' }),
      });

      await expect(
        relayerService.submitForwardTransaction('payment-123', ('0x' + 'a'.repeat(40)) as Address, {
          to: '0x' + 'b'.repeat(40),
          from: '0x' + 'c'.repeat(40),
          value: '1000000000000000000',
          gas: '500000',
          nonce: '1',
          deadline: '1000000000000000000',
          data: '0x' + 'd'.repeat(128),
          signature: '0x' + 'e'.repeat(130),
        })
      ).rejects.toThrow('Relayer API 인증에 실패했습니다');
    });
  });

  describe('getRelayStatus', () => {
    it('유효한 릴레이 요청 ID로 상태를 조회해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          hash: '0x' + 'a'.repeat(64),
          status: 'mined',
        }),
      });

      const result = await relayerService.getRelayStatus('tx-mock-123');

      expect(result.relayRequestId).toBe('tx-mock-123');
      expect(result.status).toBe('mined');
      expect(result.transactionHash).toBe('0x' + 'a'.repeat(64));
    });

    it('빈 릴레이 요청 ID로 조회 시 에러를 던져야 함', async () => {
      await expect(relayerService.getRelayStatus('')).rejects.toThrow(
        '릴레이 요청 ID는 필수입니다'
      );
    });

    it('트랜잭션을 찾을 수 없는 경우를 적절하게 처리해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(relayerService.getRelayStatus('unknown-tx')).rejects.toThrow(
        '릴레이 요청을 찾을 수 없습니다'
      );
    });
  });

  describe('cancelRelayTransaction', () => {
    it('mined 상태의 트랜잭션은 취소할 수 없어야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'mined',
        }),
      });

      const result = await relayerService.cancelRelayTransaction('tx-mock-123');
      expect(result).toBe(false);
    });

    it('failed 상태의 트랜잭션은 true를 반환해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'failed',
        }),
      });

      const result = await relayerService.cancelRelayTransaction('tx-mock-123');
      expect(result).toBe(true);
    });

    it('빈 릴레이 요청 ID로 취소 시 에러를 던져야 함', async () => {
      await expect(relayerService.cancelRelayTransaction('')).rejects.toThrow(
        '릴레이 요청 ID는 필수입니다'
      );
    });
  });

  describe('waitForTransaction', () => {
    it('트랜잭션이 완료될 때까지 대기해야 함', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          hash: '0x' + 'a'.repeat(64),
          status: 'mined',
        }),
      });

      const result = await relayerService.waitForTransaction('tx-mock-123', {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(result.status).toBe('mined');
    });

    it('타임아웃 시 에러를 던져야 함', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'pending',
        }),
      });

      await expect(
        relayerService.waitForTransaction('tx-mock-123', {
          timeoutMs: 300,
          pollIntervalMs: 100,
        })
      ).rejects.toThrow('트랜잭션 완료 대기 시간이 초과되었습니다');
    });
  });

  describe('validateTransactionData', () => {
    it('유효한 거래 데이터는 true를 반환해야 함', () => {
      expect(relayerService.validateTransactionData('0x' + 'a'.repeat(128))).toBe(true);
    });

    it('0x로 시작하지 않는 데이터는 false를 반환해야 함', () => {
      expect(relayerService.validateTransactionData('invalid-data')).toBe(false);
    });

    it('홀수 길이의 데이터는 false를 반환해야 함', () => {
      expect(relayerService.validateTransactionData('0xabc')).toBe(false);
    });

    it('0x만 있는 데이터는 false를 반환해야 함', () => {
      expect(relayerService.validateTransactionData('0x')).toBe(false);
    });

    it('빈 거래 데이터는 false를 반환해야 함', () => {
      expect(relayerService.validateTransactionData('')).toBe(false);
    });
  });

  describe('estimateGasFee', () => {
    it('가스 리미트로 가스 비용을 추정해야 함', async () => {
      const gasFee = await relayerService.estimateGasFee('200000');

      expect(gasFee).toBeDefined();
      expect(Number(gasFee)).toBeGreaterThan(0);
    });
  });

  describe('checkRelayerHealth', () => {
    it('릴레이어가 정상이면 healthy를 반환해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: '1000000000000000000',
        }),
      });

      const result = await relayerService.checkRelayerHealth();

      expect(result.healthy).toBe(true);
      expect(result.message).toContain('릴레이어 연결 성공');
    });

    it('릴레이어 헬스 체크 실패를 적절하게 처리해야 함', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const result = await relayerService.checkRelayerHealth();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('릴레이어 연결에 실패했습니다');
    });
  });

  describe('status mapping', () => {
    it('sent 상태를 pending으로 매핑해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'sent',
        }),
      });

      const result = await relayerService.getRelayStatus('tx-mock-123');
      expect(result.status).toBe('pending');
    });

    it('submitted 상태를 pending으로 매핑해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'submitted',
        }),
      });

      const result = await relayerService.getRelayStatus('tx-mock-123');
      expect(result.status).toBe('pending');
    });

    it('confirmed 상태를 올바르게 매핑해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'confirmed',
        }),
      });

      const result = await relayerService.getRelayStatus('tx-mock-123');
      expect(result.status).toBe('confirmed');
    });

    it('failed 상태를 올바르게 매핑해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: 'tx-mock-123',
          status: 'failed',
        }),
      });

      const result = await relayerService.getRelayStatus('tx-mock-123');
      expect(result.status).toBe('failed');
    });
  });
});
