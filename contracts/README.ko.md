# MSQ Pay Contracts

[English](README.md) | [한국어](README.ko.md)

MSQ Pay 결제 시스템의 스마트 컨트랙트 패키지입니다.

## 지원 네트워크

| Network          | Chain ID | Type        | RPC Fallback                      |
| ---------------- | -------- | ----------- | --------------------------------- |
| Hardhat Local    | 31337    | Development | localhost:8545                    |
| Polygon Amoy     | 80002    | Testnet     | rpc-amoy.polygon.technology       |
| Polygon          | 137      | Mainnet     | polygon-rpc.com                   |
| Ethereum Sepolia | 11155111 | Testnet     | rpc.sepolia.org                   |
| Ethereum         | 1        | Mainnet     | cloudflare-eth.com                |
| BNB Testnet      | 97       | Testnet     | data-seed-prebsc-1-s1.binance.org |
| BNB              | 56       | Mainnet     | bsc-dataseed.binance.org          |

## 설치

```bash
cd contracts
pnpm install
```

## 환경 설정

1. `.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

2. `.env` 파일에 필요한 값 설정:

```bash
# 배포용 개인키 (실제 키 사용 시 절대 커밋하지 마세요!)
PRIVATE_KEY=0x...

# 네트워크 설정 (배포할 체인에 맞게 설정)
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002

# Block Explorer API Key (Etherscan API v2)
# 단일 API 키로 60개 이상의 체인 지원
ETHERSCAN_API_KEY=your-etherscan-api-key
```

## 컴파일

```bash
pnpm compile
```

## 테스트

```bash
# 전체 테스트
pnpm test

# 커버리지 리포트
pnpm test:coverage
```

## 배포

### 로컬 개발 환경

```bash
# Hardhat 노드 시작 (별도 터미널)
npx hardhat node

# 로컬 배포
npx hardhat ignition deploy ./ignition/modules/PaymentGateway.ts --network localhost
```

### 네트워크 배포

`.env` 파일에 `RPC_URL`과 `CHAIN_ID`를 설정한 후 배포합니다:

```bash
npx hardhat ignition deploy ./ignition/modules/PaymentGateway.ts --network default
```

### 기존 Forwarder를 사용한 배포

외부 릴레이어 서비스의 ERC2771Forwarder를 사용하여 PaymentGateway를 배포하는 방법:

```bash
# 1. 기존 배포 아티팩트 삭제 (재배포 시)
rm -rf ignition/deployments/chain-{CHAIN_ID}

# 2. 파라미터 파일 생성
mkdir -p ignition/parameters
cat > ignition/parameters/network.json << EOF
{
  "PaymentGateway": {
    "forwarderAddress": "0x기존Forwarder주소"
  }
}
EOF

# 3. 파라미터와 함께 배포
npx hardhat ignition deploy ignition/modules/PaymentGateway.ts \
  --network default \
  --parameters ignition/parameters/network.json
```

**Polygon Amoy + msq-relayer-service Forwarder 예시:**

```bash
# 환경변수 설정
export PRIVATE_KEY="0x..."
export RPC_URL="https://rpc-amoy.polygon.technology"
export CHAIN_ID=80002

# Amoy용 파라미터 생성
cat > ignition/parameters/amoy.json << EOF
{
  "PaymentGateway": {
    "forwarderAddress": "0xF034a404241707F347A952Cd4095f9035AF877Bf"
  }
}
EOF

# 배포
npx hardhat ignition deploy ignition/modules/PaymentGateway.ts \
  --network default \
  --parameters ignition/parameters/amoy.json
```

### 배포 후 작업

1. **데이터베이스 업데이트**: `docker/init.sql`의 `gateway_address`와 `forwarder_address` 수정
2. **docker-compose 업데이트**: `server` 서비스에서 `GATEWAY_ADDRESS`와 `FORWARDER_ADDRESS`를 제거하고, 다른 서비스(예: `simple-relayer`)에서는 필요 시 업데이트
3. **컨트랙트 검증** (선택): `npx hardhat ignition verify chain-{CHAIN_ID}`

## 컨트랙트 검증

배포 후 Block Explorer에서 소스 코드를 검증합니다:

```bash
npx hardhat ignition verify chain-{CHAIN_ID}
```

## 배포된 컨트랙트

### Polygon Amoy (Testnet)

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| PaymentGatewayProxy | `0x57F7E705d10e0e94DFB880fFaf58064210bAaf8d` |
| PaymentGatewayV1    | `0x6b08b0EaD9370605AC9F34A17897515aACa0954a` |
| ERC2771Forwarder    | `0xF034a404241707F347A952Cd4095f9035AF877Bf` |
| SUT Token           | `0xE4C687167705Abf55d709395f92e254bdF5825a2` |

> [Polygonscan에서 확인](https://amoy.polygonscan.com/address/0x57F7E705d10e0e94DFB880fFaf58064210bAaf8d)

## 배포 결과 확인

배포된 컨트랙트 주소는 `ignition/deployments/chain-{CHAIN_ID}/deployed_addresses.json`에 저장됩니다.

## 배포 체크리스트

### Testnet 배포 전

- [ ] `.env` 파일에 `PRIVATE_KEY` 설정
- [ ] 배포 지갑에 테스트 토큰 보유 (Faucet 사용)
  - Polygon Amoy: [Polygon Faucet](https://faucet.polygon.technology/)
  - Sepolia: [Sepolia Faucet](https://sepoliafaucet.com/)
  - BNB Testnet: [BNB Faucet](https://testnet.bnbchain.org/faucet-smart)
- [ ] 컨트랙트 검증을 위한 Explorer API 키 설정

### Mainnet 배포 전

- [ ] Testnet에서 충분한 테스트 완료
- [ ] 배포 지갑에 충분한 네이티브 토큰 보유
- [ ] 보안 감사 완료 (권장)
- [ ] 멀티시그 지갑 설정 (권장)

## 컨트랙트 구조

```
src/
├── PaymentGatewayV1.sol      # 결제 게이트웨이 (Upgradeable, EIP-712 서명 검증)
├── PaymentGatewayProxy.sol   # UUPS 프록시 컨트랙트
├── interfaces/
│   └── IPaymentGateway.sol   # 결제 게이트웨이 인터페이스
└── mocks/
    └── MockERC20.sol         # 테스트용 ERC20 토큰
```

### PaymentGatewayV1 기능

- **서버 서명 검증**: EIP-712 타입드 데이터 서명 검증
- **트레저리 모델**: 수수료는 트레저리로, 나머지는 상점 수신자에게 전송
- **토큰 화이트리스트**: 선택적 토큰 지원 강제
- **가스리스 지원**: ERC2771 메타 트랜잭션 지원
- **업그레이드 가능**: 향후 업그레이드를 위한 UUPS 프록시 패턴

## 라이선스

MIT License
