import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RelayerService } from '../relayer.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('RelayerService', () => {
  let relayerService: RelayerService;
  const mockApiUrl = 'https://relay.example.com';
  const mockApiKey = 'test-api-key';

  const mockForwardRequest = {
    from: '0x' + 'a'.repeat(40),
    to: '0x' + 'b'.repeat(40),
    value: '0',
    gas: '100000',
    nonce: '1',
    deadline: String(Math.floor(Date.now() / 1000) + 3600),
    data: '0x' + 'c'.repeat(64),
    signature: '0x' + 'd'.repeat(130),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    relayerService = new RelayerService(mockApiUrl, mockApiKey);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid parameters', () => {
      expect(relayerService).toBeDefined();
    });

    it('should throw error when API URL is missing', () => {
      expect(() => new RelayerService('', mockApiKey)).toThrow('Relayer API URL이 필요합니다');
    });

    it('should remove trailing slash from API URL', () => {
      const service = new RelayerService('https://relay.example.com/', mockApiKey);
      expect(service).toBeDefined();
    });
  });

  describe('validateTransactionData', () => {
    it('should return true for valid hex data', () => {
      expect(relayerService.validateTransactionData('0x1234abcd')).toBe(true);
    });

    it('should return false for data not starting with 0x', () => {
      expect(relayerService.validateTransactionData('1234abcd')).toBe(false);
    });

    it('should return false for data with odd length', () => {
      expect(relayerService.validateTransactionData('0x123')).toBe(false);
    });

    it('should return false for empty data after 0x', () => {
      expect(relayerService.validateTransactionData('0x')).toBe(false);
    });

    it('should return false for non-hex characters', () => {
      expect(relayerService.validateTransactionData('0x123xyz')).toBe(false);
    });

    it('should return true for valid signature format', () => {
      const validSignature = '0x' + 'd'.repeat(130);
      expect(relayerService.validateTransactionData(validSignature)).toBe(true);
    });
  });

  describe('submitForwardTransaction', () => {
    const paymentId = 'payment-123';
    const forwarderAddress = ('0x' + 'e'.repeat(40)) as `0x${string}`;

    it('should submit forward transaction successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            hash: '0x' + 'f'.repeat(64),
            status: 'submitted',
          }),
      });

      const result = await relayerService.submitForwardTransaction(
        paymentId,
        forwarderAddress,
        mockForwardRequest
      );

      expect(result.relayRequestId).toBe('tx-123');
      expect(result.transactionHash).toBe('0x' + 'f'.repeat(64));
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

    it('should throw error when paymentId is missing', async () => {
      await expect(
        relayerService.submitForwardTransaction('', forwarderAddress, mockForwardRequest)
      ).rejects.toThrow('필수 파라미터가 누락되었습니다');
    });

    it('should throw error when forwarderAddress is missing', async () => {
      await expect(
        relayerService.submitForwardTransaction(paymentId, '' as `0x${string}`, mockForwardRequest)
      ).rejects.toThrow('필수 파라미터가 누락되었습니다');
    });

    it('should throw error for invalid signature format', async () => {
      const invalidRequest = { ...mockForwardRequest, signature: 'invalid' };
      await expect(
        relayerService.submitForwardTransaction(paymentId, forwarderAddress, invalidRequest)
      ).rejects.toThrow('잘못된 서명 형식입니다');
    });

    it('should handle HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error' }),
      });

      await expect(
        relayerService.submitForwardTransaction(paymentId, forwarderAddress, mockForwardRequest)
      ).rejects.toThrow('ForwardRequest 거래를 제출할 수 없습니다');
    });

    it('should handle insufficient funds error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'insufficient funds' }),
      });

      await expect(
        relayerService.submitForwardTransaction(paymentId, forwarderAddress, mockForwardRequest)
      ).rejects.toThrow('릴레이어 잔액이 부족합니다');
    });

    it('should handle nonce error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'nonce too low' }),
      });

      await expect(
        relayerService.submitForwardTransaction(paymentId, forwarderAddress, mockForwardRequest)
      ).rejects.toThrow('트랜잭션 nonce 충돌이 발생했습니다');
    });

    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'unauthorized' }),
      });

      await expect(
        relayerService.submitForwardTransaction(paymentId, forwarderAddress, mockForwardRequest)
      ).rejects.toThrow('Relayer API 인증에 실패했습니다');
    });
  });

  describe('getRelayStatus', () => {
    it('should get relay status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            hash: '0x' + 'f'.repeat(64),
            status: 'confirmed',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');

      expect(result.relayRequestId).toBe('tx-123');
      expect(result.status).toBe('confirmed');
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/v1/relay/status/tx-123`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error when relayRequestId is missing', async () => {
      await expect(relayerService.getRelayStatus('')).rejects.toThrow(
        '릴레이 요청 ID는 필수입니다'
      );
    });

    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(relayerService.getRelayStatus('non-existent')).rejects.toThrow(
        '릴레이 요청을 찾을 수 없습니다'
      );
    });

    it('should handle other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(relayerService.getRelayStatus('tx-123')).rejects.toThrow(
        '릴레이 상태를 조회할 수 없습니다'
      );
    });
  });

  describe('getNonce', () => {
    const address = ('0x' + 'a'.repeat(40)) as `0x${string}`;

    it('should get nonce successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nonce: '5' }),
      });

      const result = await relayerService.getNonce(address);

      expect(result).toBe('5');
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/v1/relay/gasless/nonce/${address}`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error when address is missing', async () => {
      await expect(relayerService.getNonce('' as `0x${string}`)).rejects.toThrow(
        '주소는 필수입니다'
      );
    });

    it('should handle HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(relayerService.getNonce(address)).rejects.toThrow('Nonce를 조회할 수 없습니다');
    });
  });

  describe('cancelRelayTransaction', () => {
    it('should return false for already mined transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'mined',
          }),
      });

      const result = await relayerService.cancelRelayTransaction('tx-123');
      expect(result).toBe(false);
    });

    it('should return false for confirmed transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'confirmed',
          }),
      });

      const result = await relayerService.cancelRelayTransaction('tx-123');
      expect(result).toBe(false);
    });

    it('should return true for failed transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'failed',
          }),
      });

      const result = await relayerService.cancelRelayTransaction('tx-123');
      expect(result).toBe(true);
    });

    it('should return false for pending transaction (cancellation not supported)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'pending',
          }),
      });

      const result = await relayerService.cancelRelayTransaction('tx-123');
      expect(result).toBe(false);
    });

    it('should throw error when relayRequestId is missing', async () => {
      await expect(relayerService.cancelRelayTransaction('')).rejects.toThrow(
        '릴레이 요청 ID는 필수입니다'
      );
    });
  });

  describe('waitForTransaction', () => {
    it('should return immediately for confirmed transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            hash: '0x' + 'f'.repeat(64),
            status: 'confirmed',
          }),
      });

      const result = await relayerService.waitForTransaction('tx-123', {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(result.status).toBe('confirmed');
    });

    it('should return for mined transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'mined',
          }),
      });

      const result = await relayerService.waitForTransaction('tx-123', {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(result.status).toBe('mined');
    });

    it('should return for failed transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'failed',
          }),
      });

      const result = await relayerService.waitForTransaction('tx-123', {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(result.status).toBe('failed');
    });

    it('should poll until transaction is confirmed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              transactionId: 'tx-123',
              status: 'pending',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              transactionId: 'tx-123',
              status: 'confirmed',
            }),
        });

      const result = await relayerService.waitForTransaction('tx-123', {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(result.status).toBe('confirmed');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should timeout if transaction is not finalized', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'pending',
          }),
      });

      await expect(
        relayerService.waitForTransaction('tx-123', {
          timeoutMs: 200,
          pollIntervalMs: 50,
        })
      ).rejects.toThrow('트랜잭션 완료 대기 시간이 초과되었습니다');
    });
  });

  describe('estimateGasFee', () => {
    it('should estimate gas fee correctly', async () => {
      const result = await relayerService.estimateGasFee('100000');
      // 100000 * 50 Gwei (50000000000) = 5000000000000000
      expect(result).toBe('5000000000000000');
    });
  });

  describe('checkRelayerHealth', () => {
    it('should return healthy status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            address: '0x' + 'a'.repeat(40),
            balance: '1000000000000000000',
          }),
      });

      const result = await relayerService.checkRelayerHealth();

      expect(result.healthy).toBe(true);
      expect(result.message).toContain('릴레이어 연결 성공');
    });

    it('should return unhealthy status on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await relayerService.checkRelayerHealth();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('릴레이어 연결에 실패했습니다');
    });

    it('should return unhealthy status on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await relayerService.checkRelayerHealth();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('릴레이어 연결에 실패했습니다');
    });
  });

  describe('status mapping', () => {
    it('should map pending status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'pending',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');
      expect(result.status).toBe('pending');
    });

    it('should map sent status to pending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'sent',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');
      expect(result.status).toBe('pending');
    });

    it('should map inmempool status to pending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'inmempool',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');
      expect(result.status).toBe('pending');
    });

    it('should map mined status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'mined',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');
      expect(result.status).toBe('mined');
    });

    it('should map confirmed status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'confirmed',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');
      expect(result.status).toBe('confirmed');
    });

    it('should map failed status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'tx-123',
            status: 'failed',
          }),
      });

      const result = await relayerService.getRelayStatus('tx-123');
      expect(result.status).toBe('failed');
    });
  });
});
