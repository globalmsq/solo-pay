// Note: recipientAddress removed - contract pays to treasury (set at deployment)
export interface MerchantFixture {
  merchantId: string;
  apiKey: string;
  apiKeyHash: string;
  chainId: number; // DB chain_id (logical reference to chains.id)
  networkId: number; // EIP-155 chain ID for blockchain
  webhookUrl?: string;
}

/**
 * 테스트용 머천트 데이터 (init.sql과 동기화됨)
 * API 키 해시는 SHA-256 해시 값
 *
 * Note: merchant는 특정 체인에 바인딩됨
 * - chainId: DB의 chains.id (논리적 참조)
 * - networkId: 실제 EIP-155 체인 ID (31337, 80002 등)
 */
export const TEST_MERCHANTS: Record<string, MerchantFixture> = {
  // Demo Merchant (id=1) - Localhost chain (chain_id=1, network_id=31337)
  default: {
    merchantId: 'merchant_demo_001',
    apiKey: '123',
    apiKeyHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    chainId: 1, // DB chains.id = 1
    networkId: 31337, // Hardhat localhost
    webhookUrl: 'https://webhook.site/demo',
  },
  // MetaStar Merchant (id=2) - Amoy chain (chain_id=3, network_id=80002)
  metastar: {
    merchantId: 'merchant_metastar_001',
    apiKey: 'msq_sk_metastar_123',
    apiKeyHash: '0136f3e97619f4aa51dffe177e9b7d6bf495ffd6b09547f5463ef483d1db705a',
    chainId: 3, // DB chains.id = 3
    networkId: 80002, // Polygon Amoy testnet
  },
};

export function getMerchant(name: string = 'default'): MerchantFixture {
  const merchant = TEST_MERCHANTS[name];
  if (!merchant) {
    throw new Error(`Unknown merchant: ${name}`);
  }
  return merchant;
}
