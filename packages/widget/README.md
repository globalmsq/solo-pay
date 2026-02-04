# Solo Pay Widget

Payment widget for Solo Pay. Two modes:

- **PC** (`/pc`) — Compact card for desktop popup / new window
- **Mobile** (`/`) — Full-screen redirect page for mobile users

Built with Next.js, RainbowKit, wagmi, and Tailwind CSS v4.

## Quick Start

```bash
# 1. Install dependencies (from monorepo root)
pnpm install

# 2. Run dev server
pnpm dev
```

Open http://localhost:3000 (mobile) or http://localhost:3000/pc (PC widget).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | Free project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com) (needed for mobile wallet deep linking) |
| `NEXT_PUBLIC_ENABLE_TESTNETS` | No | Set to `"true"` to enable Sepolia testnet |

## Scripts

```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

## Integration

The merchant backend creates a payment session via the pay-server API, receives a `token`, and opens the widget with that token. The widget fetches payment details from the server — no sensitive data in the URL.

### Flow

```
1. Merchant backend → POST /api/payments → receives { token }
2. Merchant frontend → opens widget URL with token
3. User connects wallet, completes payment
4. Widget redirects to successUrl / failUrl
```

### URL Format

```
/pc?token={session_token}     # PC (popup window)
/?token={session_token}       # Mobile (redirect)
```

### PC Example

```js
// Merchant opens widget as a popup
window.open(
  'https://pay.example.com/pc?token=abc123',
  'solopay',
  'width=450,height=600'
);
```

### Mobile Example

```js
// Merchant redirects the user
window.location.href = 'https://pay.example.com/?token=abc123';
```

## Project Structure

```
src/
  pages/
    _app.tsx         # Providers (Wagmi, RainbowKit, React Query)
    index.tsx        # Mobile full-screen page
    pc/index.tsx     # PC compact card widget
  styles/
    globals.css      # Tailwind CSS v4 entry point
  wagmi.ts           # Chain and wallet config
```
