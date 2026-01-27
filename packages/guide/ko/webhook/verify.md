# 서명 검증

::: warning 개발 예정
Webhook 기능은 현재 개발 중입니다. 아래 문서는 예정된 기능 명세입니다.
:::

Webhook 요청의 진위를 확인합니다.

## 왜 검증해야 하나요?

악의적인 제3자가 가짜 Webhook 요청을 보낼 수 있습니다. 서명 검증을 통해 MSQPay에서 보낸 진짜 요청인지 확인해야 합니다.

::: danger 필수
프로덕션 환경에서는 **반드시** 서명을 검증하세요.
:::

## 검증 방법

### SDK 사용 (권장)

```typescript
import { verifyWebhookSignature } from '@globalmsq/msqpay'

app.post('/webhook', (req, res) => {
  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-msqpay-signature'],
    timestamp: req.headers['x-msqpay-timestamp'],
    secret: process.env.WEBHOOK_SECRET!
  })

  if (!isValid) {
    return res.status(401).send('Invalid signature')
  }

  // 이벤트 처리
  const event = req.body
  console.log(event.event, event.data)

  res.status(200).send('OK')
})
```

### 직접 구현

서명은 다음과 같이 생성됩니다:

```
signature = HMAC-SHA256(timestamp + '.' + JSON.stringify(payload), secret)
```

검증 코드:

```typescript
import crypto from 'crypto'

function verifySignature(
  payload: object,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // 타임스탬프 검증 (5분 이내)
  const now = Math.floor(Date.now() / 1000)
  const requestTime = parseInt(timestamp, 10)

  if (Math.abs(now - requestTime) > 300) {
    return false  // 리플레이 공격 방지
  }

  // 서명 검증
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

## 프레임워크별 예시

### Express.js

```typescript
import express from 'express'
import { verifyWebhookSignature } from '@globalmsq/msqpay'

const app = express()

// raw body 필요
app.use('/webhook', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString()
  }
}))

app.post('/webhook', (req, res) => {
  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-msqpay-signature'] as string,
    timestamp: req.headers['x-msqpay-timestamp'] as string,
    secret: process.env.WEBHOOK_SECRET!
  })

  if (!isValid) {
    return res.status(401).send('Invalid signature')
  }

  // 이벤트 처리
  handleEvent(req.body)

  res.status(200).send('OK')
})
```

### Next.js API Route

```typescript
// pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyWebhookSignature } from '@globalmsq/msqpay'

export const config = {
  api: {
    bodyParser: true
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-msqpay-signature'] as string,
    timestamp: req.headers['x-msqpay-timestamp'] as string,
    secret: process.env.WEBHOOK_SECRET!
  })

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // 이벤트 처리
  const { event, data } = req.body

  switch (event) {
    case 'payment.confirmed':
      // 주문 완료 처리
      break
    case 'payment.failed':
      // 실패 처리
      break
  }

  res.status(200).json({ received: true })
}
```

### Fastify

```typescript
import Fastify from 'fastify'
import { verifyWebhookSignature } from '@globalmsq/msqpay'

const app = Fastify()

app.post('/webhook', async (request, reply) => {
  const isValid = verifyWebhookSignature({
    payload: request.body,
    signature: request.headers['x-msqpay-signature'] as string,
    timestamp: request.headers['x-msqpay-timestamp'] as string,
    secret: process.env.WEBHOOK_SECRET!
  })

  if (!isValid) {
    return reply.status(401).send({ error: 'Invalid signature' })
  }

  // 이벤트 처리
  handleEvent(request.body)

  return { received: true }
})
```

## 주의사항

### 타임스탬프 검증

- 요청 시각과 현재 시각의 차이가 5분 이내인지 확인
- 리플레이 공격 방지

### Timing-safe 비교

- 일반 문자열 비교(`===`)는 타이밍 공격에 취약
- `crypto.timingSafeEqual()` 사용 권장

### 멱등성 처리

- 같은 이벤트가 여러 번 전송될 수 있음
- `paymentId`로 중복 처리 방지

```typescript
const processedEvents = new Set<string>()

function handleEvent(event: WebhookEvent) {
  const eventKey = `${event.data.paymentId}:${event.event}`

  if (processedEvents.has(eventKey)) {
    return  // 이미 처리됨
  }

  processedEvents.add(eventKey)
  // 이벤트 처리...
}
```

## 다음 단계

- [이벤트 상세](/ko/webhook/events) - 이벤트별 처리 방법
- [API Reference](/ko/api/) - 전체 API 명세
