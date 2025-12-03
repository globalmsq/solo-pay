/**
 * 멀티체인 + 멀티토큰 설정 로더
 * JSON 파일에서 체인 설정을 로드하고 Zod로 검증
 */

import { readFileSync } from 'fs';
import { z } from 'zod';

// 토큰 설정 스키마
const TokenConfigSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().int().min(0).max(18),
});

// 네이티브 통화 스키마
const NativeCurrencySchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
});

// 체인 설정 스키마
const ChainConfigSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string(),
  rpcUrl: z.string().url(),
  subgraphUrl: z.string().url().optional(),
  nativeCurrency: NativeCurrencySchema,
  contracts: z.object({
    gateway: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    forwarder: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  tokens: z.record(z.string(), TokenConfigSchema),
});

// 전체 설정 스키마
const ChainsConfigSchema = z.object({
  chains: z.array(ChainConfigSchema),
});

// 타입 내보내기
export type TokenConfig = z.infer<typeof TokenConfigSchema>;
export type NativeCurrency = z.infer<typeof NativeCurrencySchema>;
export type ChainConfig = z.infer<typeof ChainConfigSchema>;
export type ChainsConfig = z.infer<typeof ChainsConfigSchema>;

/**
 * JSON 파일에서 체인 설정 로드
 * @param configPath JSON 설정 파일 경로
 * @returns 검증된 체인 설정
 * @throws 파일 읽기 실패 또는 스키마 검증 실패 시 에러
 */
export function loadChainsConfig(configPath: string): ChainsConfig {
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return ChainsConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Chain configuration validation failed:');
      console.error(error.errors);
      throw new Error(`Invalid chain configuration: ${error.message}`);
    }
    throw error;
  }
}
