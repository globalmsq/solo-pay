import { Prisma, PrismaClient, Merchant } from '@prisma/client';
import crypto from 'crypto';

/** Message thrown when merchant_key already exists (for 409 handling in routes). */
export const MERCHANT_KEY_EXISTS_MESSAGE = 'Merchant key already exists';
/** Message thrown when api_key is already in use by another merchant (one API key per merchant). */
export const API_KEY_IN_USE_MESSAGE = 'API key already in use';

export interface CreateMerchantInput {
  merchant_key: string;
  name: string;
  chain_id: number;
  api_key: string;
  webhook_url?: string;
}

export interface UpdateMerchantInput {
  name?: string;
  chain_id?: number;
  webhook_url?: string;
  is_enabled?: boolean;
}

export class MerchantService {
  constructor(private prisma: PrismaClient) {}

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  async create(input: CreateMerchantInput): Promise<Merchant> {
    const apiKeyHash = this.hashApiKey(input.api_key);
    const existingMerchant = await this.prisma.merchant.findFirst({
      where: {
        OR: [
          { merchant_key: input.merchant_key },
          { api_key_hash: apiKeyHash },
        ],
      },
    });
    if (existingMerchant) {
      if (existingMerchant.merchant_key === input.merchant_key) {
        throw new Error(MERCHANT_KEY_EXISTS_MESSAGE);
      }
      throw new Error(API_KEY_IN_USE_MESSAGE);
    }

    try {
      return await this.prisma.merchant.create({
        data: {
          merchant_key: input.merchant_key,
          name: input.name,
          chain_id: input.chain_id,
          api_key_hash: apiKeyHash,
          webhook_url: input.webhook_url,
          is_enabled: true,
          is_deleted: false,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        Array.isArray(err.meta?.target)
      ) {
        const target = err.meta.target as string[];
        if (target.includes('merchant_key')) throw new Error(MERCHANT_KEY_EXISTS_MESSAGE);
        if (target.includes('api_key_hash')) throw new Error(API_KEY_IN_USE_MESSAGE);
      }
      throw err;
    }
  }

  async findById(id: number): Promise<Merchant | null> {
    return this.prisma.merchant.findFirst({
      where: {
        id,
        is_deleted: false,
      },
    });
  }

  async findByMerchantKey(merchantKey: string): Promise<Merchant | null> {
    return this.prisma.merchant.findFirst({
      where: {
        merchant_key: merchantKey,
        is_deleted: false,
      },
    });
  }

  async findAll(includeDisabled: boolean = false): Promise<Merchant[]> {
    return this.prisma.merchant.findMany({
      where: {
        is_deleted: false,
        ...(includeDisabled ? {} : { is_enabled: true }),
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async update(id: number, input: UpdateMerchantInput): Promise<Merchant> {
    return this.prisma.merchant.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.chain_id !== undefined && { chain_id: input.chain_id }),
        ...(input.webhook_url !== undefined && { webhook_url: input.webhook_url }),
        ...(input.is_enabled !== undefined && { is_enabled: input.is_enabled }),
      },
    });
  }

  async findByApiKey(apiKey: string): Promise<Merchant | null> {
    const apiKeyHash = this.hashApiKey(apiKey);
    return this.prisma.merchant.findFirst({
      where: {
        api_key_hash: apiKeyHash,
        is_deleted: false,
        is_enabled: true,
      },
    });
  }

  async verifyApiKey(merchantId: number, apiKey: string): Promise<boolean> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      return false;
    }

    const apiKeyHash = this.hashApiKey(apiKey);
    return merchant.api_key_hash === apiKeyHash;
  }

  async softDelete(id: number): Promise<Merchant> {
    return this.prisma.merchant.update({
      where: { id },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
      },
    });
  }
}
