import { CONTRACT_ADDRESSES } from '../setup/wallets';

export interface TokenFixture {
  id: number; // DB tokens.id
  address: string;
  symbol: string;
  decimals: number;
  dbChainId: number; // DB chain_id (logical reference)
  networkId: number; // EIP-155 chain ID
}

/**
 * 테스트용 토큰 데이터 (init.sql과 동기화됨)
 *
 * Note: 머천트는 자신의 체인에 맞는 토큰만 사용 가능
 * - Demo Merchant (chain_id=1) → TEST 토큰 (token_id=1)
 * - MetaStar Merchant (chain_id=3) → SUT on Amoy 토큰 (token_id=3)
 */
export const TEST_TOKENS: Record<string, TokenFixture> = {
  // TEST token on Localhost (id=1, chain_id=1, network_id=31337)
  // Used by: Demo Merchant
  test: {
    id: 1,
    address: CONTRACT_ADDRESSES.mockToken,
    symbol: 'TEST',
    decimals: 18,
    dbChainId: 1,
    networkId: 31337,
  },
  // SUT token on Polygon Mainnet (id=2, chain_id=5, network_id=137)
  // Not used in tests (mainnet)
  sutPolygon: {
    id: 2,
    address: '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55',
    symbol: 'SUT',
    decimals: 18,
    dbChainId: 5,
    networkId: 137,
  },
  // SUT token on Amoy (id=3, chain_id=3, network_id=80002)
  // Used by: MetaStar Merchant
  sutAmoy: {
    id: 3,
    address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    symbol: 'SUT',
    decimals: 18,
    dbChainId: 3,
    networkId: 80002,
  },
};

// Backward compatibility alias
export const TEST_TOKENS_LEGACY = {
  mockUSDT: TEST_TOKENS.test,
};

export function getToken(name: string = 'test'): TokenFixture {
  // Support legacy name
  if (name === 'mockUSDT') {
    return TEST_TOKENS.test;
  }
  const token = TEST_TOKENS[name];
  if (!token) {
    throw new Error(`Unknown token: ${name}`);
  }
  return token;
}

/**
 * 머천트의 체인에 맞는 토큰 반환
 */
export function getTokenForChain(dbChainId: number): TokenFixture | undefined {
  return Object.values(TEST_TOKENS).find((t) => t.dbChainId === dbChainId);
}
