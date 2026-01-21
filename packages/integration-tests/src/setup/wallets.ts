/**
 * Hardhat 기본 테스트 계정
 * 이 계정들은 Hardhat 로컬 노드에서 사용하는 결정론적 계정입니다.
 */
export const HARDHAT_ACCOUNTS = {
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  relayer: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  merchant: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  payer: {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
} as const;

/**
 * 배포된 컨트랙트 주소 (init.sql과 동기화됨)
 * Deployment order: Forwarder → MockERC20 → GatewayV1 → Proxy
 */
export const CONTRACT_ADDRESSES = {
  forwarder: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  mockToken: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  paymentGateway: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9', // Gateway Proxy
} as const;

export const TEST_CHAIN_ID = 31337;
