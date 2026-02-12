# Faucet Manager (`@solo-pay/faucet-manager`)

[English](README.md) | [한국어](README.ko.md)

지갑당 체인당 1회 한도로 가스(네이티브 토큰)를 지급하는 라이브러리 및 HTTP 서비스입니다. 위젯에서 **POST /payments/request-gas** 로 직접 호출합니다.

## 개요

- **조건:** 결제 존재, 토큰 잔액 ≥ 결제 금액, 네이티브 잔액 < approve 비용, 해당 (지갑, 체인)에 대한 기 지급 이력 없음.
- **지급량:** `48_000 * gasPrice` wei (approve 1회 분, transfer보다 작게 제한).
- **Ports:** 본 서비스에서 구현 (getPaymentInfo, findWalletGasGrant, getTokenBalance, getNativeBalance, getGasPrice, sendNative, createWalletGasGrant). 인증: x-public-key 및 Origin(merchant allowed_domains).

## 빌드 / 실행

```bash
pnpm --filter @solo-pay/faucet-manager build
pnpm --filter @solo-pay/faucet-manager start
```

기본 포트 **3002** (`PORT` env). Docker Compose 에서는 호스트 포트 **3003** (`3003:3002`)으로 노출됩니다. 상태 확인: `GET http://localhost:3002/health` (Docker 사용 시 `http://localhost:3003/health`). request-gas 는 **POST 전용**이며 GET 시 405를 반환합니다.

## 테스트

```bash
pnpm --filter @solo-pay/faucet-manager test
```
