import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlockchainService } from '../blockchain.service';
import { ChainWithTokens } from '../chain.service';

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
        is_enabled: true,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  },
];

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
      // Mock getClient to return a mock client with failing readContract
      const mockClient = {
        readContract: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.spyOn(service as any, 'getClient').mockReturnValue(mockClient);

      const decimals = await service.getDecimals(80002, '0xE4C687167705Abf55d709395f92e254bdF5825a2');
      expect(decimals).toBe(18);
    });

    it('should return actual decimals when contract call succeeds', async () => {
      // Mock getClient to return a mock client with successful readContract
      const mockClient = {
        readContract: vi.fn().mockResolvedValue(6),
      };
      vi.spyOn(service as any, 'getClient').mockReturnValue(mockClient);

      const decimals = await service.getDecimals(80002, '0xE4C687167705Abf55d709395f92e254bdF5825a2');
      expect(decimals).toBe(6);
    });

    it('should log warning when falling back to 18 decimals', async () => {
      const mockClient = {
        readContract: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.spyOn(service as any, 'getClient').mockReturnValue(mockClient);

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
