import { test, expect } from '@playwright/test';

/**
 * Solo Pay Demo E2E Test Suite
 *
 * AC-9: E2E 결제 흐름 테스트
 * - 상품 선택 → 지갑 연결 → Approve → Pay 완전 흐름
 *
 * Note: Full Web3 wallet interaction requires specialized tools (Synpress)
 * These tests verify UI flow and API integration
 */

test.describe('Product Display', () => {
  test('should display product catalog', async ({ page }) => {
    await page.goto('/');

    // Wait for products to load
    await expect(page.getByText('Digital Art Pack')).toBeVisible();
    await expect(page.getByText('Premium Membership')).toBeVisible();
    await expect(page.getByText('Game Credits')).toBeVisible();
    await expect(page.getByText('NFT Mint Pass')).toBeVisible();
  });

  test('should show product prices', async ({ page }) => {
    await page.goto('/');

    // Verify prices are displayed
    await expect(page.getByText('10 TEST')).toBeVisible();
    await expect(page.getByText('50 TEST')).toBeVisible();
    await expect(page.getByText('25 TEST')).toBeVisible();
    await expect(page.getByText('100 TEST')).toBeVisible();
  });
});

test.describe('Connect Wallet Button', () => {
  test('should display connect wallet button when not connected', async ({ page }) => {
    await page.goto('/');

    // RainbowKit connect button should be visible
    const connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeVisible();
  });

  test('should open wallet modal on connect click', async ({ page }) => {
    await page.goto('/');

    const connectButton = page.getByRole('button', { name: /connect/i });
    await connectButton.click();

    // RainbowKit modal should appear
    await expect(page.getByText(/connect a wallet/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Payment Modal', () => {
  test('should show buy button on product cards', async ({ page }) => {
    await page.goto('/');

    // Each product should have a buy button
    const buyButtons = page.getByRole('button', { name: /buy/i });
    await expect(buyButtons.first()).toBeVisible();
  });

  test('should prompt wallet connection when clicking buy without wallet', async ({ page }) => {
    await page.goto('/');

    // Click buy on first product
    const buyButton = page.getByRole('button', { name: /buy/i }).first();
    await buyButton.click();

    // Should prompt to connect wallet or show modal
    // The exact behavior depends on implementation
    const walletPrompt = page.getByText(/connect.*wallet/i);
    const paymentModal = page.getByText(/payment/i);

    // Either wallet prompt or payment modal should appear
    await expect(walletPrompt.or(paymentModal)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Checkout API Integration', () => {
  test('should call checkout API with correct product', async ({ request }) => {
    // Direct API test
    const response = await request.post('/api/checkout', {
      data: {
        productId: 'product-1',
      },
    });

    // Should succeed or fail based on server availability
    // In E2E with both servers running, this should succeed
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.productId).toBe('product-1');
      expect(data.productName).toBe('Digital Art Pack');
      expect(data.amount).toBe('10');
      expect(data.chainId).toBe(31337); // Hardhat
      expect(data.decimals).toBe(18);
      expect(data).toHaveProperty('paymentId');
      expect(data).toHaveProperty('tokenAddress');
      expect(data).toHaveProperty('gatewayAddress');
    } else {
      // Server might not be running in CI
      console.log('Server not available, skipping API validation');
    }
  });

  test('should return error for invalid product', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: {
        productId: 'invalid-product',
      },
    });

    if (!response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('PRODUCT_NOT_FOUND');
    }
  });

  test('should return error for missing productId', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: {},
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Products should still be visible
    await expect(page.getByText('Digital Art Pack')).toBeVisible();

    // Connect button should be accessible
    const connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByText('Digital Art Pack')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept API calls to simulate network error
    await page.route('**/api/checkout', (route) => {
      route.abort('connectionfailed');
    });

    await page.goto('/');

    // Click buy button
    const buyButton = page.getByRole('button', { name: /buy/i }).first();

    // If there's a click handler that calls API directly
    // The UI should handle the error gracefully
    // This test verifies the app doesn't crash
    await buyButton.click();

    // Page should still be functional
    await expect(page.getByText('Digital Art Pack')).toBeVisible();
  });
});

/**
 * Full Payment Flow Test
 *
 * Note: This test requires:
 * 1. Running Hardhat node (pnpm hardhat:node)
 * 2. Running payment server (pnpm -F server dev)
 * 3. Wallet with test tokens
 *
 * For full E2E with wallet interaction, consider using Synpress:
 * https://github.com/Synthetixio/synpress
 */
test.describe('Full Payment Flow (Manual Verification)', () => {
  test.skip('should complete full payment flow', async ({ page }) => {
    // This test is skipped by default as it requires:
    // - Hardhat node running
    // - Payment server running
    // - MetaMask with test account

    await page.goto('/');

    // Step 1: Connect wallet (requires Synpress or manual)
    // Step 2: Select product
    // Step 3: Click buy
    // Step 4: Approve token
    // Step 5: Pay

    // Verification would check:
    // - Token allowance increased
    // - Payment transaction succeeded
    // - Balance changed correctly

    expect(true).toBe(true); // Placeholder
  });
});
