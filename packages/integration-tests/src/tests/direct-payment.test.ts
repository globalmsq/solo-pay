import { describe, it, expect, beforeAll } from 'vitest';
import {
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
} from '../helpers/blockchain';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import { getToken } from '../fixtures/token';
import { getMerchant } from '../fixtures/merchant';
import { generatePaymentId } from '../helpers/signature';

describe('Direct Payment Integration', () => {
  const token = getToken('mockUSDT');
  const merchant = getMerchant('default');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const merchantAddress = merchant.recipientAddress;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;

  beforeAll(async () => {
    const balance = await getTokenBalance(token.address, payerAddress);
    if (balance < parseUnits('1000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }
  });

  it('should complete a direct payment successfully', async () => {
    const paymentId = generatePaymentId(`ORDER_DIRECT_${Date.now()}`);
    const amount = parseUnits('100', token.decimals);

    const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
    const initialMerchantBalance = await getTokenBalance(token.address, merchantAddress);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    const tx = await gateway.pay(paymentId, token.address, amount, merchantAddress);
    await tx.wait();

    const isProcessed = await gateway.isPaymentProcessed(paymentId);
    expect(isProcessed).toBe(true);

    const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
    const finalMerchantBalance = await getTokenBalance(token.address, merchantAddress);

    expect(finalPayerBalance).toBe(initialPayerBalance - amount);
    expect(finalMerchantBalance).toBe(initialMerchantBalance + amount);
  });

  it('should reject duplicate payment ID', async () => {
    const paymentId = generatePaymentId(`ORDER_DUP_${Date.now()}`);
    const amount = parseUnits('50', token.decimals);

    await approveToken(token.address, gatewayAddress, amount * 2n, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    const tx = await gateway.pay(paymentId, token.address, amount, merchantAddress);
    await tx.wait();

    await expect(gateway.pay(paymentId, token.address, amount, merchantAddress)).rejects.toThrow();
  });

  it('should reject zero amount payment', async () => {
    const paymentId = generatePaymentId(`ORDER_ZERO_${Date.now()}`);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    await expect(gateway.pay(paymentId, token.address, 0n, merchantAddress)).rejects.toThrow();
  });

  it('should reject payment with insufficient balance', async () => {
    const paymentId = generatePaymentId(`ORDER_INSUFFICIENT_${Date.now()}`);
    const balance = await getTokenBalance(token.address, payerAddress);
    const amount = balance + parseUnits('1000', token.decimals);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    await expect(gateway.pay(paymentId, token.address, amount, merchantAddress)).rejects.toThrow();
  });
});
