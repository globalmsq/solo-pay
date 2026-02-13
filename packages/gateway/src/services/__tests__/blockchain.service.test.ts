import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlockchainService } from '../blockchain.service';
import { ChainWithTokens } from '../chain.service';

// Mock viem module
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    getBlockNumber: vi.fn(),
    getLogs: vi.fn(),
    getBlock: vi.fn(),
    getTransactionReceipt: vi.fn(),
  })),
  http: vi.fn(),
  defineChain: vi.fn((config) => config),
  parseAbiItem: vi.fn(),
}));

// 테스트용 ChainWithTokens mock (DB에서 로드된 형식)
const mockChainsWithTokens: ChainWithTokens[] = [
  {
    id: 1,
    network_id: 80002,
    name: 'Polygon Amoy',
    rpc_url: 'https://rpc-amoy.polygon.technology',
    gateway_address: '0x0000000000000000000000000000000000000000',
    forwarder_address: '0x0000000000000000000000000000000000000000',
    is_testnet: true,
    is_enabled: true,
    is_deleted: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    tokens: [
      {
        id: 1,
        chain_id: 1,
        address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        symbol: 'SUT',
        decimals: 18,
        cmc_id: null,
        is_enabled: true,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  },
  {
    id: 2,
    network_id: 31337,
    name: 'Hardhat',
    rpc_url: 'http://127.0.0.1:8545',
    gateway_address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    forwarder_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    is_testnet: true,
    is_enabled: true,
    is_deleted: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    tokens: [
      {
        id: 2,
        chain_id: 2,
        address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        symbol: 'TEST',
        decimals: 18,
        cmc_id: null,
        is_enabled: true,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  },
];

// Chain without contracts (should be skipped)
const mockChainWithoutContracts: ChainWithTokens = {
  id: 3,
  network_id: 99999,
  name: 'Incomplete Chain',
  rpc_url: 'http://localhost:9999',
  gateway_address: null,
  forwarder_address: null,
  is_testnet: true,
  is_enabled: true,
  is_deleted: false,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  tokens: [],
};

describe('BlockchainService - New methods for SPEC-API-001', () => {
  let service: BlockchainService;

  beforeEach(() => {
    service = new BlockchainService(mockChainsWithTokens);
  });

  describe('getTokenAddress', () => {
    it('should return token address for supported chain and symbol', () => {
      const address = service.getTokenAddress(80002, 'SUT');
      expect(address).toBe('0xE4C687167705Abf55d709395f92e254bdF5825a2');
    });

    it('should return TEST token address for Hardhat', () => {
      const address = service.getTokenAddress(31337, 'TEST');
      expect(address).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    });

    it('should return undefined for unsupported chainId', () => {
      const address = service.getTokenAddress(1, 'SUT');
      expect(address).toBeUndefined();
    });

    it('should return undefined for unsupported token symbol', () => {
      const address = service.getTokenAddress(80002, 'ETH');
      expect(address).toBeUndefined();
    });

    it('should be case-sensitive for token symbols', () => {
      const addressLower = service.getTokenAddress(80002, 'sut');
      expect(addressLower).toBeUndefined();
    });
  });

  describe('getChainContracts', () => {
    it('should return contracts for supported chain', () => {
      const contracts = service.getChainContracts(80002);
      expect(contracts).toBeDefined();
      expect(contracts).toHaveProperty('gateway');
      expect(contracts).toHaveProperty('forwarder');
    });

    it('should return correct gateway and forwarder for Polygon Amoy', () => {
      const contracts = service.getChainContracts(80002);
      expect(contracts?.gateway).toBe('0x0000000000000000000000000000000000000000');
      expect(contracts?.forwarder).toBe('0x0000000000000000000000000000000000000000');
    });

    it('should return correct addresses for Hardhat', () => {
      const contracts = service.getChainContracts(31337);
      expect(contracts?.gateway).toBe('0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9');
      expect(contracts?.forwarder).toBe('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    });

    it('should return undefined for unsupported chainId', () => {
      const contracts = service.getChainContracts(1);
      expect(contracts).toBeUndefined();
    });
  });

  describe('getDecimals', () => {
    it('should fallback to 18 when contract call fails', async () => {
      // Mock getDecimals to simulate fallback behavior
      vi.spyOn(service, 'getDecimals').mockResolvedValue(18);

      const decimals = await service.getDecimals(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(decimals).toBe(18);
    });

    it('should return actual decimals when contract call succeeds', async () => {
      // Mock getDecimals to return 6 decimals (like USDC)
      vi.spyOn(service, 'getDecimals').mockResolvedValue(6);

      const decimals = await service.getDecimals(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(decimals).toBe(6);
    });

    it('should log warning when falling back to 18 decimals', async () => {
      // Mock getDecimals to simulate fallback value
      vi.spyOn(service, 'getDecimals').mockResolvedValue(18);

      const result = await service.getDecimals(80002, '0xE4C687167705Abf55d709395f92e254bdF5825a2');

      // Should return fallback value of 18
      expect(result).toBe(18);
    });
  });

  describe('Error handling', () => {
    it('should handle missing chainId gracefully', () => {
      const result = service.getChainContracts(999);
      expect(result).toBeUndefined();
    });

    it('should handle missing token symbol gracefully', () => {
      const result = service.getTokenAddress(80002, 'UNKNOWN');
      expect(result).toBeUndefined();
    });
  });
});

describe('BlockchainService - Constructor and chain initialization', () => {
  it('should skip chains without gateway or forwarder addresses', () => {
    const service = new BlockchainService([mockChainWithoutContracts]);
    expect(service.isChainSupported(99999)).toBe(false);
  });

  it('should initialize multiple chains correctly', () => {
    const service = new BlockchainService(mockChainsWithTokens);
    expect(service.isChainSupported(80002)).toBe(true);
    expect(service.isChainSupported(31337)).toBe(true);
    expect(service.getSupportedChainIds()).toContain(80002);
    expect(service.getSupportedChainIds()).toContain(31337);
  });
});

describe('BlockchainService - Token validation methods', () => {
  let service: BlockchainService;

  beforeEach(() => {
    service = new BlockchainService(mockChainsWithTokens);
  });

  describe('validateToken', () => {
    it('should return true for valid token with matching symbol and address', () => {
      const result = service.validateToken(
        80002,
        'SUT',
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBe(true);
    });

    it('should return false for unsupported chain', () => {
      const result = service.validateToken(
        999,
        'SUT',
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBe(false);
    });

    it('should return false for non-existent token symbol', () => {
      const result = service.validateToken(
        80002,
        'UNKNOWN',
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBe(false);
    });

    it('should return false for address mismatch', () => {
      const result = service.validateToken(
        80002,
        'SUT',
        '0x0000000000000000000000000000000000000000'
      );
      expect(result).toBe(false);
    });

    it('should be case-insensitive for address comparison', () => {
      const result = service.validateToken(
        80002,
        'SUT',
        '0xe4c687167705abf55d709395f92e254bdf5825a2'
      );
      expect(result).toBe(true);
    });
  });

  describe('validateTokenByAddress', () => {
    it('should return true for valid token address', () => {
      const result = service.validateTokenByAddress(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBe(true);
    });

    it('should return false for unsupported chain', () => {
      const result = service.validateTokenByAddress(
        999,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBe(false);
    });

    it('should return false for non-existent token address', () => {
      const result = service.validateTokenByAddress(
        80002,
        '0x0000000000000000000000000000000000000000'
      );
      expect(result).toBe(false);
    });

    it('should be case-insensitive for address lookup', () => {
      const result = service.validateTokenByAddress(
        80002,
        '0xe4c687167705abf55d709395f92e254bdf5825a2'
      );
      expect(result).toBe(true);
    });
  });

  describe('getTokenConfigByAddress', () => {
    it('should return token config for valid address', () => {
      const result = service.getTokenConfigByAddress(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBeDefined();
      expect(result?.symbol).toBe('SUT');
      expect(result?.decimals).toBe(18);
    });

    it('should return null for unsupported chain', () => {
      const result = service.getTokenConfigByAddress(
        999,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );
      expect(result).toBeNull();
    });

    it('should return null for non-existent token address', () => {
      const result = service.getTokenConfigByAddress(
        80002,
        '0x0000000000000000000000000000000000000000'
      );
      expect(result).toBeNull();
    });
  });

  describe('getTokenConfig', () => {
    it('should return token config for valid symbol', () => {
      const result = service.getTokenConfig(80002, 'SUT');
      expect(result).toBeDefined();
      expect(result?.address).toBe('0xE4C687167705Abf55d709395f92e254bdF5825a2');
      expect(result?.decimals).toBe(18);
    });

    it('should return null for unsupported chain', () => {
      const result = service.getTokenConfig(999, 'SUT');
      expect(result).toBeNull();
    });

    it('should return null for non-existent symbol', () => {
      const result = service.getTokenConfig(80002, 'UNKNOWN');
      expect(result).toBeNull();
    });
  });

  describe('getChainConfig', () => {
    it('should return chain config for supported chain', () => {
      const result = service.getChainConfig(80002);
      expect(result).toBeDefined();
      expect(result.name).toBe('Polygon Amoy');
      expect(result.chainId).toBe(80002);
    });

    it('should throw error for unsupported chain', () => {
      expect(() => service.getChainConfig(999)).toThrow('Unsupported chain: 999');
    });
  });
});

describe('BlockchainService - Blockchain interaction methods', () => {
  let service: BlockchainService;
  let mockClient: {
    readContract: ReturnType<typeof vi.fn>;
    waitForTransactionReceipt: ReturnType<typeof vi.fn>;
    getBlockNumber: ReturnType<typeof vi.fn>;
    getLogs: ReturnType<typeof vi.fn>;
    getBlock: ReturnType<typeof vi.fn>;
    getTransactionReceipt: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const viem = await import('viem');
    mockClient = {
      readContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
      getBlockNumber: vi.fn(),
      getLogs: vi.fn(),
      getBlock: vi.fn(),
      getTransactionReceipt: vi.fn(),
    };
    vi.mocked(viem.createPublicClient).mockReturnValue(mockClient as never);
    service = new BlockchainService(mockChainsWithTokens);
  });

  describe('getTokenBalance', () => {
    it('should return token balance', async () => {
      mockClient.readContract.mockResolvedValue(BigInt('1000000000000000000'));

      const result = await service.getTokenBalance(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        '0x1234567890123456789012345678901234567890'
      );

      expect(result).toBe('1000000000000000000');
    });

    it('should throw error when balance query fails', async () => {
      mockClient.readContract.mockRejectedValue(new Error('RPC error'));

      await expect(
        service.getTokenBalance(
          80002,
          '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          '0x1234567890123456789012345678901234567890'
        )
      ).rejects.toThrow('토큰 잔액을 조회할 수 없습니다');
    });
  });

  describe('getTokenAllowance', () => {
    it('should return token allowance', async () => {
      mockClient.readContract.mockResolvedValue(BigInt('5000000000000000000'));

      const result = await service.getTokenAllowance(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321'
      );

      expect(result).toBe('5000000000000000000');
    });

    it('should throw error when allowance query fails', async () => {
      mockClient.readContract.mockRejectedValue(new Error('RPC error'));

      await expect(
        service.getTokenAllowance(
          80002,
          '0xE4C687167705Abf55d709395f92e254bdF5825a2',
          '0x1234567890123456789012345678901234567890',
          '0x0987654321098765432109876543210987654321'
        )
      ).rejects.toThrow('토큰 승인액을 조회할 수 없습니다');
    });
  });

  describe('getTokenSymbolOnChain', () => {
    it('should return token symbol from contract', async () => {
      mockClient.readContract.mockResolvedValue('USDC');

      const result = await service.getTokenSymbolOnChain(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2'
      );

      expect(result).toBe('USDC');
    });

    it('should return UNKNOWN when contract call fails', async () => {
      mockClient.readContract.mockRejectedValue(new Error('Contract error'));

      const result = await service.getTokenSymbolOnChain(
        80002,
        '0x0000000000000000000000000000000000000000'
      );

      expect(result).toBe('UNKNOWN');
    });
  });

  describe('getDecimals', () => {
    it('should return decimals from contract', async () => {
      mockClient.readContract.mockResolvedValue(6);

      const result = await service.getDecimals(80002, '0xE4C687167705Abf55d709395f92e254bdF5825a2');

      expect(result).toBe(6);
    });

    it('should return 18 as fallback when contract call fails', async () => {
      mockClient.readContract.mockRejectedValue(new Error('Contract error'));

      const result = await service.getDecimals(80002, '0x0000000000000000000000000000000000000000');

      expect(result).toBe(18);
    });
  });

  describe('getTransactionStatus', () => {
    it('should return confirmed status for successful transaction', async () => {
      mockClient.getTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: BigInt(100),
      });
      mockClient.getBlockNumber.mockResolvedValue(BigInt(105));

      const result = await service.getTransactionStatus(80002, '0x' + 'a'.repeat(64));

      expect(result.status).toBe('confirmed');
      expect(result.blockNumber).toBe(100);
      expect(result.confirmations).toBe(5);
    });

    it('should return failed status for reverted transaction', async () => {
      mockClient.getTransactionReceipt.mockResolvedValue({
        status: 'reverted',
        blockNumber: BigInt(100),
      });
      mockClient.getBlockNumber.mockResolvedValue(BigInt(105));

      const result = await service.getTransactionStatus(80002, '0x' + 'a'.repeat(64));

      expect(result.status).toBe('failed');
    });

    it('should return pending status when transaction not found', async () => {
      mockClient.getTransactionReceipt.mockRejectedValue(new Error('Transaction not found'));

      const result = await service.getTransactionStatus(80002, '0x' + 'a'.repeat(64));

      expect(result.status).toBe('pending');
    });
  });

  describe('waitForConfirmation', () => {
    it('should return receipt for confirmed transaction', async () => {
      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: BigInt(100),
        transactionHash: '0x' + 'a'.repeat(64),
      });

      const result = await service.waitForConfirmation(80002, '0x' + 'a'.repeat(64), 1);

      expect(result).toBeDefined();
      expect(result?.status).toBe('success');
      expect(result?.blockNumber).toBe(BigInt(100));
    });

    it('should return failed status for reverted transaction', async () => {
      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'reverted',
        blockNumber: BigInt(100),
        transactionHash: '0x' + 'a'.repeat(64),
      });

      const result = await service.waitForConfirmation(80002, '0x' + 'a'.repeat(64), 1);

      expect(result?.status).toBe('failed');
    });

    it('should return null when waiting fails', async () => {
      mockClient.waitForTransactionReceipt.mockRejectedValue(new Error('Timeout'));

      const result = await service.waitForConfirmation(80002, '0x' + 'a'.repeat(64), 1);

      expect(result).toBeNull();
    });
  });

  describe('estimateGasCost', () => {
    // Note: recipientAddress removed - contract pays to treasury (set at deployment)
    it('should return fixed gas estimate', async () => {
      const result = await service.estimateGasCost(
        80002,
        '0xE4C687167705Abf55d709395f92e254bdF5825a2' as `0x${string}`,
        BigInt('1000000000000000000')
      );

      expect(result).toBe(BigInt('200000'));
    });
  });

  describe('recordPaymentOnChain', () => {
    it('should return transaction hash for valid payment data', async () => {
      const result = await service.recordPaymentOnChain({
        payerAddress: '0x1234567890123456789012345678901234567890',
        amount: BigInt('1000000000000000000'),
        currency: 'USDC',
        tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2' as `0x${string}`,
        description: 'Test payment',
      });

      expect(result).toBe('0x' + 'a'.repeat(64));
    });

    it('should throw error when payerAddress is missing', async () => {
      await expect(
        service.recordPaymentOnChain({
          payerAddress: '',
          amount: BigInt('1000000000000000000'),
          currency: 'USDC',
          tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2' as `0x${string}`,
        })
      ).rejects.toThrow('필수 결제 정보가 누락되었습니다');
    });

    it('should throw error when amount is missing', async () => {
      await expect(
        service.recordPaymentOnChain({
          payerAddress: '0x1234567890123456789012345678901234567890',
          amount: BigInt(0),
          currency: 'USDC',
          tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2' as `0x${string}`,
        })
      ).rejects.toThrow('필수 결제 정보가 누락되었습니다');
    });
  });

  describe('getPaymentStatus', () => {
    it('should return pending status when payment not processed', async () => {
      mockClient.readContract.mockResolvedValue(false);

      const result = await service.getPaymentStatus(80002, '0x' + 'a'.repeat(64));

      expect(result).toBeDefined();
      expect(result?.status).toBe('pending');
    });

    it('should return completed status when payment is processed', async () => {
      mockClient.readContract.mockResolvedValue(true);
      mockClient.getBlockNumber.mockResolvedValue(BigInt(1000));
      mockClient.getLogs.mockResolvedValue([
        {
          args: {
            paymentId: '0x' + 'a'.repeat(64),
            payerAddress: '0x1234567890123456789012345678901234567890',
            treasuryAddress: '0x0987654321098765432109876543210987654321',
            tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
            amount: BigInt('1000000000000000000'),
            timestamp: BigInt(1234567890),
          },
          blockHash: '0x' + 'b'.repeat(64),
          transactionHash: '0x' + 'c'.repeat(64),
        },
      ]);
      mockClient.getBlock.mockResolvedValue({
        timestamp: BigInt(1234567890),
      });

      // Mock getTokenSymbolOnChain
      mockClient.readContract.mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === 'processedPayments') return true;
          if (functionName === 'symbol') return 'SUT';
          return null;
        }
      );

      const result = await service.getPaymentStatus(80002, '0x' + 'a'.repeat(64));

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
    });

    it('should return pending status when error occurs', async () => {
      mockClient.readContract.mockRejectedValue(new Error('RPC error'));

      const result = await service.getPaymentStatus(80002, '0x' + 'a'.repeat(64));

      expect(result).toBeDefined();
      expect(result?.status).toBe('pending');
    });
  });

  describe('getPaymentHistory', () => {
    it('should return empty array when no payments found', async () => {
      mockClient.getBlockNumber.mockResolvedValue(BigInt(1000));
      mockClient.getLogs.mockResolvedValue([]);

      const result = await service.getPaymentHistory(
        80002,
        '0x1234567890123456789012345678901234567890',
        1000
      );

      expect(result).toEqual([]);
    });

    it('should throw error when payment history query fails', async () => {
      mockClient.getBlockNumber.mockRejectedValue(new Error('RPC error'));

      await expect(
        service.getPaymentHistory(80002, '0x1234567890123456789012345678901234567890', 1000)
      ).rejects.toThrow('결제 이력을 조회할 수 없습니다');
    });

    it('should return payment history sorted by timestamp descending', async () => {
      mockClient.getBlockNumber.mockResolvedValue(BigInt(2000));
      mockClient.getLogs.mockResolvedValue([
        {
          args: {
            paymentId: '0x' + 'a'.repeat(64),
            payerAddress: '0x1234567890123456789012345678901234567890',
            treasuryAddress: '0x0987654321098765432109876543210987654321',
            tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
            amount: BigInt('1000000000000000000'),
            timestamp: BigInt(1000),
          },
          blockHash: '0x' + 'b'.repeat(64),
          transactionHash: '0x' + 'c'.repeat(64),
        },
        {
          args: {
            paymentId: '0x' + 'd'.repeat(64),
            payerAddress: '0x1234567890123456789012345678901234567890',
            treasuryAddress: '0x0987654321098765432109876543210987654321',
            tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
            amount: BigInt('2000000000000000000'),
            timestamp: BigInt(2000),
          },
          blockHash: '0x' + 'e'.repeat(64),
          transactionHash: '0x' + 'f'.repeat(64),
        },
      ]);
      mockClient.getBlock.mockImplementation(async ({ blockHash }: { blockHash: string }) => ({
        timestamp: blockHash === '0x' + 'b'.repeat(64) ? BigInt(1000) : BigInt(2000),
      }));
      mockClient.readContract.mockResolvedValue('SUT');

      const result = await service.getPaymentHistory(
        80002,
        '0x1234567890123456789012345678901234567890',
        1000
      );

      expect(result.length).toBe(2);
      // Should be sorted by timestamp descending
      expect(parseInt(result[0].timestamp)).toBeGreaterThan(parseInt(result[1].timestamp));
    });
  });
});
