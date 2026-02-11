# @solo-pay/widget-js

Lightweight, framework-agnostic payment widget for SoloPay.

## Installation

```bash
npm install @solo-pay/widget-js
# or
yarn add @solo-pay/widget-js
# or
pnpm add @solo-pay/widget-js
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@solo-pay/widget-js/dist/widget.min.js"></script>
```

## Usage

### Vanilla JavaScript

```javascript
const soloPay = new SoloPay({ publicKey: 'pk_live_xxx' });

soloPay.requestPayment({
  orderId: 'order-123',
  amount: '10',
  tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  successUrl: 'https://example.com/success',
  failUrl: 'https://example.com/fail',
});
```

### React / Next.js

```tsx
import { SoloPay } from '@solo-pay/widget-js';
import { useEffect, useRef } from 'react';

export default function CheckoutButton() {
  const soloPayRef = useRef<SoloPay | null>(null);

  useEffect(() => {
    soloPayRef.current = new SoloPay({ publicKey: 'pk_live_xxx' });
    return () => soloPayRef.current?.destroy();
  }, []);

  const handlePay = () => {
    soloPayRef.current?.requestPayment(
      {
        orderId: 'order-123',
        amount: '10',
        tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        successUrl: `${window.location.origin}/success`,
        failUrl: `${window.location.origin}/fail`,
      },
      undefined,
      {
        onClose: () => console.log('Widget closed'),
      }
    );
  };

  return <button onClick={handlePay}>Pay Now</button>;
}
```

> **Note:** For Next.js App Router, add `'use client'` at the top of the file.

## SDK Reference

### `new SoloPay(config)`

| Option         | Type                               | Default                       | Description             |
| -------------- | ---------------------------------- | ----------------------------- | ----------------------- |
| `publicKey`    | `string`                           | required                      | Your SoloPay public key |
| `widgetUrl`    | `string`                           | `https://widget.solo-pay.com` | Widget URL              |
| `debug`        | `boolean`                          | `false`                       | Enable debug logging    |
| `redirectMode` | `'auto' \| 'iframe' \| 'redirect'` | `'auto'`                      | How to open widget      |

**Redirect modes:**

- `'auto'` - iframe modal on desktop, redirect on mobile (default)
- `'iframe'` - Always open in iframe modal
- `'redirect'` - Always redirect to widget page

### `soloPay.requestPayment(request, mode?, options?)`

Opens the payment widget.

**Parameters:**

- `request` - Payment request object (see below)
- `mode` - Override redirect mode for this payment (optional)
- `options` - Additional options (optional)

**Request:**

| Parameter      | Type     | Required | Description                           |
| -------------- | -------- | -------- | ------------------------------------- |
| `orderId`      | `string` | Yes      | Unique order identifier               |
| `amount`       | `string` | Yes      | Payment amount                        |
| `tokenAddress` | `string` | Yes      | Token contract address                |
| `successUrl`   | `string` | Yes      | Redirect URL on success               |
| `failUrl`      | `string` | Yes      | Redirect URL on failure               |
| `webhookUrl`   | `string` | No       | Webhook URL for payment notifications |

**Options:**

| Option            | Type          | Description                          |
| ----------------- | ------------- | ------------------------------------ |
| `onClose`         | `() => void`  | Callback when widget is closed       |
| `iframeContainer` | `HTMLElement` | Custom container for embedded iframe |

### `soloPay.getWidgetUrl(request)`

Returns the widget URL for custom implementations.

### `soloPay.closeWidget()`

Closes any open widget (iframe or popup).

### `soloPay.destroy()`

Destroys the SDK instance and cleans up resources.

## License

MIT
