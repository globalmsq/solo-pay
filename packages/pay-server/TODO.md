# Pay Server TODO

## High Priority

### Database Integration

- [ ] **chainId 하드코딩 제거** (`src/routes/payments/status.ts:5`)
  - 현재: `DEFAULT_CHAIN_ID = 31337` 하드코딩
  - 변경: DB에서 paymentId로 chainId 동적 조회
  - 관련 TODO 주석: `src/routes/payments/status.ts:4`, `src/routes/payments/status.ts:24-25`

- [ ] **결제 정보 DB 저장**
  - paymentId, chainId, merchantId, orderId 매핑 테이블 생성
  - create API에서 결제 생성 시 DB에 저장
  - status API에서 paymentId로 chainId 조회

## Notes

- 현재는 Hardhat 개발 환경(chainId: 31337)만 지원
- 멀티체인 지원 시 DB 통합 필수
