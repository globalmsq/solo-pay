# 인증

SoloPay API는 API Key를 사용하여 인증합니다.

## API Key 발급

1. SoloPay 대시보드에 로그인
2. Settings > API Keys 메뉴로 이동
3. "Create API Key" 클릭
4. 발급된 키를 안전하게 저장

::: warning 보안 주의
API Key는 한 번만 표시됩니다. 분실 시 새로 발급해야 합니다.
:::

## API Key 종류

| 종류     | 접두사     | 용도          |
| -------- | ---------- | ------------- |
| Test Key | `sk_test_` | 테스트넷 환경 |
| Live Key | `sk_live_` | 메인넷 환경   |

## 사용 방법

### SDK 사용 시

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

// 기본 설정 (staging 환경)
const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY,
  environment: 'staging', // 'production' | 'staging' | 'custom'
});

// 커스텀 URL 사용 시
const customClient = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY,
  environment: 'custom',
  baseUrl: 'https://your-custom-api.com',
});
```

### REST API 직접 호출 시

```bash
# 결제 생성 예시
curl -X POST http://localhost:3001/payments/create \
  -H "x-api-key: sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_demo_001",
    "amount": 10.5,
    "chainId": 80002,
    "tokenAddress": "0x...",
    "recipientAddress": "0x..."
  }'
```

## 환경 변수 설정

::: code-group

```bash [.env]
SOLO_PAY_API_KEY=sk_test_xxxxx
```

```typescript [사용]
const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
  environment: 'staging',
});
```

:::

## 보안 권장사항

### 해야 할 것

- API Key를 환경 변수로 관리
- 서버 사이드에서만 API Key 사용
- 정기적으로 키 교체

### 하지 말아야 할 것

- 클라이언트 코드에 API Key 노출
- 버전 관리 시스템에 키 커밋
- 로그에 API Key 출력

::: danger 금지
API Key를 프론트엔드 코드에 포함하지 마세요. 노출된 키는 즉시 폐기하고 새로 발급받으세요.
:::

## API Key 폐기

1. 대시보드에서 해당 키 선택
2. "Revoke" 클릭
3. 새 키 발급 후 애플리케이션 업데이트

## 다음 단계

- [SDK 설치](/ko/sdk/) - SDK 상세 사용법
- [결제 생성](/ko/payments/create) - 첫 결제 만들기
