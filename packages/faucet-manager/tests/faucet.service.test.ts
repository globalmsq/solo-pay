import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestGas } from '../src/faucet.service';
import { RequestGasError } from '../src/types';
import type { GasFaucetPorts } from '../src/ports';

const mockPayment = {
  paymentId: '0xabc',
  networkId: 31337,
  amountWei: 10_000_000n,
  tokenAddress: '0x' + '11'.repeat(20),
  gatewayAddress: '0x' + '22'.repeat(20),
};

function createMockPorts(overrides: Partial<GasFaucetPorts> = {}): GasFaucetPorts {
  return {
    getPaymentInfo: vi.fn().mockResolvedValue(mockPayment),
    findWalletGasGrant: vi.fn().mockResolvedValue(null),
    getTokenBalance: vi.fn().mockResolvedValue(10_000_000n),
    getNativeBalance: vi.fn().mockResolvedValue(0n),
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n),
    sendNative: vi.fn().mockResolvedValue('0xtxhash'),
    createWalletGasGrant: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('requestGas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns txHash, amount, chainId when all conditions pass', async () => {
    const ports = createMockPorts();
    const result = await requestGas(ports, {
      paymentId: '0xabc',
      walletAddress: '0x' + 'aa'.repeat(20),
    });

    expect(result.txHash).toBe('0xtxhash');
    expect(result.chainId).toBe(31337);
    expect(BigInt(result.amount)).toBe(48_000n * 1_000_000_000n);
    expect(ports.sendNative).toHaveBeenCalledTimes(1);
    expect(ports.createWalletGasGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: '0x' + 'aa'.repeat(20),
        chainId: 31337,
        txHash: '0xtxhash',
      })
    );
  });

  it('throws PAYMENT_NOT_FOUND when getPaymentInfo returns null', async () => {
    const ports = createMockPorts({ getPaymentInfo: vi.fn().mockResolvedValue(null) });

    await expect(
      requestGas(ports, { paymentId: '0xbad', walletAddress: '0x' + 'aa'.repeat(20) })
    ).rejects.toThrow(RequestGasError);

    await expect(
      requestGas(ports, { paymentId: '0xbad', walletAddress: '0x' + 'aa'.repeat(20) })
    ).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });

    expect(ports.sendNative).not.toHaveBeenCalled();
  });

  it('throws ALREADY_HAS_GAS when native balance >= approve cost', async () => {
    const ports = createMockPorts({
      getNativeBalance: vi.fn().mockResolvedValue(100_000_000_000_000n),
    });

    await expect(
      requestGas(ports, { paymentId: '0xabc', walletAddress: '0x' + 'aa'.repeat(20) })
    ).rejects.toMatchObject({ code: 'ALREADY_HAS_GAS' });

    expect(ports.sendNative).not.toHaveBeenCalled();
  });

  it('throws ALREADY_GRANTED when findWalletGasGrant returns existing record', async () => {
    const ports = createMockPorts({
      findWalletGasGrant: vi.fn().mockResolvedValue({ id: 1 }),
    });

    await expect(
      requestGas(ports, { paymentId: '0xabc', walletAddress: '0x' + 'aa'.repeat(20) })
    ).rejects.toMatchObject({ code: 'ALREADY_GRANTED' });

    expect(ports.sendNative).not.toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_TOKEN_BALANCE when token balance < amount', async () => {
    const ports = createMockPorts({ getTokenBalance: vi.fn().mockResolvedValue(0n) });

    await expect(
      requestGas(ports, { paymentId: '0xabc', walletAddress: '0x' + 'aa'.repeat(20) })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_TOKEN_BALANCE' });

    expect(ports.sendNative).not.toHaveBeenCalled();
  });
});
