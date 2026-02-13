import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceService, TokenNotFoundError, CmcIdMissingError } from '../src/services/price.service';
import { getCache, setCache } from '../src/lib/redis';

vi.mock('../src/lib/redis', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

const mockToken = {
  id: 1,
  chain_id: 137,
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  symbol: 'USDT',
  decimals: 6,
  cmc_id: 825,
  is_enabled: true,
  is_deleted: false,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockCmcResponse = {
  status: { error_code: 0, error_message: null, credit_count: 1 },
  data: {
    '825': {
      id: 825,
      name: 'Tether',
      symbol: 'USDT',
      quote: {
        USD: {
          price: 1.0001,
          volume_24h: 50000000000,
          percent_change_1h: 0.01,
          percent_change_24h: 0.02,
          percent_change_7d: -0.01,
          market_cap: 95000000000,
          last_updated: '2025-01-15T12:00:00.000Z',
        },
      },
    },
  },
};

function createMockPrisma() {
  return {
    token: {
      findUnique: vi.fn(),
    },
  };
}

describe('PriceService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(setCache).mockResolvedValue(undefined);
    mockPrisma = createMockPrisma();
  });

  function createService() {
    return new PriceService({ apiKey: 'test-api-key', cacheTtl: 60 }, mockPrisma as never);
  }

  describe('getPrice', () => {
    it('should look up token in DB and fetch price from CMC', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce(mockToken);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockCmcResponse,
      } as Response);

      const service = createService();
      const result = await service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7');

      expect(mockPrisma.token.findUnique).toHaveBeenCalledWith({
        where: {
          chain_id_address: {
            chain_id: 137,
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        },
      });

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy.mock.calls[0][0]).toContain('id=825');

      expect(result.symbol).toBe('USDT');
      expect(result.address).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7');
      expect(result.chain_id).toBe(137);
      expect(result.quote.USD.price).toBe(1.0001);
    });

    it('should pass API key and convert parameter', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce(mockToken);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockCmcResponse,
      } as Response);

      const service = createService();
      await service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'KRW');

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['X-CMC_PRO_API_KEY']).toBe('test-api-key');
      expect(fetchSpy.mock.calls[0][0]).toContain('convert=KRW');
    });

    it('should return cached data on cache hit', async () => {
      const cachedData = JSON.stringify({
        id: 825,
        name: 'Tether',
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        chain_id: 137,
        quote: { USD: { price: 1.0001 } },
      });
      vi.mocked(getCache).mockResolvedValueOnce(cachedData);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const service = createService();
      const result = await service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockPrisma.token.findUnique).not.toHaveBeenCalled();
      expect(result.symbol).toBe('USDT');
    });

    it('should cache fetched data with configured TTL', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce(mockToken);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockCmcResponse,
      } as Response);

      const service = createService();
      await service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7');

      expect(setCache).toHaveBeenCalledOnce();
      expect(vi.mocked(setCache).mock.calls[0][0]).toContain('price:137:');
      expect(vi.mocked(setCache).mock.calls[0][2]).toBe(60);
    });

    it('should throw TokenNotFoundError when token not in DB', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce(null);

      const service = createService();
      await expect(
        service.getPrice(137, '0x0000000000000000000000000000000000000000')
      ).rejects.toThrow(TokenNotFoundError);
    });

    it('should throw TokenNotFoundError when token is disabled', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce({
        ...mockToken,
        is_enabled: false,
      });

      const service = createService();
      await expect(
        service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
      ).rejects.toThrow(TokenNotFoundError);
    });

    it('should throw CmcIdMissingError when cmc_id is null', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce({
        ...mockToken,
        cmc_id: null,
      });

      const service = createService();
      await expect(
        service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
      ).rejects.toThrow(CmcIdMissingError);
    });

    it('should throw on CMC API error response', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce(mockToken);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      const service = createService();
      await expect(
        service.getPrice(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
      ).rejects.toThrow('CMC API error: 401');
    });

    it('should normalize address to lowercase', async () => {
      mockPrisma.token.findUnique.mockResolvedValueOnce(mockToken);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockCmcResponse,
      } as Response);

      const service = createService();
      await service.getPrice(137, '0xDAC17F958D2EE523A2206206994597C13D831EC7');

      expect(mockPrisma.token.findUnique).toHaveBeenCalledWith({
        where: {
          chain_id_address: {
            chain_id: 137,
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        },
      });
    });
  });
});
