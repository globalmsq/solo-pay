import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelayService, RelayServiceConfig } from '../src/services/relay.service';

// Mock viem
vi.mock('viem', () => {
  const mockSendTransaction = vi.fn().mockResolvedValue('0x' + 'a'.repeat(64));
  const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });
  const mockGetBalance = vi.fn().mockResolvedValue(BigInt('1000000000000000000'));
  const mockReadContract = vi.fn().mockResolvedValue(BigInt(0));

  return {
    createWalletClient: vi.fn(() => ({
      sendTransaction: mockSendTransaction,
    })),
    createPublicClient: vi.fn(() => ({
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
      getBalance: mockGetBalance,
      readContract: mockReadContract,
    })),
    http: vi.fn(),
    encodeFunctionData: vi.fn().mockReturnValue('0x' + 'd'.repeat(64)),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })),
}));

vi.mock('viem/chains', () => ({
  hardhat: { id: 31337, name: 'Hardhat' },
}));

describe('RelayService', () => {
  let relayService: RelayService;
  const config: RelayServiceConfig = {
    relayerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    rpcUrl: 'http://localhost:8545',
    chainId: 31337,
    forwarderAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    relayService = new RelayService(config);
  });

  describe('constructor', () => {
    it('유효한 설정으로 인스턴스를 생성해야 함', () => {
      expect(relayService).toBeDefined();
    });

    it('잘못된 private key로 생성 시 에러를 던져야 함', () => {
      expect(() => {
        new RelayService({
          ...config,
          relayerPrivateKey: 'invalid' as `0x${string}`,
        });
      }).toThrow();
    });

    it('빈 RPC URL로 생성 시 에러를 던져야 함', () => {
      expect(() => {
        new RelayService({
          ...config,
          rpcUrl: '',
        });
      }).toThrow('rpcUrl is required');
    });

    it('잘못된 chainId로 생성 시 에러를 던져야 함', () => {
      expect(() => {
        new RelayService({
          ...config,
          chainId: 0,
        });
      }).toThrow('chainId must be positive');
    });

    it('잘못된 forwarderAddress로 생성 시 에러를 던져야 함', () => {
      expect(() => {
        new RelayService({
          ...config,
          forwarderAddress: 'invalid' as `0x${string}`,
        });
      }).toThrow('forwarderAddress must be hex string starting with 0x');
    });

    it('0x 프리픽스 없는 private key도 정규화되어야 함', () => {
      const serviceWithoutPrefix = new RelayService({
        ...config,
        relayerPrivateKey:
          'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`,
      });
      expect(serviceWithoutPrefix).toBeDefined();
    });

    it('빈 private key로 생성 시 에러를 던져야 함', () => {
      expect(() => {
        new RelayService({
          ...config,
          relayerPrivateKey: '' as `0x${string}`,
        });
      }).toThrow('relayerPrivateKey is required');
    });

    it('잘못된 hex 문자가 있는 private key로 생성 시 에러를 던져야 함', () => {
      expect(() => {
        new RelayService({
          ...config,
          relayerPrivateKey:
            '0xgg0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`,
        });
      }).toThrow('relayerPrivateKey contains invalid hex characters');
    });
  });

  describe('submitTransaction', () => {
    it('트랜잭션을 제출하고 레코드를 반환해야 함', async () => {
      const result = await relayService.submitTransaction({
        to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
      });

      expect(result.transactionId).toContain('mock_tx_');
      // 트랜잭션이 성공적으로 제출되면 'sent' 또는 모니터링 후 'mined' 상태
      expect(['sent', 'mined', 'confirmed']).toContain(result.status);
      expect(result.transactionHash).toBeDefined();
    });

    it('value와 gasLimit 옵션을 받아들여야 함', async () => {
      const result = await relayService.submitTransaction({
        to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
        value: '1000000000000000000',
        gasLimit: '500000',
      });

      expect(result.transactionId).toBeDefined();
      expect(result.value).toBe('1000000000000000000');
      expect(result.gasLimit).toBe('500000');
    });
  });

  describe('getTransaction', () => {
    it('존재하는 트랜잭션을 조회해야 함', async () => {
      const submitted = await relayService.submitTransaction({
        to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
      });

      const result = await relayService.getTransaction(submitted.transactionId);
      expect(result.transactionId).toBe(submitted.transactionId);
    });

    it('존재하지 않는 트랜잭션 조회 시 에러를 던져야 함', async () => {
      await expect(relayService.getTransaction('non-existent')).rejects.toThrow(
        'Transaction not found: non-existent'
      );
    });
  });

  describe('getRelayerInfo', () => {
    it('릴레이어 주소와 잔액을 반환해야 함', async () => {
      const info = await relayService.getRelayerInfo();

      expect(info.address).toBeDefined();
      expect(info.balance).toBeDefined();
    });
  });

  describe('getNonce', () => {
    it('주어진 주소의 nonce를 반환해야 함', async () => {
      const nonce = await relayService.getNonce(('0x' + 'a'.repeat(40)) as `0x${string}`);

      expect(typeof nonce).toBe('bigint');
    });
  });

  describe('submitForwardRequest', () => {
    it('ForwardRequest를 제출하고 레코드를 반환해야 함', async () => {
      const result = await relayService.submitForwardRequest({
        forwardRequest: {
          from: ('0x' + 'a'.repeat(40)) as `0x${string}`,
          to: ('0x' + 'b'.repeat(40)) as `0x${string}`,
          value: '0',
          gas: '200000',
          nonce: '0',
          deadline: '1999999999',
          data: '0x' as `0x${string}`,
          signature: ('0x' + 'c'.repeat(130)) as `0x${string}`,
        },
      });

      expect(result.transactionId).toContain('mock_tx_');
      expect(['sent', 'mined', 'confirmed']).toContain(result.status);
      expect(result.transactionHash).toBeDefined();
      expect(result.to).toBe(config.forwarderAddress);
    });

    it('gasLimit 옵션을 받아들여야 함', async () => {
      const result = await relayService.submitForwardRequest({
        forwardRequest: {
          from: ('0x' + 'a'.repeat(40)) as `0x${string}`,
          to: ('0x' + 'b'.repeat(40)) as `0x${string}`,
          value: '1000',
          gas: '200000',
          nonce: '0',
          deadline: '1999999999',
          data: '0x' as `0x${string}`,
          signature: ('0x' + 'c'.repeat(130)) as `0x${string}`,
        },
        gasLimit: '600000',
      });

      expect(result.gasLimit).toBe('600000');
      expect(result.value).toBe('1000');
    });

    it('너무 큰 deadline 값은 에러를 던져야 함', async () => {
      await expect(
        relayService.submitForwardRequest({
          forwardRequest: {
            from: ('0x' + 'a'.repeat(40)) as `0x${string}`,
            to: ('0x' + 'b'.repeat(40)) as `0x${string}`,
            value: '0',
            gas: '200000',
            nonce: '0',
            deadline: '99999999999999999999',
            data: '0x' as `0x${string}`,
            signature: ('0x' + 'c'.repeat(130)) as `0x${string}`,
          },
        })
      ).rejects.toThrow('deadline value is too large for uint48');
    });
  });

  describe('transaction failure scenarios', () => {
    it('sendTransaction 실패 시 트랜잭션 상태가 failed로 설정되어야 함', async () => {
      const { createWalletClient } = await import('viem');
      const mockCreateWalletClient = vi.mocked(createWalletClient);
      mockCreateWalletClient.mockReturnValueOnce({
        sendTransaction: vi.fn().mockRejectedValue(new Error('Transaction failed')),
      } as unknown as ReturnType<typeof createWalletClient>);

      const failingService = new RelayService(config);

      await expect(
        failingService.submitTransaction({
          to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
          data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('submitForwardRequest sendTransaction 실패 시 트랜잭션 상태가 failed로 설정되어야 함', async () => {
      const { createWalletClient } = await import('viem');
      const mockCreateWalletClient = vi.mocked(createWalletClient);
      mockCreateWalletClient.mockReturnValueOnce({
        sendTransaction: vi.fn().mockRejectedValue(new Error('Forward request failed')),
      } as unknown as ReturnType<typeof createWalletClient>);

      const failingService = new RelayService(config);

      await expect(
        failingService.submitForwardRequest({
          forwardRequest: {
            from: ('0x' + 'a'.repeat(40)) as `0x${string}`,
            to: ('0x' + 'b'.repeat(40)) as `0x${string}`,
            value: '0',
            gas: '200000',
            nonce: '0',
            deadline: '1999999999',
            data: '0x' as `0x${string}`,
            signature: ('0x' + 'c'.repeat(130)) as `0x${string}`,
          },
        })
      ).rejects.toThrow('Forward request failed');
    });
  });

  describe('monitorTransaction scenarios', () => {
    it('트랜잭션 영수증 실패 시 상태가 failed로 설정되어야 함', async () => {
      const { createPublicClient, createWalletClient } = await import('viem');
      const mockCreatePublicClient = vi.mocked(createPublicClient);
      const mockCreateWalletClient = vi.mocked(createWalletClient);

      mockCreateWalletClient.mockReturnValueOnce({
        sendTransaction: vi.fn().mockResolvedValue('0x' + 'a'.repeat(64)),
      } as unknown as ReturnType<typeof createWalletClient>);

      mockCreatePublicClient.mockReturnValueOnce({
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'reverted' }),
        getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
        readContract: vi.fn().mockResolvedValue(BigInt(0)),
      } as unknown as ReturnType<typeof createPublicClient>);

      const serviceWithRevert = new RelayService(config);
      const result = await serviceWithRevert.submitTransaction({
        to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
      });

      // 모니터링이 비동기로 실행되므로 약간의 대기 필요
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updated = await serviceWithRevert.getTransaction(result.transactionId);
      expect(updated.status).toBe('failed');
    });

    it('waitForTransactionReceipt 에러 시 상태가 failed로 설정되어야 함', async () => {
      const { createPublicClient, createWalletClient } = await import('viem');
      const mockCreatePublicClient = vi.mocked(createPublicClient);
      const mockCreateWalletClient = vi.mocked(createWalletClient);

      mockCreateWalletClient.mockReturnValueOnce({
        sendTransaction: vi.fn().mockResolvedValue('0x' + 'a'.repeat(64)),
      } as unknown as ReturnType<typeof createWalletClient>);

      mockCreatePublicClient.mockReturnValueOnce({
        waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('Timeout')),
        getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
        readContract: vi.fn().mockResolvedValue(BigInt(0)),
      } as unknown as ReturnType<typeof createPublicClient>);

      const serviceWithTimeout = new RelayService(config);
      const result = await serviceWithTimeout.submitTransaction({
        to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const updated = await serviceWithTimeout.getTransaction(result.transactionId);
      expect(updated.status).toBe('failed');
    });

    it('mined 상태에서 일정 시간 후 confirmed 상태로 전환되어야 함', async () => {
      vi.useFakeTimers();

      const { createPublicClient, createWalletClient } = await import('viem');
      const mockCreatePublicClient = vi.mocked(createPublicClient);
      const mockCreateWalletClient = vi.mocked(createWalletClient);

      mockCreateWalletClient.mockReturnValueOnce({
        sendTransaction: vi.fn().mockResolvedValue('0x' + 'a'.repeat(64)),
      } as unknown as ReturnType<typeof createWalletClient>);

      mockCreatePublicClient.mockReturnValueOnce({
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
        getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
        readContract: vi.fn().mockResolvedValue(BigInt(0)),
      } as unknown as ReturnType<typeof createPublicClient>);

      const serviceWithSuccess = new RelayService(config);
      const result = await serviceWithSuccess.submitTransaction({
        to: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        data: ('0x' + 'b'.repeat(64)) as `0x${string}`,
      });

      // 비동기 처리를 위해 promise 플러시
      await vi.runAllTimersAsync();

      const updated = await serviceWithSuccess.getTransaction(result.transactionId);
      expect(updated.status).toBe('confirmed');

      vi.useRealTimers();
    });
  });
});
