import { PrismaClient, MerchantPaymentMethod } from '@prisma/client';
import { TokenService } from './token.service';
import { ChainService } from './chain.service';

export interface CreatePaymentMethodInput {
  merchant_id: number;
  token_id: number;
  recipient_address: string;
  is_enabled?: boolean;
}

export interface UpdatePaymentMethodInput {
  recipient_address?: string;
  is_enabled?: boolean;
}

export interface EnrichedPaymentMethod {
  id: number;
  recipient_address: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  token: {
    id: number;
    address: string;
    symbol: string;
    decimals: number;
    chain_id: number;
  };
  chain: {
    id: number;
    network_id: number;
    name: string;
    is_testnet: boolean;
  };
}

export class PaymentMethodService {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreatePaymentMethodInput): Promise<MerchantPaymentMethod> {
    return this.prisma.merchantPaymentMethod.create({
      data: {
        merchant_id: input.merchant_id,
        token_id: input.token_id,
        recipient_address: input.recipient_address.toLowerCase(),
        is_enabled: input.is_enabled !== undefined ? input.is_enabled : true,
        is_deleted: false,
      },
    });
  }

  async findById(id: number): Promise<MerchantPaymentMethod | null> {
    return this.prisma.merchantPaymentMethod.findFirst({
      where: {
        id,
        is_deleted: false,
      },
    });
  }

  async findByMerchantAndToken(merchantId: number, tokenId: number): Promise<MerchantPaymentMethod | null> {
    return this.prisma.merchantPaymentMethod.findFirst({
      where: {
        merchant_id: merchantId,
        token_id: tokenId,
        is_deleted: false,
      },
    });
  }

  async findByMerchantAndTokenIncludingDeleted(merchantId: number, tokenId: number): Promise<MerchantPaymentMethod | null> {
    return this.prisma.merchantPaymentMethod.findFirst({
      where: {
        merchant_id: merchantId,
        token_id: tokenId,
      },
    });
  }

  async restore(id: number, input: { recipient_address: string; is_enabled: boolean }): Promise<MerchantPaymentMethod> {
    return this.prisma.merchantPaymentMethod.update({
      where: { id },
      data: {
        recipient_address: input.recipient_address.toLowerCase(),
        is_enabled: input.is_enabled,
        is_deleted: false,
        deleted_at: null,
      },
    });
  }

  async findAllForMerchant(merchantId: number): Promise<MerchantPaymentMethod[]> {
    const whereClause: any = {
      merchant_id: merchantId,
      is_deleted: false,
    };

    return this.prisma.merchantPaymentMethod.findMany({
      where: whereClause,
      orderBy: { created_at: 'asc' },
    });
  }

  async update(id: number, input: UpdatePaymentMethodInput): Promise<MerchantPaymentMethod> {
    return this.prisma.merchantPaymentMethod.update({
      where: { id },
      data: {
        ...(input.recipient_address !== undefined && {
          recipient_address: input.recipient_address.toLowerCase(),
        }),
        ...(input.is_enabled !== undefined && { is_enabled: input.is_enabled }),
      },
    });
  }

  async softDelete(id: number): Promise<MerchantPaymentMethod> {
    return this.prisma.merchantPaymentMethod.update({
      where: { id },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
      },
    });
  }

  /**
   * Enrich payment methods with token and chain information using bulk queries
   * This method optimizes the N+1 query problem by fetching all tokens and chains in bulk
   * 
   * @param paymentMethods Array of payment methods to enrich
   * @param tokenService TokenService instance for bulk token queries
   * @param chainService ChainService instance for bulk chain queries
   * @returns Array of enriched payment methods (null entries filtered out)
   */
  async enrichPaymentMethods(
    paymentMethods: MerchantPaymentMethod[],
    tokenService: TokenService,
    chainService: ChainService
  ): Promise<EnrichedPaymentMethod[]> {
    if (paymentMethods.length === 0) {
      return [];
    }

    // Extract unique token IDs and chain IDs
    const tokenIds = [...new Set(paymentMethods.map((pm) => pm.token_id))];
    
    // Fetch all tokens in bulk
    const tokens = await tokenService.findByIds(tokenIds);
    const tokenMap = new Map(tokens.map((token) => [token.id, token]));

    // Extract unique chain IDs from tokens
    const chainIds = [...new Set(tokens.map((token) => token.chain_id))];
    
    // Fetch all chains in bulk
    const chains = await chainService.findByIds(chainIds);
    const chainMap = new Map(chains.map((chain) => [chain.id, chain]));

    // Enrich payment methods with token and chain data
    const enriched: EnrichedPaymentMethod[] = [];
    
    for (const pm of paymentMethods) {
      const token = tokenMap.get(pm.token_id);
      if (!token) {
        continue;
      }

      const chain = chainMap.get(token.chain_id);
      if (!chain) {
        continue;
      }

      enriched.push({
        id: pm.id,
        recipient_address: pm.recipient_address,
        is_enabled: pm.is_enabled,
        created_at: pm.created_at.toISOString(),
        updated_at: pm.updated_at.toISOString(),
        token: {
          id: token.id,
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          chain_id: token.chain_id,
        },
        chain: {
          id: chain.id,
          network_id: chain.network_id,
          name: chain.name,
          is_testnet: chain.is_testnet,
        },
      });
    }

    return enriched;
  }
}
