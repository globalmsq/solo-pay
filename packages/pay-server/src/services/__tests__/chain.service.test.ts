import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChainService } from '../chain.service';
import { getPrismaClient, disconnectPrisma } from '../../db/client';

describe('ChainService', () => {
  let chainService: ChainService;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    chainService = new ChainService(prisma);

    // Clean up before tests
    await prisma.chain.deleteMany({});
  });

  afterAll(async () => {
    // Clean up after tests
    await prisma.chain.deleteMany({});
    await disconnectPrisma();
  });

  it('should create a new chain', async () => {
    const chainData = {
      network_id: 1,
      name: 'Ethereum',
      rpc_url: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      is_testnet: false,
    };

    const result = await chainService.create(chainData);

    expect(result).toBeDefined();
    expect(result.network_id).toBe(1);
    expect(result.name).toBe('Ethereum');
    expect(result.is_enabled).toBe(true);
    expect(result.is_deleted).toBe(false);
  });

  it('should find chain by network ID', async () => {
    const chainData = {
      network_id: 31337,
      name: 'Hardhat',
      rpc_url: 'http://localhost:8545',
      is_testnet: true,
    };

    await chainService.create(chainData);

    const result = await chainService.findByNetworkId(31337);

    expect(result).toBeDefined();
    expect(result?.network_id).toBe(31337);
    expect(result?.name).toBe('Hardhat');
  });

  it('should find chain by ID', async () => {
    const chainData = {
      network_id: 137,
      name: 'Polygon',
      rpc_url: 'https://polygon-rpc.com',
      is_testnet: false,
    };

    const created = await chainService.create(chainData);
    const result = await chainService.findById(created.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(created.id);
    expect(result?.name).toBe('Polygon');
  });

  it('should find all enabled chains', async () => {
    // Clean up first
    await prisma.chain.deleteMany({});

    await chainService.create({
      network_id: 1,
      name: 'Ethereum',
      rpc_url: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      is_testnet: false,
    });

    await chainService.create({
      network_id: 137,
      name: 'Polygon',
      rpc_url: 'https://polygon-rpc.com',
      is_testnet: false,
    });

    const result = await chainService.findAll();

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should update chain information', async () => {
    const chainData = {
      network_id: 42161,
      name: 'Arbitrum',
      rpc_url: 'https://arb1.arbitrum.io/rpc',
      is_testnet: false,
    };

    const created = await chainService.create(chainData);

    const updated = await chainService.update(created.id, {
      name: 'Arbitrum One',
      rpc_url: 'https://arbitrum-one.publicrpc.com',
    });

    expect(updated.name).toBe('Arbitrum One');
    expect(updated.rpc_url).toBe('https://arbitrum-one.publicrpc.com');
  });

  it('should soft delete chain', async () => {
    const chainData = {
      network_id: 10,
      name: 'Optimism',
      rpc_url: 'https://mainnet.optimism.io',
      is_testnet: false,
    };

    const created = await chainService.create(chainData);

    const deleted = await chainService.softDelete(created.id);

    expect(deleted.is_deleted).toBe(true);
    expect(deleted.deleted_at).toBeDefined();

    // Should not find deleted chain
    const found = await chainService.findById(created.id);
    expect(found).toBeNull();
  });

  it('should return null for non-existent chain', async () => {
    const result = await chainService.findByNetworkId(99999);
    expect(result).toBeNull();
  });

  it('should exclude deleted chains from findAll', async () => {
    await prisma.chain.deleteMany({});

    const chain1 = await chainService.create({
      network_id: 1,
      name: 'Ethereum',
      rpc_url: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      is_testnet: false,
    });

    const chain2 = await chainService.create({
      network_id: 2,
      name: 'Test Chain',
      rpc_url: 'https://test.example.com',
      is_testnet: true,
    });

    await chainService.softDelete(chain2.id);

    const result = await chainService.findAll();

    const chainIds = result.map((c) => c.id);
    expect(chainIds).toContain(chain1.id);
    expect(chainIds).not.toContain(chain2.id);
  });
});
