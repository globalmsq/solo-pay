import { PrismaClient, Token } from '@solo-pay/database';

export interface CreateTokenInput {
  chain_id: number;
  address: string;
  symbol: string;
  decimals: number;
}

export interface UpdateTokenInput {
  symbol?: string;
  decimals?: number;
  is_enabled?: boolean;
}

export class TokenService {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateTokenInput): Promise<Token> {
    return this.prisma.token.create({
      data: {
        chain_id: input.chain_id,
        address: input.address.toLowerCase(),
        symbol: input.symbol,
        decimals: input.decimals,
        is_enabled: true,
        is_deleted: false,
      },
    });
  }

  async findById(id: number): Promise<Token | null> {
    return this.prisma.token.findFirst({
      where: {
        id,
        is_deleted: false,
      },
    });
  }

  async findByAddress(chainId: number, address: string): Promise<Token | null> {
    return this.prisma.token.findFirst({
      where: {
        chain_id: chainId,
        address: address.toLowerCase(),
        is_deleted: false,
      },
    });
  }

  async findAllOnChain(chainId: number, includeDisabled: boolean = false): Promise<Token[]> {
    return this.prisma.token.findMany({
      where: {
        chain_id: chainId,
        is_deleted: false,
        ...(includeDisabled ? {} : { is_enabled: true }),
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findByIds(ids: number[]): Promise<Token[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.token.findMany({
      where: {
        id: { in: ids },
        is_deleted: false,
      },
    });
  }

  async findAllForChains(chainIds: number[], includeDisabled: boolean = false): Promise<Token[]> {
    if (chainIds.length === 0) {
      return [];
    }
    return this.prisma.token.findMany({
      where: {
        chain_id: { in: chainIds },
        is_deleted: false,
        ...(includeDisabled ? {} : { is_enabled: true }),
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async update(id: number, input: UpdateTokenInput): Promise<Token> {
    return this.prisma.token.update({
      where: { id },
      data: {
        ...(input.symbol !== undefined && { symbol: input.symbol }),
        ...(input.decimals !== undefined && { decimals: input.decimals }),
        ...(input.is_enabled !== undefined && { is_enabled: input.is_enabled }),
      },
    });
  }

  async softDelete(id: number): Promise<Token> {
    return this.prisma.token.update({
      where: { id },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
      },
    });
  }
}
