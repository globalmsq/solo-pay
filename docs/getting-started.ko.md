[English](getting-started.md) | [한국어](getting-started.ko.md)

# SoloPay - 시작하기

여러 상점이 통합할 수 있는 블록체인 결제 게이트웨이

## SoloPay란?

SoloPay는 ERC-20 토큰 기반 블록체인 결제 시스템입니다. 상점서버는 SDK를 통해 결제를 생성하고, 사용자는 Direct Payment(가스비 직접 지불) 또는 Gasless Payment(가스비 대납) 방식으로 결제할 수 있습니다.

**핵심 특징**:

- 스마트 컨트랙트가 유일한 진실 공급원 (Contract = Source of Truth)
- Direct Payment와 Gasless Payment 지원
- TypeScript SDK 제공
- 상점서버와 블록체인 간 완전 분리

## 5분 만에 시작하기

### 1. Docker로 로컬 데모 실행

```bash
# Docker Desktop 실행 (실행 중이 아닌 경우)
# Docker Desktop이 설치되어 있고 실행 중이어야 합니다

# Docker Compose 시작
cd docker
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### 2. 서비스 접속

| 서비스         | URL                   | 설명          |
| -------------- | --------------------- | ------------- |
| Demo App       | http://localhost:3000 | 프론트엔드    |
| Payment Server | http://localhost:3001 | API 서버      |
| Hardhat        | http://localhost:8545 | 로컬 블록체인 |

### 3. Health Check

```bash
# Payment Server 확인
curl http://localhost:3001/health

# 응답: {"status":"ok","timestamp":"..."}
```

### 4. 다음 단계

#### 상점 개발자

결제 기능을 상점에 통합하려면:

- [결제 통합하기](guides/integrate-payment.ko.md) - SDK 사용법, Direct/Gasless 결제 구현

#### 운영자

결제 서버를 배포하려면:

- [서버 배포하기](guides/deploy-server.ko.md) - Docker, 환경 변수, 프로덕션 체크리스트

#### 개발자

프로젝트에 기여하려면:

- [코드 기여하기](guides/contribute.ko.md) - 로컬 개발 환경, PR 프로세스

#### 참고 자료

자세한 내용은:

- [API 레퍼런스](reference/api.ko.md) - 모든 API 엔드포인트
- [SDK 레퍼런스](reference/sdk.ko.md) - SoloPayClient 메서드
- [시스템 구조](reference/architecture.ko.md) - 전체 시스템 다이어그램
- [에러 코드](reference/errors.ko.md) - 에러 코드 및 해결 방법

## 시스템 구조

```
프론트엔드 → 상점서버 (SDK) → 결제서버 (API) → 스마트 컨트랙트
                                                    (Source of Truth)
```

## 핵심 원칙

1. **Contract = Source of Truth**: 결제 완료 여부는 오직 스마트 컨트랙트만 신뢰
2. **상점서버 ↔ 블록체인 분리**: 상점서버는 결제서버 API만 호출, 블록체인 직접 접근 불가
3. **서버 발급 paymentId**: 결제서버가 유일한 paymentId 생성자

## 결제 방식

### Direct Payment

사용자가 가스비를 직접 지불하는 방식:

1. 상점서버: SDK로 결제 생성
2. 프론트엔드: Metamask로 트랜잭션 전송
3. 상점서버: 결제 상태 조회 (polling)

### Gasless Payment

서비스가 가스비를 대납하는 방식:

1. 상점서버: SDK로 결제 생성
2. 프론트엔드: EIP-712 서명 (가스비 없음)
3. 상점서버: 서명 제출
4. 결제서버: Forwarder를 통해 트랜잭션 실행

## 지원 네트워크

| 네트워크               | Chain ID | 토큰 |
| ---------------------- | -------- | ---- |
| Polygon Amoy (Testnet) | 80002    | SUT  |
| Hardhat (Local)        | 31337    | TEST |

## 문제 해결

### Docker 서비스가 시작되지 않음

```bash
# 포트 충돌 확인
lsof -i :3306
lsof -i :3001

# 볼륨 초기화 후 재시작
docker-compose down -v
docker-compose up -d
```

### MySQL 권한 오류

```bash
# MySQL 재시작
docker-compose restart mysql
```

### Hardhat 연결 불가

```bash
# Hardhat 로그 확인
docker-compose logs hardhat

# Hardhat 재시작
docker-compose restart hardhat
```

## 추가 리소스

- [DOCKER_TEST_GUIDE.md](../DOCKER_TEST_GUIDE.md) - Docker 상세 가이드
- [README.md](../README.md) - 프로젝트 개요
